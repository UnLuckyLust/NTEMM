use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
};

use crate::mods::import::get_mod_storage_root;

use super::manage_functions::{
    active_mod_names, category_dirs, game_targets, get_mod_files, get_preview_image_paths,
    installed_asi_files, installed_pak_files, load_mod_metadata, read_stored_mods,
};
pub use super::manage_functions::apply_mod_selection_inner;
pub use super::structs::{ImportedMod, ModInstallStatus};

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
            return Err("errors.importedModNotFound".into());
        }

        fs::remove_dir_all(target).map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn rename_imported_mod(
    app: tauri::AppHandle,
    old_name: String,
    new_name: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage_root = get_mod_storage_root(&app)?;
        let new_name = sanitize_filename::sanitize(new_name.trim());

        if new_name.is_empty() {
            return Err("errors.modNameEmpty".into());
        }

        let source = storage_root.join(&old_name);

        if !source.is_dir() {
            return Err("errors.importedModNotFound".into());
        }

        if old_name == new_name {
            return Ok(new_name);
        }

        let target = storage_root.join(&new_name);

        if old_name.eq_ignore_ascii_case(&new_name) {
            let temp_name = format!(
                ".rename_tmp_{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_millis()
            );

            let temp = storage_root.join(temp_name);

            fs::rename(&source, &temp).map_err(|e| e.to_string())?;
            fs::rename(&temp, &target).map_err(|e| e.to_string())?;

            return Ok(new_name);
        }

        if target.exists() {
            return Err("errors.modNameExists".into());
        }

        fs::rename(source, target).map_err(|e| e.to_string())?;

        Ok(new_name)
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
