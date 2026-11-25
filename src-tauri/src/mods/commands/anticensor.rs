use std::path::Path;

use crate::game::loader::check_loader_files_inner;

use super::anticensor_functions::{anticensor_resource_root, anticensor_target_path};
pub use super::anticensor_functions::{
    set_anticensor_mod_inner, set_anticensor_mod_inner_with_loader_status,
};
pub use super::structs::AnticensorStatus;

#[tauri::command(rename_all = "camelCase")]
pub async fn check_anticensor_mod(path: String) -> Result<AnticensorStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let game_path = Path::new(&path);
        let target = anticensor_target_path(game_path);
        let loader_check = check_loader_files_inner(&path, None);

        let installed = target.is_file();

        Ok(AnticensorStatus {
            installed,
            loader_installed: loader_check.valid,
            path: target.to_string_lossy().to_string(),
            message_key: if installed {
                if loader_check.valid {
                    "backend.anticensorInstalled".to_string()
                } else {
                    "backend.anticensorInstalledLoaderMissing".to_string()
                }
            } else {
                "backend.anticensorNotInstalled".to_string()
            },
        })
    })
    .await
    .map_err(|e| e.to_string())?
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
