use std::path::Path;
use tauri::Manager;

use crate::app::utils::copy_if_changed;
use crate::game::loader::{check_loader_files_inner, loader_target_dir};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnticensorStatus {
    pub installed: bool,
    pub loader_installed: bool,
    pub path: String,
    pub message: String,
}

fn anticensor_target_path(path: &Path) -> std::path::PathBuf {
    loader_target_dir(path).join("Anticensor.asi")
}

fn anticensor_resource_path(resource_root: &Path) -> std::path::PathBuf {
    resource_root
        .join("mods")
        .join("Anticensor")
        .join("Anticensor.asi")
}

fn anticensor_resource_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource folder: {e}"))?
        .join("resources"))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn check_anticensor_mod(path: String) -> Result<AnticensorStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let game_path = Path::new(&path);
        let target = anticensor_target_path(game_path);
        let loader_check = check_loader_files_inner(&path);

        Ok(AnticensorStatus {
            installed: loader_check.valid && target.is_file(),
            loader_installed: loader_check.valid,
            path: target.to_string_lossy().to_string(),
            message: if loader_check.valid {
                if target.is_file() {
                    "Anticensor is installed".to_string()
                } else {
                    "Anticensor is not installed".to_string()
                }
            } else {
                "Install loader files first".to_string()
            },
        })
    })
    .await
    .map_err(|e| e.to_string())?
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
        if target.is_file() {
            std::fs::remove_file(&target)
                .map_err(|e| format!("Failed to remove Anticensor.asi: {e}"))?;
        }

        return Ok(AnticensorStatus {
            installed: false,
            loader_installed: false,
            path: target.to_string_lossy().to_string(),
            message: "Install loader files first".to_string(),
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
    } else if target.is_file() {
        std::fs::remove_file(&target)
            .map_err(|e| format!("Failed to remove Anticensor.asi: {e}"))?;
    }

    Ok(AnticensorStatus {
        installed: target.is_file(),
        loader_installed: true,
        path: target.to_string_lossy().to_string(),
        message: if target.is_file() {
            "Anticensor is installed".to_string()
        } else {
            "Anticensor is not installed".to_string()
        },
    })
}

pub fn set_anticensor_mod_inner(
    resource_root: &Path,
    path: String,
    enabled: bool,
) -> Result<AnticensorStatus, String> {
    let loader_check = check_loader_files_inner(&path);

    set_anticensor_mod_inner_with_loader_status(resource_root, path, enabled, loader_check.valid)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_anticensor_mod(
    app: tauri::AppHandle,
    path: String,
    enabled: bool,
) -> Result<AnticensorStatus, String> {
    let resource_root = anticensor_resource_root(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        set_anticensor_mod_inner(&resource_root, path, enabled)
    })
    .await
    .map_err(|e| e.to_string())?
}
