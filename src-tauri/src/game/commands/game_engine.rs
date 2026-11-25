pub use super::structs::EngineIniCheck;

#[tauri::command(rename_all = "camelCase")]
pub async fn check_engine_ini(path: String) -> Result<EngineIniCheck, String> {
    super::game_engine_functions::check_engine_ini_inner(path).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn detect_engine_ini_for_game(
    game_path: String,
) -> Result<EngineIniCheck, String> {
    super::game_engine_functions::detect_engine_ini_for_game_inner(game_path).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_ui_scale(
    game_path: String,
    scale: f32,
) -> Result<EngineIniCheck, String> {
    super::game_engine_functions::set_ui_scale_inner(game_path, scale).await
}
