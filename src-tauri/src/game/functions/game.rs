use super::structs::GameFolderCheck;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

fn default_path() -> &'static Path {
    Path::new(r"C:\Program Files\Neverness To Everness")
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn push_unique(paths: &mut Vec<PathBuf>, path: PathBuf) {
    let normalized = normalize_path(&path);

    if !paths
        .iter()
        .any(|existing| normalize_path(existing) == normalized)
    {
        paths.push(path);
    }
}

fn registry_value(key: &str, value_name: &str) -> Option<String> {
    let output = Command::new("reg")
        .args(["query", key, "/v", value_name])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let output = String::from_utf8_lossy(&output.stdout);

    for line in output.lines() {
        if let Some(index) = line.find("REG_SZ") {
            let value = line[index + "REG_SZ".len()..].trim();

            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }

    None
}

fn steam_install_candidates() -> Vec<PathBuf> {
    let mut steam_roots = Vec::new();

    if let Some(path) = registry_value(
        r"HKCU\Software\Valve\Steam",
        "SteamPath",
    ) {
        push_unique(&mut steam_roots, PathBuf::from(path));
    }

    if let Some(path) = registry_value(
        r"HKLM\SOFTWARE\WOW6432Node\Valve\Steam",
        "InstallPath",
    ) {
        push_unique(&mut steam_roots, PathBuf::from(path));
    }

    if let Some(path) = registry_value(
        r"HKLM\SOFTWARE\Valve\Steam",
        "InstallPath",
    ) {
        push_unique(&mut steam_roots, PathBuf::from(path));
    }

    push_unique(
        &mut steam_roots,
        PathBuf::from(r"C:\Program Files (x86)\Steam"),
    );

    push_unique(
        &mut steam_roots,
        PathBuf::from(r"C:\Program Files\Steam"),
    );

    let mut library_roots = steam_roots.clone();

    for steam_root in &steam_roots {
        let library_file = steam_root
            .join("steamapps")
            .join("libraryfolders.vdf");

        let Ok(content) = fs::read_to_string(library_file) else {
            continue;
        };

        for line in content.lines() {
            let parts: Vec<&str> = line.split('"').collect();

            if parts.len() >= 4 && parts[1].eq_ignore_ascii_case("path") {
                let path = parts[3].replace("\\\\", "\\");
                push_unique(&mut library_roots, PathBuf::from(path));
            }
        }
    }

    let mut candidates = Vec::new();

    for library in library_roots {
        push_unique(
            &mut candidates,
            library
                .join("steamapps")
                .join("common")
                .join("Neverness to Everness"),
        );
    }

    candidates
}

fn epic_install_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(program_data) = std::env::var("PROGRAMDATA") {
        let manifests = PathBuf::from(program_data)
            .join("Epic")
            .join("EpicGamesLauncher")
            .join("Data")
            .join("Manifests");

        if let Ok(entries) = fs::read_dir(manifests) {
            for entry in entries.flatten() {
                let path = entry.path();

                if !path
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .map(|extension| extension.eq_ignore_ascii_case("item"))
                    .unwrap_or(false)
                {
                    continue;
                }

                let Ok(content) = fs::read_to_string(&path) else {
                    continue;
                };

                let Ok(json) =
                    serde_json::from_str::<serde_json::Value>(&content)
                else {
                    continue;
                };

                let Some(location) = json
                    .get("InstallLocation")
                    .and_then(|value| value.as_str())
                else {
                    continue;
                };

                let game_path = PathBuf::from(location);

                if game_path.join("NTEGlobalLauncher.exe").is_file() {
                    push_unique(&mut candidates, game_path);
                }
            }
        }
    }

    for drive in b'C'..=b'Z' {
        let drive = drive as char;

        push_unique(
            &mut candidates,
            PathBuf::from(format!(
                r"{drive}:\Epic Games\NTENevernesstoEvernezYbAx"
            )),
        );

        push_unique(
            &mut candidates,
            PathBuf::from(format!(
                r"{drive}:\Program Files\Epic Games\NTENevernesstoEvernezYbAx"
            )),
        );
    }

    candidates
}

fn standalone_install_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for drive in b'C'..=b'Z' {
        let drive = drive as char;

        push_unique(
            &mut candidates,
            PathBuf::from(format!(
                r"{drive}:\Neverness To Everness"
            )),
        );

        push_unique(
            &mut candidates,
            PathBuf::from(format!(
                r"{drive}:\Program Files\Neverness To Everness"
            )),
        );

        push_unique(
            &mut candidates,
            PathBuf::from(format!(
                r"{drive}:\Program Files (x86)\Neverness To Everness"
            )),
        );
    }

    candidates
}

fn detect_global_source(path: &Path) -> &'static str {
    let normalized = normalize_path(path);

    if normalized.contains(r"\steamapps\common\neverness to everness") {
        return "steam";
    }

    if steam_install_candidates()
        .iter()
        .any(|candidate| normalize_path(candidate) == normalized)
    {
        return "steam";
    }

    if normalized.ends_with(r"\ntenevernesstoevernezybax")
        || normalized.contains(r"\epic games\")
    {
        return "epic";
    }

    if epic_install_candidates()
        .iter()
        .any(|candidate| normalize_path(candidate) == normalized)
    {
        return "epic";
    }

    "global"
}

pub fn validate(path: &Path) -> GameFolderCheck {
    // Global launcher structure
    let global_root_launcher_found = path.join("NTEGlobalLauncher.exe").is_file();
    let nteglobal = path.join("NTEGlobal");
    let nteglobal_folder_found = nteglobal.is_dir();
    let nteglobal_game_found = nteglobal.join("NTEGlobalGame.exe").is_file();
    let nteglobal_launcher_found = nteglobal.join("NTEGlobalLauncher.exe").is_file();
    let nteglobal_update_found = nteglobal.join("NTEGlobalUpdate.exe").is_file();

    // CN launcher structure
    let cn_root_launcher_found = path.join("NTELauncher.exe").is_file();
    let ntelauncher = path.join("NTELauncher");
    let ntelauncher_folder_found = ntelauncher.is_dir();
    let nte_game_found = ntelauncher.join("NTEGame.exe").is_file();
    let ntelauncher_launcher_found = ntelauncher.join("NTELauncher.exe").is_file();
    let nte_update_found = ntelauncher.join("NTEUpdate.exe").is_file();

    // TW launcher structure
    let tw_root_launcher_found = path.join("NTETWLauncher.exe").is_file();
    let ntetw = path.join("NTETW");
    let ntetw_folder_found = ntetw.is_dir();
    let ntetw_game_found = ntetw.join("NTETWGame.exe").is_file();
    let ntetw_launcher_found = ntetw.join("NTETWLauncher.exe").is_file();
    let ntetw_update_found = ntetw.join("NTETWUpdate.exe").is_file();

    let win64 = path
        .join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Binaries")
        .join("Win64");

    let ht_game_found = win64.join("HTGame.exe").is_file();

    let paks = path
        .join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Content")
        .join("Paks");

    let global_ucas_found = paks.join("global.ucas").is_file();
    let global_utoc_found = paks.join("global.utoc").is_file();

    let shared_game_files_valid = ht_game_found && global_ucas_found && global_utoc_found;

    let global_valid = path.exists()
        && global_root_launcher_found
        && nteglobal_folder_found
        && nteglobal_game_found
        && nteglobal_launcher_found
        && nteglobal_update_found
        && shared_game_files_valid;

    let cn_valid = path.exists()
        && cn_root_launcher_found
        && ntelauncher_folder_found
        && nte_game_found
        && ntelauncher_launcher_found
        && nte_update_found
        && shared_game_files_valid;

    let tw_valid = path.exists()
        && tw_root_launcher_found
        && ntetw_folder_found
        && ntetw_game_found
        && ntetw_launcher_found
        && ntetw_update_found
        && shared_game_files_valid;

    let valid = global_valid || cn_valid || tw_valid;

    let game_version = if global_valid {
        detect_global_source(path)
    } else if cn_valid {
        "cn"
    } else if tw_valid {
        "tw"
    } else {
        "unknown"
    };

    GameFolderCheck {
        valid,
        path: path.to_string_lossy().to_string(),
        game_version: game_version.to_string(),

        root_launcher_found: global_root_launcher_found
            || cn_root_launcher_found
            || tw_root_launcher_found,

        nteglobal_folder_found,
        nteglobal_game_found,
        nteglobal_launcher_found,
        nteglobal_update_found,

        ntelauncher_folder_found,
        nte_game_found,
        ntelauncher_launcher_found,
        nte_update_found,

        ntetw_folder_found,
        ntetw_game_found,
        ntetw_launcher_found,
        ntetw_update_found,

        ht_game_found,

        global_ucas_found,
        global_utoc_found,

        message_key: if valid {
            "backend.validGameFolder".to_string()
        } else {
            "backend.invalidGameFolder".to_string()
        },
    }
}

fn vdf_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let parts: Vec<&str> = line.split('"').collect();

        if parts.len() >= 4 && parts[1].eq_ignore_ascii_case(key) {
            return Some(parts[3].to_string());
        }
    }

    None
}

fn steam_app_id_for_game_path(game_path: &Path) -> Option<String> {
    let common_dir = game_path.parent()?;
    let steamapps_dir = common_dir.parent()?;

    let entries = fs::read_dir(steamapps_dir).ok()?;

    for entry in entries.flatten() {
        let manifest_path = entry.path();

        let file_name = manifest_path
            .file_name()
            .and_then(|name| name.to_str())?;

        if !file_name.starts_with("appmanifest_")
            || !file_name.ends_with(".acf")
        {
            continue;
        }

        let content = fs::read_to_string(&manifest_path).ok()?;

        let install_dir = match vdf_value(&content, "installdir") {
            Some(value) => value,
            None => continue,
        };

        let manifest_game_path = steamapps_dir
            .join("common")
            .join(install_dir);

        if normalize_path(&manifest_game_path) != normalize_path(game_path) {
            continue;
        }

        if let Some(app_id) = vdf_value(&content, "appid") {
            return Some(app_id);
        }
    }

    None
}

fn launch_steam_uri(uri: &str) -> Result<(), String> {
    Command::new("explorer.exe")
        .arg(uri)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn epic_launch_uri_for_game_path(game_path: &Path) -> Option<String> {
    let program_data = std::env::var("PROGRAMDATA").ok()?;

    let manifests_dir = PathBuf::from(program_data)
        .join("Epic")
        .join("EpicGamesLauncher")
        .join("Data")
        .join("Manifests");

    let entries = fs::read_dir(manifests_dir).ok()?;

    for entry in entries.flatten() {
        let manifest_path = entry.path();

        if !manifest_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("item"))
            .unwrap_or(false)
        {
            continue;
        }

        let content = fs::read_to_string(&manifest_path).ok()?;
        let json: serde_json::Value = serde_json::from_str(&content).ok()?;

        let install_location = match json
            .get("InstallLocation")
            .and_then(|value| value.as_str())
        {
            Some(value) => value,
            None => continue,
        };

        if normalize_path(Path::new(install_location))
            != normalize_path(game_path)
        {
            continue;
        }

        let namespace = json
            .get("CatalogNamespace")
            .or_else(|| json.get("MainGameCatalogNamespace"))
            .and_then(|value| value.as_str())?;

        let catalog_id = json
            .get("CatalogItemId")
            .and_then(|value| value.as_str())?;

        let app_name = json
            .get("AppName")
            .or_else(|| json.get("MainGameAppName"))
            .and_then(|value| value.as_str())?;

        return Some(format!(
            "com.epicgames.launcher://apps/{}%3A{}%3A{}?action=launch",
            namespace,
            catalog_id,
            app_name
        ));
    }

    None
}

#[cfg(target_os = "windows")]
fn launch_epic_uri(uri: &str) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    use windows_sys::Win32::{
        System::Com::{
            CoInitializeEx,
            CoUninitialize,
            COINIT_APARTMENTTHREADED,
            COINIT_DISABLE_OLE1DDE,
        },
        UI::Shell::{
            ShellExecuteExW,
            SHELLEXECUTEINFOW,
        },
    };

    let uri_wide: Vec<u16> = std::ffi::OsStr::new(uri)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let com_result = unsafe {
        CoInitializeEx(
            std::ptr::null(),
            (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
        )
    };

    if com_result < 0 {
        return Err(format!(
            "Failed to initialize Windows COM: 0x{:08X}",
            com_result as u32
        ));
    }

    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: 0,
        hwnd: std::ptr::null_mut(),
        lpVerb: std::ptr::null(),
        lpFile: uri_wide.as_ptr(),
        lpParameters: std::ptr::null(),
        lpDirectory: std::ptr::null(),
        nShow: 1,
        hInstApp: std::ptr::null_mut(),
        lpIDList: std::ptr::null_mut(),
        lpClass: std::ptr::null(),
        hkeyClass: std::ptr::null_mut(),
        dwHotKey: 0,
        Anonymous: Default::default(),
        hProcess: std::ptr::null_mut(),
    };

    let success = unsafe {
        ShellExecuteExW(&mut info)
    };

    unsafe {
        CoUninitialize();
    }

    if success == 0 {
        return Err(format!(
            "Failed to open URI: {}",
            std::io::Error::last_os_error()
        ));
    }

    Ok(())
}

fn launch_executable(game_path: &Path, file_name: &str) -> Result<(), String> {
    let launcher = game_path.join(file_name);

    if !launcher.is_file() {
        return Err("errors.gameLauncherNotFound".to_string());
    }

    Command::new(launcher)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn launch_game_inner(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let game_path = Path::new(&path);
        let check = validate(game_path);

        if !check.valid {
            return Err("errors.invalidGameFolder".to_string());
        }

        match check.game_version.as_str() {
            "steam" => {
                let app_id = steam_app_id_for_game_path(game_path)
                    .ok_or_else(|| "errors.steamGameNotFound".to_string())?;
                launch_steam_uri(&format!("steam://rungameid/{app_id}"))
            }

            "epic" => {
                let uri = epic_launch_uri_for_game_path(game_path)
                    .ok_or_else(|| "errors.epicGameNotFound".to_string())?;
                launch_epic_uri(&uri)
            }

            "global" => launch_executable(game_path, "NTEGlobalLauncher.exe"),
            "cn" => launch_executable(game_path, "NTELauncher.exe"),
            "tw" => launch_executable(game_path, "NTETWLauncher.exe"),

            _ => Err("errors.gameVersionNotDetected".to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

pub async fn auto_detect_game_folder_inner(
    version: Option<String>,
) -> Result<GameFolderCheck, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let find_version = |version: &str| -> Option<GameFolderCheck> {
            let candidates = match version {
                "steam" => steam_install_candidates(),
                "epic" => epic_install_candidates(),
                "global" | "cn" | "tw" => standalone_install_candidates(),
                _ => return None,
            };

            for path in candidates {
                let result = validate(&path);

                if result.valid && result.game_version == version {
                    return Some(result);
                }
            }

            None
        };

        if let Some(version) = version {
            if !matches!(
                version.as_str(),
                "steam" | "epic" | "global" | "cn" | "tw"
            ) {
                return Err("errors.unsupportedGameVersion".to_string());
            }

            return Ok(
                find_version(&version)
                    .unwrap_or_else(|| validate(Path::new("__NTEMM_NOT_FOUND__"))),
            );
        }

        for version in ["steam", "epic", "global", "cn", "tw"] {
            if let Some(result) = find_version(version) {
                return Ok(result);
            }
        }

        Ok(validate(default_path()))
    })
    .await
    .map_err(|e| e.to_string())?
}

pub async fn check_game_folder_inner(path: String) -> Result<GameFolderCheck, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(validate(Path::new(&path))))
        .await
        .map_err(|e| e.to_string())?
}
