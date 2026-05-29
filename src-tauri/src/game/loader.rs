use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::app::utils::copy_if_changed;
use crate::game::game::validate;
use crate::mods::ui_mods::remove_all_ui_mods;

const DEFAULT_GLOBAL_PROXY_DLL_NAMES: &[&str] = &["version.dll"];
const DEFAULT_CN_PROXY_DLL_NAMES: &[&str] = &["dsound.dll", "dinput8.dll"];
const DEFAULT_TW_PROXY_DLL_NAMES: &[&str] = &["version.dll"];
const LEGACY_PROXY_DLL_NAMES: &[&str] = &["version.dll", "dsound.dll", "dinput8.dll"];

fn default_loader_proxy_names(game_version: &str) -> Vec<String> {
    match game_version {
        "cn" => DEFAULT_CN_PROXY_DLL_NAMES,
        "tw" => DEFAULT_TW_PROXY_DLL_NAMES,
        _ => DEFAULT_GLOBAL_PROXY_DLL_NAMES,
    }
    .iter()
    .map(|name| name.to_string())
    .collect()
}

fn normalize_loader_proxy_names(names: Option<Vec<String>>, game_version: &str) -> Vec<String> {
    let names = names.unwrap_or_else(|| default_loader_proxy_names(game_version));
    let mut normalized = Vec::new();

    for name in names {
        let name = name.trim().trim_start_matches(['/', '\\']).to_string();

        if name.is_empty()
            || !name.to_ascii_lowercase().ends_with(".dll")
            || name.contains('/')
            || name.contains('\\')
        {
            continue;
        }

        if !normalized
            .iter()
            .any(|existing: &String| existing.eq_ignore_ascii_case(&name))
        {
            normalized.push(name);
        }
    }

    normalized
}

fn normalize_all_loader_proxy_names(names: Option<Vec<String>>) -> Vec<String> {
    let mut normalized = LEGACY_PROXY_DLL_NAMES
        .iter()
        .map(|name| name.to_string())
        .collect::<Vec<_>>();

    if let Some(names) = names {
        for name in names {
            let name = name.trim().trim_start_matches(['/', '\\']).to_string();

            if name.is_empty()
                || !name.to_ascii_lowercase().ends_with(".dll")
                || name.contains('/')
                || name.contains('\\')
            {
                continue;
            }

            if !normalized
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(&name))
            {
                normalized.push(name);
            }
        }
    }

    normalized
}

pub fn loader_target_dir(path: &Path) -> std::path::PathBuf {
    path.join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Binaries")
        .join("Win64")
}

fn paks_mods_dir(path: &Path) -> PathBuf {
    path.join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Content")
        .join("Paks")
        .join("~mods")
}

fn app_mod_storage_root() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    exe.parent()
        .map(|parent| parent.join("NTEMM_Mods"))
        .ok_or_else(|| "Failed to resolve app folder".to_string())
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    if path.is_file() {
        fs::remove_file(path).map_err(|e| format!("Failed to remove {}: {e}", path.display()))?;
    }

    Ok(())
}

fn remove_file_with_matching_log_if_asi(path: &Path) -> Result<(), String> {
    remove_file_if_exists(path)?;

    if path
        .extension()
        .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("asi"))
        .unwrap_or(false)
    {
        if let Some(stem) = path.file_stem() {
            let log_file = path.with_file_name(format!("{}.log", stem.to_string_lossy()));
            remove_file_if_exists(&log_file)?;
        }
    }

    Ok(())
}

fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path)
            .map_err(|e| format!("Failed to remove {}: {e}", path.display()))?;
    }

    Ok(())
}

fn remove_imported_asi_files(game_path: &Path) -> Result<(), String> {
    let storage_root = app_mod_storage_root()?;

    if !storage_root.exists() {
        return Ok(());
    }

    let asi_target = loader_target_dir(game_path);

    for entry in fs::read_dir(storage_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let mod_dir = entry.path();

        if !mod_dir.is_dir() {
            continue;
        }

        let files = fs::read_dir(&mod_dir)
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.is_file())
            .collect::<Vec<_>>();

        let is_asi_mod = files.iter().any(|file| {
            file.extension()
                .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("asi"))
                .unwrap_or(false)
        });

        if !is_asi_mod {
            continue;
        }

        for file in files {
            let Some(name) = file.file_name() else {
                continue;
            };

            remove_file_with_matching_log_if_asi(&asi_target.join(name))?;
        }
    }

    Ok(())
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoaderFilesCheck {
    pub valid: bool,
    pub loader_dir: String,

    pub asi_found: bool,
    pub cutils_found: bool,
    pub proxy_dll_found: bool,
    pub proxy_dll_names: Vec<String>,

    pub missing_files: Vec<String>,
    pub message: String,
}

pub fn check_loader_files_inner(
    path: &str,
    proxy_dll_names: Option<Vec<String>>,
) -> LoaderFilesCheck {
    let loader_dir = loader_target_dir(Path::new(path));

    let game_check = validate(Path::new(path));
    let proxy_dll_names = normalize_loader_proxy_names(proxy_dll_names, &game_check.game_version);

    let asi_found = loader_dir.join("loader.asi").is_file();
    let cutils_found = loader_dir.join("cutils.dll").is_file();

    if proxy_dll_names.is_empty() {
        return LoaderFilesCheck {
            valid: false,
            loader_dir: loader_dir.to_string_lossy().to_string(),

            asi_found,
            cutils_found,
            proxy_dll_found: false,
            proxy_dll_names,

            missing_files: vec!["No loader DLL files selected".to_string()],
            message: "No loader DLL files selected".to_string(),
        };
    }

    let proxy_dll_found = proxy_dll_names
        .iter()
        .all(|proxy_dll_name| loader_dir.join(proxy_dll_name).is_file());

    let mut missing_files = Vec::new();

    if !asi_found {
        missing_files.push("loader.asi".to_string());
    }

    if !cutils_found {
        missing_files.push("cutils.dll".to_string());
    }

    for proxy_dll_name in &proxy_dll_names {
        if !loader_dir.join(proxy_dll_name).is_file() {
            missing_files.push(proxy_dll_name.to_string());
        }
    }

    let valid = missing_files.is_empty();

    LoaderFilesCheck {
        valid,
        loader_dir: loader_dir.to_string_lossy().to_string(),

        asi_found,
        cutils_found,
        proxy_dll_found,
        proxy_dll_names,

        missing_files,

        message: if valid {
            "Selected loader files are installed".to_string()
        } else {
            "Selected loader files are missing".to_string()
        },
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn check_loader_files(
    path: String,
    proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(check_loader_files_inner(&path, proxy_dll_names))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn install_loader_files_inner_with_resource_root(
    resource_root: &Path,
    path: String,
    proxy_dll_names: Option<Vec<String>>,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    let game_path = Path::new(&path);
    let loader_dir = loader_target_dir(game_path);

    std::fs::create_dir_all(&loader_dir)
        .map_err(|e| format!("Failed to create loader folder: {e}"))?;

    let game_check = validate(game_path);

    if !game_check.valid {
        return Err("Invalid game folder".to_string());
    }

    let proxy_dll_names = normalize_loader_proxy_names(proxy_dll_names, &game_check.game_version);
    let all_proxy_dll_names = normalize_all_loader_proxy_names(all_proxy_dll_names);

    let bundled_loader_dir = resource_root.join("loader");

    let base_files = [
        (
            bundled_loader_dir.join("loader.asi"),
            loader_dir.join("loader.asi"),
        ),
        (
            bundled_loader_dir.join("subloader.dll"),
            loader_dir.join("cutils.dll"),
        ),
    ];

    for (source, target) in base_files {
        if !source.is_file() {
            return Err(format!(
                "Bundled loader file not found: {}",
                source.display()
            ));
        }

        copy_if_changed(&source, &target)?;
    }

    let loader_dll_source = bundled_loader_dir.join("loader.dll");

    if !loader_dll_source.is_file() {
        return Err(format!(
            "Bundled loader file not found: {}",
            loader_dll_source.display()
        ));
    }

    for proxy_dll_name in &all_proxy_dll_names {
        if !proxy_dll_names
            .iter()
            .any(|selected| selected.eq_ignore_ascii_case(proxy_dll_name))
        {
            remove_file_if_exists(&loader_dir.join(proxy_dll_name))?;
        }
    }

    for proxy_dll_name in &proxy_dll_names {
        copy_if_changed(&loader_dll_source, &loader_dir.join(proxy_dll_name))?;
    }

    Ok(check_loader_files_inner(&path, Some(proxy_dll_names)))
}

pub fn install_loader_files_inner(
    resource_root: &Path,
    path: String,
    proxy_dll_names: Option<Vec<String>>,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    install_loader_files_inner_with_resource_root(
        resource_root,
        path,
        proxy_dll_names,
        all_proxy_dll_names,
    )
}

pub fn uninstall_loader_files_inner(
    path: String,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    let loader_dir = loader_target_dir(Path::new(&path));
    let game_check = validate(Path::new(&path));

    if !game_check.valid {
        return Err("Invalid game folder".to_string());
    }

    let files = [
        loader_dir.join("loader.asi"),
        loader_dir.join("cutils.dll"),
        loader_dir.join("Anticensor.asi"),
        loader_dir.join("AyakaNTEModLoader.asi"),
    ];

    for file in files {
        remove_file_with_matching_log_if_asi(&file)?;
    }

    for proxy_dll_name in normalize_all_loader_proxy_names(all_proxy_dll_names) {
        remove_file_if_exists(&loader_dir.join(proxy_dll_name))?;
    }

    remove_all_ui_mods(Path::new(&path))?;

    Ok(check_loader_files_inner(&path, None))
}

pub fn clean_game_mods_inner(
    path: String,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    let game_path = Path::new(&path);
    let game_check = validate(game_path);

    if !game_check.valid {
        return Err("Invalid game folder".to_string());
    }

    let loader_dir = loader_target_dir(game_path);

    remove_dir_if_exists(&paks_mods_dir(game_path))?;
    remove_imported_asi_files(game_path)?;

    let files = [
        loader_dir.join("loader.asi"),
        loader_dir.join("cutils.dll"),
        loader_dir.join("Anticensor.asi"),
        loader_dir.join("AyakaNTEModLoader.asi"),
    ];

    for file in files {
        remove_file_with_matching_log_if_asi(&file)?;
    }

    for proxy_dll_name in normalize_all_loader_proxy_names(all_proxy_dll_names) {
        remove_file_if_exists(&loader_dir.join(proxy_dll_name))?;
    }

    remove_all_ui_mods(game_path)?;

    Ok(check_loader_files_inner(&path, None))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn clean_game_mods(
    path: String,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::app::elevated::run_loader_files_elevated(
            crate::app::elevated::ElevatedLoaderFilesRequest {
                path,
                install: false,
                clean: true,
                proxy_dll_names: None,
                all_proxy_dll_names,
            },
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn install_loader_files(
    path: String,
    proxy_dll_names: Option<Vec<String>>,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::app::elevated::run_loader_files_elevated(
            crate::app::elevated::ElevatedLoaderFilesRequest {
                path,
                install: true,
                clean: false,
                proxy_dll_names,
                all_proxy_dll_names,
            },
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn uninstall_loader_files(
    path: String,
    all_proxy_dll_names: Option<Vec<String>>,
) -> Result<LoaderFilesCheck, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::app::elevated::run_loader_files_elevated(
            crate::app::elevated::ElevatedLoaderFilesRequest {
                path,
                install: false,
                clean: false,
                proxy_dll_names: None,
                all_proxy_dll_names,
            },
        )
    })
    .await
    .map_err(|e| e.to_string())?
}