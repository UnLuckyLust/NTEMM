// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod game;
mod mods;

// #[tauri::command]
// fn greet(name: &str) -> String {
//     format!("Hello, {}! You've been greeted from Rust!", name)
// }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            // greet,
            game::detect::auto_detect_game_folder,
            game::detect::check_game_folder,
            game::detect::auto_detect_engine_ini,
            game::detect::check_engine_ini,
            game::detect::set_ui_scale,
            game::detect::launch_game,
            game::detect::check_loader_files,
            game::detect::install_loader_files,
            game::detect::uninstall_loader_files,
            game::detect::check_anticensor_mod,
            game::detect::set_anticensor_mod,
            mods::importer::import_mod_paths,
            mods::importer::list_imported_mods,
            mods::importer::remove_imported_mod,
            mods::importer::validate_mod_paths,
            mods::importer::analyze_import_paths,
            mods::importer::get_active_mods,
            mods::importer::apply_mod_selection,
            mods::importer::get_mod_install_statuses,
            mods::folder_icon::apply_folder_icon,
            mods::folder_icon::set_pak_mod_icon,
            mods::folder_icon::clear_pak_mod_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
