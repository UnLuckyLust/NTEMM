use tauri::Manager;

pub mod app;
mod game;
mod mods;
mod gamebanana;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            app::dialog::play_dialog_sound,
            app::elevated::is_app_elevated,
            game::game::auto_detect_game_folder,
            game::game::check_game_folder,
            game::game::launch_game,
            game::game_engine::detect_engine_ini_for_game,
            game::game_engine::check_engine_ini,
            game::game_engine::set_ui_scale,
            game::loader::check_loader_files,
            game::loader::install_loader_files,
            game::loader::uninstall_loader_files,
            game::loader::clean_game_mods,
            mods::import::import_mod_paths,
            mods::import::analyze_import_paths,
            mods::import::validate_mod_paths,
            mods::import::refresh_auto_mod_icons,
            mods::manage::list_imported_mods,
            mods::manage::remove_imported_mod,
            mods::manage::get_active_mods,
            mods::manage::apply_mod_selection,
            mods::manage::get_mod_install_statuses,
            mods::folder_icon::apply_folder_icon,
            mods::folder_icon::set_pak_mod_icon,
            mods::folder_icon::clear_pak_mod_icon,
            mods::anticensor::check_anticensor_mod,
            mods::anticensor::set_anticensor_mod,
            mods::ui_mods::check_ui_mods,
            mods::ui_mods::set_ui_mod,
            gamebanana::api::get_nte_mods,
            gamebanana::api::get_mod_details
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
