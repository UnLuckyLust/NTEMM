pub use super::elevated_functions::{
    handle_elevated_cli, needs_elevation_for_path, run_apply_mod_selection_elevated,
    run_folder_icon_elevated, run_loader_files_elevated, run_open_folder_elevated,
};
pub use super::structs::{
    ElevatedApplyModsRequest, ElevatedFolderIconRequest, ElevatedLoaderFilesRequest,
    ElevatedOpenFolderRequest, ElevatedResult,
};

#[tauri::command]
pub fn is_app_elevated() -> bool {
    super::elevated_functions::is_elevated()
}
