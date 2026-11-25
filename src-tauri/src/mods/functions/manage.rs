use crate::mods::structs::{GameTargets, ModMetadata, StoredMod};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

use crate::app::utils::copy_if_changed;
use crate::mods::import::{ext, is_preview_image_file_name};


pub(crate) fn load_mod_metadata(mod_path: &Path) -> (Option<ModMetadata>, Option<String>) {
    let metadata_path = mod_path.join("mod.json");

    if !metadata_path.exists() {
        return (None, None);
    }

    match fs::read_to_string(&metadata_path) {
        Ok(content) => match serde_json::from_str::<ModMetadata>(&content) {
            Ok(metadata) => (Some(metadata), None),
            Err(err) => (None, Some(format!("Invalid mod.json: {err}"))),
        },
        Err(err) => (None, Some(format!("Failed to read mod.json: {err}"))),
    }
}

fn is_internal_pak_helper_file(name: &std::ffi::OsStr) -> bool {
    let name_text = name.to_string_lossy();

    name_text.eq_ignore_ascii_case("icon.ico")
        || name_text.eq_ignore_ascii_case("icon.png")
        || name_text.eq_ignore_ascii_case("desktop.ini")
        || name_text.eq_ignore_ascii_case("mod.json")
        || is_preview_image_file_name(name)
}

pub(crate) fn game_targets(game_root: &Path) -> GameTargets {
    GameTargets {
        pak_target: game_root
            .join("Client")
            .join("WindowsNoEditor")
            .join("HT")
            .join("Content")
            .join("Paks")
            .join("~mods"),
        asi_target: game_root
            .join("Client")
            .join("WindowsNoEditor")
            .join("HT")
            .join("Binaries")
            .join("Win64"),
    }
}

pub(crate) fn get_mod_files(mod_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();

    for entry in WalkDir::new(mod_dir).into_iter().filter_map(Result::ok) {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        if path
            .file_name()
            .map(is_internal_pak_helper_file)
            .unwrap_or(false)
        {
            continue;
        }

        files.push(path.to_path_buf());
    }

    Ok(files)
}

fn relative_mod_path<'a>(mod_dir: &'a Path, file: &'a Path) -> Result<&'a Path, String> {
    file.strip_prefix(mod_dir)
        .map_err(|_| "errors.failedResolveRelativeModFilePath".to_string())
}

pub(crate) fn get_preview_image_paths(mod_dir: &Path) -> Result<Vec<String>, String> {
    let mut images = Vec::new();

    for entry in WalkDir::new(mod_dir).into_iter().filter_map(Result::ok) {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name() else {
            continue;
        };

        let file_name_text = file_name.to_string_lossy();

        if file_name_text.eq_ignore_ascii_case("icon.ico")
            || file_name_text.eq_ignore_ascii_case("icon.png")
        {
            continue;
        }

        if is_preview_image_file_name(file_name) {
            images.push(path.to_string_lossy().to_string());
        }
    }

    images.sort_by_key(|path| path.to_lowercase());
    Ok(images)
}

pub(crate) fn read_stored_mods(storage_root: &Path) -> Result<Vec<StoredMod>, String> {
    let mut mods = Vec::new();

    if !storage_root.exists() {
        return Ok(mods);
    }

    for entry in fs::read_dir(storage_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let dir = entry.path();

        if !dir.is_dir() {
            continue;
        }

        let files = get_mod_files(&dir)?;
        let is_pak = files.iter().any(|f| ext(f) == "pak");
        let is_asi = files.iter().any(|f| ext(f) == "asi");

        mods.push(StoredMod {
            name: entry.file_name().to_string_lossy().to_string(),
            dir,
            files,
            is_pak,
            is_asi,
        });
    }

    Ok(mods)
}

pub(crate) fn category_dirs(pak_target: &Path) -> Vec<PathBuf> {
    fs::read_dir(pak_target)
        .ok()
        .into_iter()
        .flat_map(|read_dir| read_dir.filter_map(Result::ok))
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect()
}

fn existing_pak_mod_dir(
    pak_target: &Path,
    category_dirs: &[PathBuf],
    mod_name: &str,
) -> Option<PathBuf> {
    let direct = pak_target.join(mod_name);

    if direct.is_dir() {
        return Some(direct);
    }

    category_dirs
        .iter()
        .map(|category| category.join(mod_name))
        .find(|path| path.is_dir())
}

fn target_file_for_pak(
    pak_target: &Path,
    category_dirs: &[PathBuf],
    mod_name: &str,
    relative_path: &Path,
) -> Option<PathBuf> {
    let direct = pak_target.join(mod_name).join(relative_path);

    if direct.is_file() {
        return Some(direct);
    }

    category_dirs
        .iter()
        .map(|category| category.join(mod_name).join(relative_path))
        .find(|path| path.is_file())
}

fn pak_dir_matches_stored_mod(mod_info: &StoredMod, target_dir: &Path) -> Result<bool, String> {
    let expected_paths = mod_info
        .files
        .iter()
        .map(|file| {
            relative_mod_path(&mod_info.dir, file)
                .map(|relative| relative.to_string_lossy().to_lowercase())
        })
        .collect::<Result<HashSet<_>, String>>()?;

    for file in &mod_info.files {
        let relative = relative_mod_path(&mod_info.dir, file)?;

        if !target_dir.join(relative).is_file() {
            return Ok(false);
        }
    }

    for entry in WalkDir::new(target_dir).into_iter().filter_map(Result::ok) {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let relative = path
            .strip_prefix(target_dir)
            .map_err(|_| "errors.failedResolveInstalledModFilePath".to_string())?
            .to_string_lossy()
            .to_lowercase();

        if !expected_paths.contains(&relative) {
            return Ok(false);
        }
    }

    Ok(true)
}

pub(crate) fn installed_pak_files(
    mod_info: &StoredMod,
    pak_target: &Path,
    category_dirs: &[PathBuf],
) -> (usize, Vec<String>) {
    let mut installed_files = 0;
    let mut missing_files = Vec::new();

    for file in &mod_info.files {
        let Ok(relative) = relative_mod_path(&mod_info.dir, file) else {
            continue;
        };

        if target_file_for_pak(pak_target, category_dirs, &mod_info.name, relative).is_some() {
            installed_files += 1;
        } else {
            missing_files.push(relative.to_string_lossy().to_string());
        }
    }

    (installed_files, missing_files)
}

pub(crate) fn installed_asi_files(mod_info: &StoredMod, asi_target: &Path) -> (usize, Vec<String>) {
    let mut installed_files = 0;
    let mut missing_files = Vec::new();

    for file in &mod_info.files {
        let Ok(relative) = relative_mod_path(&mod_info.dir, file) else {
            continue;
        };

        if asi_target.join(relative).is_file() {
            installed_files += 1;
        } else {
            missing_files.push(relative.to_string_lossy().to_string());
        }
    }

    (installed_files, missing_files)
}

fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn remove_pak_mod_from_all_locations(
    pak_target: &Path,
    category_dirs: &[PathBuf],
    mod_name: &str,
) -> Result<(), String> {
    remove_dir_if_exists(&pak_target.join(mod_name))?;

    for category in category_dirs {
        let categorized = category.join(mod_name);
        remove_dir_if_exists(&categorized)?;

        if fs::read_dir(category)
            .ok()
            .and_then(|mut read_dir| read_dir.next())
            .is_none()
        {
            let _ = fs::remove_dir_all(category);
        }
    }

    Ok(())
}

fn remove_asi_mod_files(mod_info: &StoredMod, asi_target: &Path) -> Result<(), String> {
    for file in &mod_info.files {
        let relative = relative_mod_path(&mod_info.dir, file)?;

        remove_file_if_exists(&asi_target.join(relative))?;

        if ext(file) == "asi" {
            if let Some(stem) = file.file_stem() {
                let log_file = asi_target.join(format!("{}.log", stem.to_string_lossy()));
                let _ = remove_file_if_exists(&log_file);
            }
        }
    }

    Ok(())
}

pub(crate) fn active_mod_names(mods: &[StoredMod], targets: &GameTargets) -> Vec<String> {
    let category_dirs = category_dirs(&targets.pak_target);
    let mut active = Vec::new();

    for mod_info in mods {
        let enabled = if mod_info.is_pak {
            let (installed_files, _) =
                installed_pak_files(mod_info, &targets.pak_target, &category_dirs);
            installed_files == mod_info.files.len() && !mod_info.files.is_empty()
        } else if mod_info.is_asi {
            let (installed_files, _) = installed_asi_files(mod_info, &targets.asi_target);
            installed_files == mod_info.files.len() && !mod_info.files.is_empty()
        } else {
            false
        };

        if enabled {
            active.push(mod_info.name.clone());
        }
    }

    active
}


pub fn apply_mod_selection_inner(
    game_path: String,
    selected_mods: Vec<String>,
    pak_categories: HashMap<String, Vec<String>>,
) -> Result<Vec<String>, String> {
    let storage_root = std::env::current_exe()
        .map_err(|_| "errors.failedResolveAppExecutable".to_string())?
        .parent()
        .map(|parent| parent.join("NTEMM_Mods"))
        .ok_or_else(|| "errors.failedResolveAppFolder".to_string())?;

    let game_root = PathBuf::from(game_path);
    let targets = game_targets(&game_root);

    fs::create_dir_all(&targets.pak_target).map_err(|e| e.to_string())?;
    fs::create_dir_all(&targets.asi_target).map_err(|e| e.to_string())?;

    let selected: HashSet<String> = selected_mods.into_iter().collect();
    let mut mod_category_lookup: HashMap<String, String> = HashMap::new();

    for (category_name, mods) in &pak_categories {
        for mod_name in mods {
            mod_category_lookup.insert(mod_name.clone(), category_name.clone());
        }
    }

    let mods = read_stored_mods(&storage_root)?;
    let initial_category_dirs = category_dirs(&targets.pak_target);
    let mut active_after_apply = Vec::new();

    for mod_info in &mods {
        let should_enable = selected.contains(&mod_info.name);

        if should_enable {
            if mod_info.is_pak {
                let desired_dir = mod_category_lookup
                    .get(&mod_info.name)
                    .map(|category| targets.pak_target.join(category).join(&mod_info.name))
                    .unwrap_or_else(|| targets.pak_target.join(&mod_info.name));

                let current_dir = existing_pak_mod_dir(
                    &targets.pak_target,
                    &initial_category_dirs,
                    &mod_info.name,
                );

                let already_correct_location = current_dir
                    .as_ref()
                    .map(|dir| dir == &desired_dir)
                    .unwrap_or(false);

                let already_correct_file_set = current_dir
                    .as_ref()
                    .map(|dir| pak_dir_matches_stored_mod(mod_info, dir))
                    .transpose()?
                    .unwrap_or(false);

                if !already_correct_location || !already_correct_file_set {
                    remove_pak_mod_from_all_locations(
                        &targets.pak_target,
                        &initial_category_dirs,
                        &mod_info.name,
                    )?;

                    fs::create_dir_all(&desired_dir).map_err(|e| e.to_string())?;
                }

                fs::create_dir_all(&desired_dir).map_err(|e| e.to_string())?;

                for file in &mod_info.files {
                    let relative = relative_mod_path(&mod_info.dir, file)?;
                    copy_if_changed(file, &desired_dir.join(relative))?;
                }

                let stored_icon = mod_info.dir.join("icon.ico");

                if stored_icon.exists() {
                    crate::mods::folder_icon::apply_folder_icon_inner(
                        desired_dir.to_string_lossy().to_string(),
                        stored_icon.to_string_lossy().to_string(),
                    )?;
                }

                if !mod_info.files.is_empty() {
                    active_after_apply.push(mod_info.name.clone());
                }
            }

            if mod_info.is_asi {
                for file in &mod_info.files {
                    let relative = relative_mod_path(&mod_info.dir, file)?;
                    copy_if_changed(file, &targets.asi_target.join(relative))?;
                }

                if !mod_info.files.is_empty() {
                    active_after_apply.push(mod_info.name.clone());
                }
            }

            continue;
        }

        if mod_info.is_pak {
            let current_dir =
                existing_pak_mod_dir(&targets.pak_target, &initial_category_dirs, &mod_info.name);

            if current_dir.is_some() {
                remove_pak_mod_from_all_locations(
                    &targets.pak_target,
                    &initial_category_dirs,
                    &mod_info.name,
                )?;
            }
        }

        if mod_info.is_asi {
            let (installed_files, _) = installed_asi_files(mod_info, &targets.asi_target);

            if installed_files > 0 {
                remove_asi_mod_files(mod_info, &targets.asi_target)?;
            }
        }
    }

    Ok(active_after_apply)
}
