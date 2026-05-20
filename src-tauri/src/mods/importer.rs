use serde::{Deserialize, Serialize};
use std::process::Command;
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};
use tauri::path::BaseDirectory;
use tauri::Manager;
use walkdir::WalkDir;
use zip::ZipArchive;

#[derive(Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub mod_name: String,
    pub output_path: String,
    pub warnings: Vec<String>,
    pub copied_files: Vec<String>,
}

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
    pub metadata: Option<ModMetadata>,
    pub metadata_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAnalysis {
    pub suggested_name: Option<String>,
    pub name_conflict: bool,
}

#[tauri::command(rename_all = "camelCase")]
pub fn analyze_import_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<ImportAnalysis, String> {
    if paths.is_empty() {
        return Err("No files were dropped".into());
    }

    let storage_root = get_mod_storage_root(&app)?;

    let temp_dir = std::env::temp_dir().join("NTEMM_analyze_import");

    if temp_dir.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
    }

    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let mut source_files = Vec::new();

    for raw in &paths {
        let path = PathBuf::from(raw);

        if path.is_dir() {
            collect_supported_files(&path, &mut source_files);
            continue;
        }

        if is_archive(&path) {
            extract_archive(&app, &path, &temp_dir)?;
            collect_supported_files(&temp_dir, &mut source_files);
            continue;
        }

        if is_supported_file(&path) {
            source_files.push(path);
        }
    }

    if source_files.is_empty() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("No supported mod files found. Support PAK and ASI mods".into());
    }

    validate_pak_sets(&source_files)?;

    let suggested_name = source_files
        .iter()
        .find(|file| {
            file.file_name()
                .map(|name| name.to_string_lossy().eq_ignore_ascii_case("mod.json"))
                .unwrap_or(false)
        })
        .and_then(|file| fs::read_to_string(file).ok())
        .and_then(|content| serde_json::from_str::<ModMetadata>(&content).ok())
        .and_then(|metadata| metadata.name)
        .map(|name| sanitize_filename::sanitize(name.trim()));

    let name_conflict = suggested_name
        .as_ref()
        .map(|name| storage_root.join(name).exists())
        .unwrap_or(false);

    let _ = fs::remove_dir_all(&temp_dir);

    Ok(ImportAnalysis {
        suggested_name,
        name_conflict,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn import_mod_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
    mod_name: String,
    overwrite: bool,
) -> Result<ImportResult, String> {
    if paths.is_empty() {
        return Err("No files were dropped".into());
    }

    let storage_root = get_mod_storage_root(&app)?;
    fs::create_dir_all(&storage_root).map_err(|e| e.to_string())?;

    let mod_name = sanitize_filename::sanitize(mod_name.trim());

    if mod_name.is_empty() {
        return Err("Mod name cannot be empty".into());
    }

    let output_dir = storage_root.join(&mod_name);

    if output_dir.exists() {
        if !overwrite {
            return Err("A mod with this name already exists".into());
        }

        fs::remove_dir_all(&output_dir).map_err(|e| e.to_string())?;
    }

    fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    let temp_dir = output_dir.join("_temp_extract");
    let mut source_files = Vec::new();

    for raw in paths {
        let path = PathBuf::from(raw);

        if path.is_dir() {
            collect_supported_files(&path, &mut source_files);
            continue;
        }

        if is_archive(&path) {
            fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
            extract_archive(&app, &path, &temp_dir)?;
            collect_supported_files(&temp_dir, &mut source_files);
            continue;
        }

        if is_supported_file(&path) {
            source_files.push(path);
        }
    }

    if source_files.is_empty() {
        return Err("No supported mod files found. Support PAK and ASI mods".into());
    }

    validate_pak_sets(&source_files)?;

    let mut copied_files = Vec::new();

    for file in source_files {
        let file_name = file
            .file_name()
            .ok_or("Invalid file name")?
            .to_string_lossy()
            .to_string();

        let dest = output_dir.join(&file_name);

        fs::copy(&file, &dest).map_err(|e| e.to_string())?;
        copied_files.push(file_name);
    }

    if temp_dir.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
    }

    Ok(ImportResult {
        success: true,
        mod_name,
        output_path: output_dir.to_string_lossy().to_string(),
        warnings: Vec::new(),
        copied_files,
    })
}

pub fn get_mod_storage_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            return Ok(parent.join("NTEMM_Mods"));
        }
    }

    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("NTEMM_Mods"))
}

fn collect_supported_files(root: &Path, out: &mut Vec<PathBuf>) {
    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        let path = entry.path();

        if path.is_file() && is_supported_file(path) {
            out.push(path.to_path_buf());
        }
    }
}

fn is_supported_file(path: &Path) -> bool {
    matches!(
        ext(path).as_str(),
        "pak" | "ucas" | "utoc" | "asi" | "ini" | "json"
    )
}

fn is_archive(path: &Path) -> bool {
    matches!(ext(path).as_str(), "zip" | "rar" | "7z")
}

fn ext(path: &Path) -> String {
    path.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn extract_archive(
    app: &tauri::AppHandle,
    archive_path: &Path,
    output_dir: &Path,
) -> Result<(), String> {
    match ext(archive_path).as_str() {
        "zip" => extract_zip_native(archive_path, output_dir),
        "rar" | "7z" => extract_with_7zip(app, archive_path, output_dir),
        _ => Err("Unsupported archive format".into()),
    }
}

fn extract_zip_native(zip_path: &Path, output_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;

        let Some(enclosed) = file.enclosed_name() else {
            continue;
        };

        let out_path = output_dir.join(enclosed);

        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            let mut out_file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out_file).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn extract_with_7zip(
    app: &tauri::AppHandle,
    archive_path: &Path,
    output_dir: &Path,
) -> Result<(), String> {
    let bundled_7za = app.path().resolve("resources/binaries/7z.exe", BaseDirectory::Resource).ok();

    let mut command = if let Some(path) = bundled_7za {
        Command::new(path)
    } else {
        Command::new("7z")
    };

    let status = command
        .arg("x")
        .arg(archive_path.to_string_lossy().to_string())
        .arg(format!("-o{}", output_dir.to_string_lossy().to_string()))
        .arg("-y")
        .status()
        .map_err(|_| "7-Zip extractor was not found. Missing bundled 7z.exe or 7z.dll".to_string())?;

    if !status.success() {
        return Err("Failed to extract archive".into());
    }

    Ok(())
}

fn validate_pak_sets(files: &[PathBuf]) -> Result<(), String> {
    let mut grouped: HashMap<String, HashSet<String>> = HashMap::new();

    for file in files {
        let e = ext(file);

        if e != "pak" && e != "ucas" && e != "utoc" {
            continue;
        }

        let stem = file
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        grouped.entry(stem).or_default().insert(e);
    }

    for (name, exts) in grouped {
        let mut missing = Vec::new();

        for required in ["pak", "ucas", "utoc"] {
            if !exts.contains(required) {
                missing.push(required);
            }
        }

        if !missing.is_empty() {
            return Err(format!(
                "PAK mod \"{}\" is incomplete.\nMissing files: {}",
                name,
                missing
                    .iter()
                    .map(|e| format!("{}.{}", name, e))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
    }

    Ok(())
}

fn load_mod_metadata(mod_path: &Path) -> (Option<ModMetadata>, Option<String>) {
    let metadata_path = mod_path.join("mod.json");

    if !metadata_path.exists() {
        return (None, None);
    }

    match fs::read_to_string(&metadata_path) {
        Ok(content) => match serde_json::from_str::<ModMetadata>(&content) {
            Ok(metadata) => (Some(metadata), None),
            Err(err) => (None, Some(format!("Invalid mod.json: {}", err))),
        },

        Err(err) => (None, Some(format!("Failed to read mod.json: {}", err))),
    }
}

#[tauri::command]
pub fn list_imported_mods(app: tauri::AppHandle) -> Result<Vec<ImportedMod>, String> {
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

        let mut files = Vec::new();

        for file in WalkDir::new(&path).into_iter().filter_map(Result::ok) {
            if file.path().is_file() {
                if let Some(file_name) = file.path().file_name() {
                    if is_internal_pak_helper_file(file_name) {
                        continue;
                    }

                    files.push(file_name.to_string_lossy().to_string());
                }
            }
        }

        let icon_path = path.join("icon.png");

        let (metadata, metadata_error) = load_mod_metadata(&path);

        mods.push(ImportedMod {
            name,
            path: path.to_string_lossy().to_string(),
            files,
            icon_path: icon_path
                .exists()
                .then(|| icon_path.to_string_lossy().to_string()),
            metadata,
            metadata_error,
        });
    }

    Ok(mods)
}

#[tauri::command]
pub fn remove_imported_mod(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let storage_root = get_mod_storage_root(&app)?;
    let target = storage_root.join(&name);

    if !target.exists() {
        return Err("Imported mod was not found".into());
    }

    fs::remove_dir_all(target).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn validate_mod_paths(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No files were dropped".into());
    }

    let mut source_files = Vec::new();

    for raw in paths {
        let path = PathBuf::from(raw);

        if path.is_dir() {
            collect_supported_files(&path, &mut source_files);
            continue;
        }

        if is_archive(&path) {
            let temp_dir = std::env::temp_dir().join("NTEMM_validate_archive");

            if temp_dir.exists() {
                let _ = fs::remove_dir_all(&temp_dir);
            }

            fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
            extract_archive(&app, &path, &temp_dir)?;
            collect_supported_files(&temp_dir, &mut source_files);

            let _ = fs::remove_dir_all(&temp_dir);
            continue;
        }

        if is_supported_file(&path) {
            source_files.push(path);
        }
    }

    if source_files.is_empty() {
        return Err("No supported mod files found. Support PAK and ASI mods".into());
    }

    validate_pak_sets(&source_files)?;

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_active_mods(app: tauri::AppHandle, game_path: String) -> Result<Vec<String>, String> {
    let storage_root = get_mod_storage_root(&app)?;
    let game_root = PathBuf::from(game_path);

    let pak_target = game_root
        .join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Content")
        .join("Paks")
        .join("~mods");

    let asi_target = game_root
        .join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Binaries")
        .join("Win64");

    let mut active = Vec::new();

    if !storage_root.exists() {
        return Ok(active);
    }

    for entry in fs::read_dir(storage_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let mod_dir = entry.path();

        if !mod_dir.is_dir() {
            continue;
        }

        let mod_name = entry.file_name().to_string_lossy().to_string();
        let mut files = get_mod_files(&mod_dir)?;

        files.retain(|file| {
            file.file_name()
                .map(|name| !is_internal_pak_helper_file(name))
                .unwrap_or(true)
        });

        let is_pak = files.iter().any(|f| ext(f) == "pak");
        let is_asi = files.iter().any(|f| ext(f) == "asi");

        let enabled = if is_pak {
            files.iter().all(|file| {
                let Some(name) = file.file_name() else {
                    return false;
                };

                let direct_path = pak_target.join(&mod_name).join(name);

                let categorized_path = fs::read_dir(&pak_target)
                    .ok()
                    .into_iter()
                    .flat_map(|r| r.filter_map(Result::ok))
                    .map(|e| e.path().join(&mod_name).join(name))
                    .find(|p| p.exists());

                direct_path.exists() || categorized_path.is_some()
            })
        } else if is_asi {
            files.iter().all(|file| {
                let Some(name) = file.file_name() else {
                    return false;
                };

                asi_target.join(name).exists()
            })
        } else {
            false
        };

        if enabled {
            active.push(mod_name);
        }
    }

    Ok(active)
}

#[tauri::command(rename_all = "camelCase")]
pub fn apply_mod_selection(
    app: tauri::AppHandle,
    game_path: String,
    selected_mods: Vec<String>,
    pak_categories: HashMap<String, Vec<String>>,
) -> Result<Vec<String>, String> {
    let storage_root = get_mod_storage_root(&app)?;
    let game_root = PathBuf::from(game_path);

    let pak_target = game_root
        .join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Content")
        .join("Paks")
        .join("~mods");

    let asi_target = game_root
        .join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Binaries")
        .join("Win64");

    fs::create_dir_all(&pak_target).map_err(|e| e.to_string())?;
    fs::create_dir_all(&asi_target).map_err(|e| e.to_string())?;

    let selected: std::collections::HashSet<String> = selected_mods.into_iter().collect();

    let mut mod_category_lookup: HashMap<String, String> = HashMap::new();

    for (category_name, mods) in &pak_categories {
        for mod_name in mods {
            mod_category_lookup.insert(mod_name.clone(), category_name.clone());
        }
    }

    if !storage_root.exists() {
        return Ok(Vec::new());
    }

    for entry in fs::read_dir(&storage_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let mod_dir = entry.path();

        if !mod_dir.is_dir() {
            continue;
        }

        let mod_name = entry.file_name().to_string_lossy().to_string();
        let mut files = get_mod_files(&mod_dir)?;

        files.retain(|file| {
            file.file_name()
                .map(|name| !is_internal_pak_helper_file(name))
                .unwrap_or(true)
        });

        let is_pak = files.iter().any(|f| ext(f) == "pak");
        let is_asi = files.iter().any(|f| ext(f) == "asi");

        if selected.contains(&mod_name) {
            if is_pak {
                remove_pak_mod_from_all_locations(&pak_target, &mod_name)?;

                let target_dir = if let Some(category_name) = mod_category_lookup.get(&mod_name) {
                    pak_target.join(category_name).join(&mod_name)
                } else {
                    pak_target.join(&mod_name)
                };

                fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

                for file in &files {
                    let Some(name) = file.file_name() else {
                        continue;
                    };

                    if is_internal_pak_helper_file(name) {
                        continue;
                    }

                    fs::copy(file, target_dir.join(name)).map_err(|e| e.to_string())?;
                }

                let stored_icon = mod_dir.join("icon.ico");

                if stored_icon.exists() {
                    crate::mods::folder_icon::apply_folder_icon(
                        target_dir.to_string_lossy().to_string(),
                        stored_icon.to_string_lossy().to_string(),
                    )?;
                }
            }

            if is_asi {
                for file in &files {
                    if let Some(name) = file.file_name() {
                        fs::copy(file, asi_target.join(name)).map_err(|e| e.to_string())?;
                    }
                }
            }
        } else {
            if is_pak {
                remove_pak_mod_from_all_locations(&pak_target, &mod_name)?;
            }

            if is_asi {
                for file in &files {
                    if let Some(name) = file.file_name() {
                        let target_file = asi_target.join(name);

                        if target_file.exists() {
                            fs::remove_file(target_file).map_err(|e| e.to_string())?;
                        }

                        if ext(file) == "asi" {
                            if let Some(stem) = file.file_stem() {
                                let log_file =
                                    asi_target.join(format!("{}.log", stem.to_string_lossy()));

                                if log_file.exists() {
                                    let _ = fs::remove_file(log_file);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    get_active_mods(app, game_root.to_string_lossy().to_string())
}

fn get_mod_files(mod_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();

    for entry in fs::read_dir(mod_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_file() {
            files.push(path);
        }
    }

    Ok(files)
}

fn is_internal_pak_helper_file(name: &std::ffi::OsStr) -> bool {
    let name = name.to_string_lossy();

    name.eq_ignore_ascii_case("icon.ico")
        || name.eq_ignore_ascii_case("icon.png")
        || name.eq_ignore_ascii_case("desktop.ini")
        || name.eq_ignore_ascii_case("mod.json")
}

fn remove_pak_mod_from_all_locations(pak_target: &Path, mod_name: &str) -> Result<(), String> {
    let direct = pak_target.join(mod_name);

    if direct.exists() {
        fs::remove_dir_all(&direct).map_err(|e| e.to_string())?;
    }

    if pak_target.exists() {
        for entry in fs::read_dir(pak_target).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();

            if !path.is_dir() {
                continue;
            }

            let categorized = path.join(mod_name);

            if categorized.exists() {
                fs::remove_dir_all(&categorized).map_err(|e| e.to_string())?;
            }

            if fs::read_dir(&path)
                .map_err(|e| e.to_string())?
                .next()
                .is_none()
            {
                let _ = fs::remove_dir_all(&path);
            }
        }
    }

    Ok(())
}

#[derive(Serialize)]
pub struct ModInstallStatus {
    pub name: String,
    pub status: String,
    pub installed_files: usize,
    pub expected_files: usize,
    pub missing_files: Vec<String>,
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_mod_install_statuses(
    app: tauri::AppHandle,
    game_path: String,
) -> Result<Vec<ModInstallStatus>, String> {
    let storage_root = get_mod_storage_root(&app)?;
    let game_root = PathBuf::from(game_path);

    let pak_target = game_root
        .join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Content")
        .join("Paks")
        .join("~mods");

    let asi_target = game_root
        .join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Binaries")
        .join("Win64");

    let mut statuses = Vec::new();

    if !storage_root.exists() {
        return Ok(statuses);
    }

    for entry in fs::read_dir(storage_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let mod_dir = entry.path();

        if !mod_dir.is_dir() {
            continue;
        }

        let mod_name = entry.file_name().to_string_lossy().to_string();
        let mut files = get_mod_files(&mod_dir)?;

        files.retain(|file| {
            file.file_name()
                .map(|name| !is_internal_pak_helper_file(name))
                .unwrap_or(true)
        });

        let is_pak = files.iter().any(|f| ext(f) == "pak");
        let is_asi = files.iter().any(|f| ext(f) == "asi");

        let mut installed_files = 0;
        let mut missing_files = Vec::new();

        for file in files.iter() {
            let Some(name) = file.file_name() else {
                continue;
            };

            let target_file = if is_pak {
                {
                    let direct = pak_target.join(&mod_name).join(name);

                    if direct.exists() {
                        direct
                    } else {
                        fs::read_dir(&pak_target)
                            .ok()
                            .into_iter()
                            .flat_map(|r| r.filter_map(Result::ok))
                            .map(|e| e.path().join(&mod_name).join(name))
                            .find(|p| p.exists())
                            .unwrap_or(direct)
                    }
                }
            } else if is_asi {
                asi_target.join(name)
            } else {
                continue;
            };

            if target_file.exists() {
                installed_files += 1;
            } else {
                missing_files.push(name.to_string_lossy().to_string());
            }
        }

        let expected_files = files.len();

        let status = if installed_files == 0 {
            "disabled"
        } else if installed_files == expected_files {
            "enabled"
        } else {
            "needs_fix"
        };

        statuses.push(ModInstallStatus {
            name: mod_name,
            status: status.to_string(),
            installed_files,
            expected_files,
            missing_files,
        });
    }

    Ok(statuses)
}
