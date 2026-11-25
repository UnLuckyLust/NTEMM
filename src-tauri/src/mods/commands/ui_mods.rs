use std::path::Path;

use crate::game::{game::validate, loader::check_loader_files_inner};

use super::ui_mods_functions::{
    current_status, ui_mod_info, ui_mod_installed, ui_mod_resource_root, ui_mods_target_root,
};
pub use super::ui_mods_functions::{
    remove_all_ui_mods, set_ui_mod_inner, set_ui_mod_inner_with_loader_status,
};
pub use super::structs::UiModsStatus;

#[tauri::command(rename_all = "camelCase")]
pub async fn check_ui_mods(path: String) -> Result<UiModsStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let game_path = Path::new(&path);

        if !validate(game_path).valid {
            return Ok(UiModsStatus {
                hide_uid_installed: false,
                hide_ping_installed: false,
                path: ui_mods_target_root(game_path).to_string_lossy().to_string(),
                message_key: "errors.invalidGameFolder".to_string(),
            });
        }

        let loader_check = check_loader_files_inner(&path, None);

        if !loader_check.valid {
            let hide_uid = ui_mod_info("hide_uid")?;
            let hide_ping = ui_mod_info("hide_ping")?;

            return Ok(UiModsStatus {
                hide_uid_installed: ui_mod_installed(game_path, &hide_uid),
                hide_ping_installed: ui_mod_installed(game_path, &hide_ping),
                path: ui_mods_target_root(game_path).to_string_lossy().to_string(),
                message_key: "backend.uiModsInstalledLoaderMissing".to_string(),
            });
        }

        current_status(game_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_ui_mod(
    app: tauri::AppHandle,
    path: String,
    mod_kind: String,
    enabled: bool,
) -> Result<UiModsStatus, String> {
    let resource_root = ui_mod_resource_root(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        set_ui_mod_inner(&resource_root, path, mod_kind, enabled)
    })
    .await
    .map_err(|e| e.to_string())?
}
