// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if ntemm_lib::app::elevated::handle_elevated_cli() {
        return;
    }

    ntemm_lib::run()
}
