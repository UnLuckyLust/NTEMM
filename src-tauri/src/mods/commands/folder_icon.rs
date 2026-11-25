use crate::mods::import::get_mod_storage_root;

use super::folder_icon_functions::{
    apply_folder_icon_inner_impl, clear_folder_icon_attributes, refresh_folder_icon,
};
pub use super::folder_icon_functions::{save_mod_icon_from_ico, save_mod_icon_from_image};

#[tauri::command]
pub fn apply_folder_icon_inner(folder_path: String, icon_path: String) -> Result<(), String> {
    apply_folder_icon_inner_impl(folder_path, icon_path)
}

#[tauri::command]
pub async fn apply_folder_icon(folder_path: String, icon_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::app::elevated::run_folder_icon_elevated(
            crate::app::elevated::ElevatedFolderIconRequest {
                folder_path,
                icon_path,
            },
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_pak_mod_icon(
    app: tauri::AppHandle,
    mod_name: String,
    icon_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::path::Path;

        let storage_root = get_mod_storage_root(&app)?;
        let mod_folder = storage_root.join(&mod_name);

        save_mod_icon_from_image(Path::new(&icon_path), &mod_folder)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn clear_pak_mod_icon(app: tauri::AppHandle, mod_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::fs;

        let storage_root = get_mod_storage_root(&app)?;
        let mod_folder = storage_root.join(&mod_name);

        let ico = mod_folder.join("icon.ico");
        let preview = mod_folder.join("icon.png");
        let desktop_ini = mod_folder.join("desktop.ini");

        clear_folder_icon_attributes(&mod_folder, &desktop_ini);

        if ico.exists() {
            let _ = fs::remove_file(&ico);
        }

        if preview.exists() {
            let _ = fs::remove_file(&preview);
        }

        if desktop_ini.exists() {
            let _ = fs::remove_file(&desktop_ini);
        }

        refresh_folder_icon(&mod_folder);

        if let Some(parent) = mod_folder.parent() {
            refresh_folder_icon(parent);
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
