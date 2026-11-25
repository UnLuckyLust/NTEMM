pub use super::loader_functions::{
    check_loader_files_inner,
    clean_game_mods_inner,
    install_loader_files_inner,
    loader_target_dir,
    uninstall_loader_files_inner,
};
pub use super::structs::LoaderFilesCheck;

#[tauri::command(rename_all = "camelCase")]
pub async fn check_loader_files(
    path: String,
    proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    super::loader_functions::check_loader_files_command_inner(path, proxy_dll_names).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn clean_game_mods(
    path: String,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    super::loader_functions::clean_game_mods_command_inner(path, all_proxy_dll_names).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn install_loader_files(
    path: String,
    proxy_dll_names: Option<Vec<String>>,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    super::loader_functions::install_loader_files_command_inner(
        path,
        proxy_dll_names,
        all_proxy_dll_names,
    )
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn uninstall_loader_files(
    path: String,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    super::loader_functions::uninstall_loader_files_command_inner(path, all_proxy_dll_names).await
}
