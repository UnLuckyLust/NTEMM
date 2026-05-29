use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

use crate::app::utils::copy_if_changed;
use crate::mods::import::{ext, is_preview_image_file_name};
use crate::mods::import::get_mod_storage_root;

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModMetadata {
    #[serde(alias = "Name")]
    pub name: Option<String>,

    #[serde(alias = "Version")]
    pub version: Option<String>,

    #[serde(alias = "Author")]
    pub author: Option<String>,

    #[serde(alias = "Description")]
    pub description: Option<String>,

    #[serde(alias = "ModLink")]
    pub mod_link: Option<String>,

    #[serde(alias = "SupportLink")]
    pub support_link: Option<String>,

    #[serde(alias = "Image")]
    pub image: Option<String>,

    #[serde(alias = "Tags")]
    pub tags: Option<Vec<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedMod {
    pub name: String,
    pub path: String,
    pub files: Vec<String>,
    pub icon_path: Option<String>,
    pub preview_image_paths: Vec<String>,
    pub metadata: Option<ModMetadata>,
    pub metadata_error: Option<String>,
}

#[derive(Serialize)]
pub struct ModInstallStatus {
    pub name: String,
    pub status: String,
    pub installed_files: usize,
    pub expected_files: usize,
    pub missing_files: Vec<String>,
}

#[derive(Clone)]
struct StoredMod {
    name: String,
    dir: PathBuf,
    files: Vec<PathBuf>,
    is_pak: bool,
    is_asi: bool,
}

struct GameTargets {
    pak_target: PathBuf,
    asi_target: PathBuf,
}

fn load_mod_metadata(mod_path: &Path) -> (Option<ModMetadata>, Option<String>) {
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

fn game_targets(game_root: &Path) -> GameTargets {
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

fn get_mod_files(mod_dir: &Path) -> Result<Vec<PathBuf>, String> {
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
        .map_err(|_| "Failed to resolve relative mod file path".to_string())
}

fn get_preview_image_paths(mod_dir: &Path) -> Result<Vec<String>, String> {
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

fn read_stored_mods(storage_root: &Path) -> Result<Vec<StoredMod>, String> {
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

fn category_dirs(pak_target: &Path) -> Vec<PathBuf> {
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
            .map_err(|_| "Failed to resolve installed mod file path".to_string())?
            .to_string_lossy()
            .to_lowercase();

        if !expected_paths.contains(&relative) {
            return Ok(false);
        }
    }

    Ok(true)
}

fn installed_pak_files(
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

fn installed_asi_files(mod_info: &StoredMod, asi_target: &Path) -> (usize, Vec<String>) {
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

fn active_mod_names(mods: &[StoredMod], targets: &GameTargets) -> Vec<String> {
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

#[tauri::command]
pub async fn list_imported_mods(app: tauri::AppHandle) -> Result<Vec<ImportedMod>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage_root = get_mod_storage_root(&app)?;

        if !storage_root.exists() {
            return Ok(Vec::new());
        }

        let mut mods = Vec::new();

        for entry in fs::read_dir(storage_root).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();

            if !path.is_dir() {
                continue;
            }

            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            let files = get_mod_files(&path)?
                .into_iter()
                .filter_map(|file| {
                    file.strip_prefix(&path)
                        .ok()
                        .map(|relative| relative.to_string_lossy().to_string())
                })
                .collect();

            let png_icon_path = path.join("icon.png");
            let ico_icon_path = path.join("icon.ico");

            let icon_path = if png_icon_path.exists() {
                Some(png_icon_path.to_string_lossy().to_string())
            } else if ico_icon_path.exists() {
                Some(ico_icon_path.to_string_lossy().to_string())
            } else {
                None
            };
            
            let (metadata, metadata_error) = load_mod_metadata(&path);
            let preview_image_paths = get_preview_image_paths(&path)?;

            mods.push(ImportedMod {
                name,
                path: path.to_string_lossy().to_string(),
                files,
                icon_path,
                preview_image_paths,
                metadata,
                metadata_error,
            });
        }

        Ok(mods)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_imported_mod(app: tauri::AppHandle, name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage_root = get_mod_storage_root(&app)?;
        let target = storage_root.join(&name);

        if !target.exists() {
            return Err("Imported mod was not found".into());
        }

        fs::remove_dir_all(target).map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_active_mods(
    app: tauri::AppHandle,
    game_path: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage_root = get_mod_storage_root(&app)?;
        let game_root = PathBuf::from(game_path);
        let targets = game_targets(&game_root);
        let mods = read_stored_mods(&storage_root)?;

        Ok(active_mod_names(&mods, &targets))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn apply_mod_selection(
    _app: tauri::AppHandle,
    game_path: String,
    selected_mods: Vec<String>,
    pak_categories: HashMap<String, Vec<String>>,
    hide_uid_enabled: Option<bool>,
    hide_ping_enabled: Option<bool>,
    anticensor_enabled: Option<bool>,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::app::elevated::run_apply_mod_selection_elevated(
            crate::app::elevated::ElevatedApplyModsRequest {
                game_path,
                selected_mods,
                pak_categories,
                hide_uid_enabled,
                hide_ping_enabled,
                anticensor_enabled,
            },
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn apply_mod_selection_inner(
    game_path: String,
    selected_mods: Vec<String>,
    pak_categories: HashMap<String, Vec<String>>,
) -> Result<Vec<String>, String> {
    let storage_root = std::env::current_exe()
        .map_err(|_| "Failed to resolve app executable".to_string())?
        .parent()
        .map(|parent| parent.join("NTEMM_Mods"))
        .ok_or_else(|| "Failed to resolve app folder".to_string())?;

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

#[tauri::command(rename_all = "camelCase")]
pub async fn get_mod_install_statuses(
    app: tauri::AppHandle,
    game_path: String,
) -> Result<Vec<ModInstallStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage_root = get_mod_storage_root(&app)?;
        let game_root = PathBuf::from(game_path);
        let targets = game_targets(&game_root);
        let mods = read_stored_mods(&storage_root)?;
        let category_dirs = category_dirs(&targets.pak_target);

        let mut statuses = Vec::with_capacity(mods.len());

        for mod_info in mods {
            let (installed_files, missing_files) = if mod_info.is_pak {
                installed_pak_files(&mod_info, &targets.pak_target, &category_dirs)
            } else if mod_info.is_asi {
                installed_asi_files(&mod_info, &targets.asi_target)
            } else {
                (0, Vec::new())
            };

            let expected_files = mod_info.files.len();
            let status = if installed_files == 0 {
                "disabled"
            } else if installed_files == expected_files {
                "enabled"
            } else {
                "needs_fix"
            };

            statuses.push(ModInstallStatus {
                name: mod_info.name,
                status: status.to_string(),
                installed_files,
                expected_files,
                missing_files,
            });
        }

        Ok(statuses)
    })
    .await
    .map_err(|e| e.to_string())?
}
