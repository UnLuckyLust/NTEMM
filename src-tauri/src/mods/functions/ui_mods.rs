use crate::mods::structs::{UiModsStatus, UiModInfo};
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::app::utils::copy_if_changed;
use crate::game::{game::validate, loader::check_loader_files_inner};


const HIDE_UID_FILES: &[&str] = &["Hide_UID_P.pak", "Hide_UID_P.ucas", "Hide_UID_P.utoc"];

const HIDE_PING_FILES: &[&str] = &["Hide_Ping_P.pak", "Hide_Ping_P.ucas", "Hide_Ping_P.utoc"];

pub(crate) fn ui_mod_info(mod_kind: &str) -> Result<UiModInfo, String> {
    match mod_kind {
        "hide_uid" => Ok(UiModInfo {
            source_folder: "Hide_UID",
            target_folder: "Hide_UID",
            files: HIDE_UID_FILES,
        }),
        "hide_ping" => Ok(UiModInfo {
            source_folder: "Hide_Ping",
            target_folder: "Hide_Ping",
            files: HIDE_PING_FILES,
        }),
        _ => Err(format!("Unknown UI mod: {mod_kind}")),
    }
}

fn paks_dir(path: &Path) -> PathBuf {
    path.join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Content")
        .join("Paks")
}

pub(crate) fn ui_mods_target_root(path: &Path) -> PathBuf {
    paks_dir(path).join("~mods").join("UI")
}

fn ui_mod_target_dir(path: &Path, info: &UiModInfo) -> PathBuf {
    ui_mods_target_root(path).join(info.target_folder)
}

fn ui_mod_source_dir(resource_root: &Path, info: &UiModInfo) -> PathBuf {
    resource_root.join("mods").join(info.source_folder)
}

pub(crate) fn ui_mod_resource_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource folder: {e}"))?
        .join("resources"))
}

pub(crate) fn ui_mod_installed(path: &Path, info: &UiModInfo) -> bool {
    let target_dir = ui_mod_target_dir(path, info);
    info.files
        .iter()
        .all(|file| target_dir.join(file).is_file())
}

fn remove_ui_mod(path: &Path, info: &UiModInfo) -> Result<(), String> {
    let target_dir = ui_mod_target_dir(path, info);

    for file in info.files {
        let target = target_dir.join(file);

        if target.exists() {
            std::fs::remove_file(&target)
                .map_err(|e| format!("Failed to remove {}: {e}", target.display()))?;
        }
    }

    remove_empty_dir(&target_dir)?;
    remove_empty_dir(&ui_mods_target_root(path))?;

    Ok(())
}

pub(crate) fn current_status(path: &Path) -> Result<UiModsStatus, String> {
    let hide_uid = ui_mod_info("hide_uid")?;
    let hide_ping = ui_mod_info("hide_ping")?;
    let target_root = ui_mods_target_root(path);

    Ok(UiModsStatus {
        hide_uid_installed: ui_mod_installed(path, &hide_uid),
        hide_ping_installed: ui_mod_installed(path, &hide_ping),
        path: target_root.to_string_lossy().to_string(),
        message_key: "backend.uiModsStatusChecked".to_string(),
    })
}

fn remove_empty_dir(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        let is_empty = std::fs::read_dir(path)
            .map_err(|e| format!("Failed to read {}: {e}", path.display()))?
            .next()
            .is_none();

        if is_empty {
            std::fs::remove_dir(path)
                .map_err(|e| format!("Failed to remove empty folder {}: {e}", path.display()))?;
        }
    }

    Ok(())
}


pub fn set_ui_mod_inner_with_loader_status(
    resource_root: &Path,
    path: String,
    mod_kind: String,
    enabled: bool,
    loader_installed: bool,
) -> Result<UiModsStatus, String> {
    let game_path = Path::new(&path);

    if !loader_installed {
        let hide_uid = ui_mod_info("hide_uid")?;
        let hide_ping = ui_mod_info("hide_ping")?;

        remove_ui_mod(game_path, &hide_uid)?;
        remove_ui_mod(game_path, &hide_ping)?;

        return Ok(UiModsStatus {
            hide_uid_installed: false,
            hide_ping_installed: false,
            path: ui_mods_target_root(game_path).to_string_lossy().to_string(),
            message_key: "dialogs.installLoaderFilesFirst".to_string(),
        });
    }

    let info = ui_mod_info(&mod_kind)?;
    let target_dir = ui_mod_target_dir(game_path, &info);

    if enabled {
        let source_dir = ui_mod_source_dir(resource_root, &info);

        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create {}: {e}", target_dir.display()))?;

        for file in info.files {
            let source = source_dir.join(file);
            let target = target_dir.join(file);

            if !source.is_file() {
                return Err(format!(
                    "Bundled UI mod file was not found: {}",
                    source.display()
                ));
            }

            copy_if_changed(&source, &target)?;
        }
    } else {
        remove_ui_mod(game_path, &info)?;
    }

    current_status(game_path)
}

pub fn set_ui_mod_inner(
    resource_root: &Path,
    path: String,
    mod_kind: String,
    enabled: bool,
) -> Result<UiModsStatus, String> {
    let game_path = Path::new(&path);

    if !validate(game_path).valid {
        return Err("errors.invalidGameFolder".to_string());
    }

    let loader_check = check_loader_files_inner(&path, None);

    set_ui_mod_inner_with_loader_status(resource_root, path, mod_kind, enabled, loader_check.valid)
}


pub fn remove_all_ui_mods(path: &Path) -> Result<(), String> {
    let hide_uid = ui_mod_info("hide_uid")?;
    let hide_ping = ui_mod_info("hide_ping")?;

    remove_ui_mod(path, &hide_uid)?;
    remove_ui_mod(path, &hide_ping)?;

    Ok(())
}
