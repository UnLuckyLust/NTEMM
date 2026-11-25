use crate::mods::structs::{AnticensorStatus};
use std::path::Path;
use tauri::Manager;

use crate::app::utils::copy_if_changed;
use crate::game::loader::{check_loader_files_inner, loader_target_dir};


pub(crate) fn anticensor_target_path(path: &Path) -> std::path::PathBuf {
    loader_target_dir(path).join("Anticensor.asi")
}

fn anticensor_resource_path(resource_root: &Path) -> std::path::PathBuf {
    resource_root
        .join("mods")
        .join("Anticensor")
        .join("Anticensor.asi")
}

pub(crate) fn anticensor_resource_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource folder: {e}"))?
        .join("resources"))
}

fn remove_asi_with_log_if_exists(path: &Path) -> Result<(), String> {
    if path.is_file() {
        std::fs::remove_file(path)
            .map_err(|e| format!("Failed to remove {}: {e}", path.display()))?;
    }

    if path
        .extension()
        .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("asi"))
        .unwrap_or(false)
    {
        if let Some(stem) = path.file_stem() {
            let log_file = path.with_file_name(format!("{}.log", stem.to_string_lossy()));

            if log_file.is_file() {
                std::fs::remove_file(&log_file)
                    .map_err(|e| format!("Failed to remove {}: {e}", log_file.display()))?;
            }
        }
    }

    Ok(())
}


pub fn set_anticensor_mod_inner_with_loader_status(
    resource_root: &Path,
    path: String,
    enabled: bool,
    loader_installed: bool,
) -> Result<AnticensorStatus, String> {
    let game_path = Path::new(&path);
    let target = anticensor_target_path(game_path);

    if !loader_installed {
        remove_asi_with_log_if_exists(&target)?;

        return Ok(AnticensorStatus {
            installed: false,
            loader_installed: false,
            path: target.to_string_lossy().to_string(),
            message_key: "dialogs.installLoaderFilesFirst".to_string(),
        });
    }

    if enabled {
        let source = anticensor_resource_path(resource_root);

        if !source.is_file() {
            return Err(format!(
                "Bundled Anticensor.asi was not found: {}",
                source.display()
            ));
        }

        copy_if_changed(&source, &target)?;
    } else {
        remove_asi_with_log_if_exists(&target)?;
    }

    Ok(AnticensorStatus {
        installed: target.is_file(),
        loader_installed: true,
        path: target.to_string_lossy().to_string(),
        message_key: if target.is_file() {
            "backend.anticensorInstalled".to_string()
        } else {
            "backend.anticensorNotInstalled".to_string()
        },
    })
}

pub fn set_anticensor_mod_inner(
    resource_root: &Path,
    path: String,
    enabled: bool,
) -> Result<AnticensorStatus, String> {
    let loader_check = check_loader_files_inner(&path, None);

    set_anticensor_mod_inner_with_loader_status(resource_root, path, enabled, loader_check.valid)
}
