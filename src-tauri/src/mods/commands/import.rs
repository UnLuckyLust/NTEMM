use std::{fs, path::PathBuf};

use super::import_functions::{
    auto_apply_known_mod_icon, collect_single_supported_file, collect_supported_files,
    extract_archive, has_mod_payload, is_archive, refresh_auto_mod_icons_inner,
    strip_single_wrapper_folder, validate_ini_requires_asi, validate_pak_sets,
};
pub use super::import_functions::{ext, get_mod_storage_root, is_preview_image_file_name};
pub use super::structs::{ImportAnalysis, ImportResult};
use super::structs::ModMetadata;

#[tauri::command(rename_all = "camelCase")]
pub async fn analyze_import_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<ImportAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if paths.is_empty() {
            return Err("errors.noFilesDropped".into());
        }

        let storage_root = get_mod_storage_root(&app)?;

        let temp_dir = std::env::temp_dir().join(format!("NTEMM_analyze_import_{}", uuid::Uuid::new_v4()));

        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }

        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

        let mut source_files = Vec::new();

        for raw in &paths {
            let path = PathBuf::from(raw);

            if path.is_dir() {
                collect_supported_files(&path, &path, &mut source_files);
                continue;
            }

            if is_archive(&path) {
                extract_archive(&app, &path, &temp_dir)?;

                let before_count = source_files.len();
                collect_supported_files(&temp_dir, &temp_dir, &mut source_files);
                strip_single_wrapper_folder(&mut source_files[before_count..]);
                continue;
            }

            collect_single_supported_file(&path, &mut source_files);
        }

        if source_files.is_empty() {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err("errors.noSupportedModFiles".into());
        }

        if !has_mod_payload(&source_files) {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err("errors.noModPayloadFiles".into());
        }

        validate_pak_sets(&source_files)?;
        validate_ini_requires_asi(&source_files)?;

        let suggested_name = source_files
            .iter()
            .find(|file| {
                file.path
                    .file_name()
                    .map(|name| name.to_string_lossy().eq_ignore_ascii_case("mod.json"))
                    .unwrap_or(false)
            })
            .and_then(|file| fs::read_to_string(&file.path).ok())
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
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn refresh_auto_mod_icons(app: tauri::AppHandle) -> Result<u32, String> {
    tauri::async_runtime::spawn_blocking(move || refresh_auto_mod_icons_inner(&app))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn import_mod_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
    mod_name: String,
    overwrite: bool,
) -> Result<ImportResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if paths.is_empty() {
            return Err("errors.noFilesDropped".into());
        }

        let storage_root = get_mod_storage_root(&app)?;
        fs::create_dir_all(&storage_root).map_err(|e| e.to_string())?;

        let mod_name = sanitize_filename::sanitize(mod_name.trim());

        if mod_name.is_empty() {
            return Err("errors.modNameEmpty".into());
        }

        let output_dir = storage_root.join(&mod_name);

        if output_dir.exists() {
            if !overwrite {
                return Err("errors.modNameExists".into());
            }

            fs::remove_dir_all(&output_dir).map_err(|e| e.to_string())?;
        }

        fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

        let temp_dir = output_dir.join("_temp_extract");
        let mut source_files = Vec::new();

        for raw in paths {
            let path = PathBuf::from(raw);

            if path.is_dir() {
                collect_supported_files(&path, &path, &mut source_files);
                continue;
            }

            if is_archive(&path) {
                fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
                extract_archive(&app, &path, &temp_dir)?;

                let before_count = source_files.len();
                collect_supported_files(&temp_dir, &temp_dir, &mut source_files);
                strip_single_wrapper_folder(&mut source_files[before_count..]);
                continue;
            }

            collect_single_supported_file(&path, &mut source_files);
        }

        if source_files.is_empty() {
            return Err("errors.noSupportedModFiles".into());
        }

        if !has_mod_payload(&source_files) {
            return Err("errors.noModPayloadFiles".into());
        }

        validate_pak_sets(&source_files)?;
        validate_ini_requires_asi(&source_files)?;

        let mut copied_files = Vec::new();

        for file in source_files {
            let dest = output_dir.join(&file.relative_path);

            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            fs::copy(&file.path, &dest).map_err(|e| e.to_string())?;

            copied_files.push(file.relative_path.to_string_lossy().to_string());
        }

        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }

        let mut warnings = Vec::new();
        let mut warning_keys = Vec::new();

        if let Err(err) = auto_apply_known_mod_icon(&app, &output_dir, &mod_name, &copied_files) {
            warnings.push(format!("Auto icon detection failed: {err}"));
            warning_keys.push("warnings.autoIconDetectionFailed".to_string());
        }

        Ok(ImportResult {
            success: true,
            mod_name,
            output_path: output_dir.to_string_lossy().to_string(),
            warnings,
            warning_keys,
            copied_files,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn validate_mod_paths(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if paths.is_empty() {
            return Err("errors.noFilesDropped".into());
        }

        let mut source_files = Vec::new();

        for raw in paths {
            let path = PathBuf::from(raw);

            if path.is_dir() {
                collect_supported_files(&path, &path, &mut source_files);
                continue;
            }

            if is_archive(&path) {
                let temp_dir = std::env::temp_dir().join(format!("NTEMM_validate_archive_{}", uuid::Uuid::new_v4()));

                if temp_dir.exists() {
                    let _ = fs::remove_dir_all(&temp_dir);
                }

                fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
                extract_archive(&app, &path, &temp_dir)?;

                let before_count = source_files.len();
                collect_supported_files(&temp_dir, &temp_dir, &mut source_files);
                strip_single_wrapper_folder(&mut source_files[before_count..]);

                let _ = fs::remove_dir_all(&temp_dir);
                continue;
            }

            collect_single_supported_file(&path, &mut source_files);
        }

        if source_files.is_empty() {
            return Err("errors.noSupportedModFiles".into());
        }

        if !has_mod_payload(&source_files) {
            return Err("errors.noModPayloadFiles".into());
        }

        validate_pak_sets(&source_files)?;
        validate_ini_requires_asi(&source_files)?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
