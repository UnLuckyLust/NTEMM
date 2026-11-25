use crate::gamebanana::{
    api_functions::{get_mod_details_inner, get_nte_mods_inner},
    structs::{GameBananaModDetails, GameBananaModsResponse},
};

#[tauri::command(rename_all = "camelCase")]
pub async fn get_nte_mods(
    app: tauri::AppHandle,
    force_refresh: bool,
) -> Result<GameBananaModsResponse, String> {
    tauri::async_runtime::spawn_blocking(move || get_nte_mods_inner(app, force_refresh))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_mod_details(
    app: tauri::AppHandle,
    mod_id: u64,
    force_refresh: bool,
) -> Result<GameBananaModDetails, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_mod_details_inner(app, mod_id, force_refresh)
    })
    .await
    .map_err(|e| e.to_string())?
}
