pub use super::game_functions::validate;
pub use super::structs::GameFolderCheck;

#[tauri::command(rename_all = "camelCase")]
pub async fn launch_game(path: String) -> Result<(), String> {
    super::game_functions::launch_game_inner(path).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn auto_detect_game_folder(
    version: Option<String>,
) -> Result<GameFolderCheck, String> {
    super::game_functions::auto_detect_game_folder_inner(version).await
}

#[tauri::command]
pub async fn check_game_folder(path: String) -> Result<GameFolderCheck, String> {
    super::game_functions::check_game_folder_inner(path).await
}
