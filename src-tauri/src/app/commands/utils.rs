pub use super::utils_functions::{copy_if_changed, open_folder_inner};

#[tauri::command(rename_all = "camelCase")]
pub fn open_folder(path: String) -> Result<(), String> {
    super::elevated_functions::run_open_folder_elevated(super::structs::ElevatedOpenFolderRequest {
        path,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_ntemm_mods_dir() -> Result<String, String> {
    super::utils_functions::get_ntemm_mods_dir_inner()
}
