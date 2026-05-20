use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{Manager};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameFolderCheck {
    pub valid: bool,
    pub path: String,
    pub game_version: String,

    pub root_launcher_found: bool,

    pub nteglobal_folder_found: bool,
    pub nteglobal_game_found: bool,
    pub nteglobal_launcher_found: bool,
    pub nteglobal_update_found: bool,

    pub ntelauncher_folder_found: bool,
    pub nte_game_found: bool,
    pub ntelauncher_launcher_found: bool,
    pub nte_update_found: bool,

    pub ht_game_found: bool,

    pub global_ucas_found: bool,
    pub global_utoc_found: bool,

    pub message: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoaderFilesCheck {
    pub valid: bool,
    pub loader_dir: String,

    pub asi_found: bool,
    pub cutils_found: bool,
    pub proxy_dll_found: bool,

    pub missing_files: Vec<String>,
    pub message: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnticensorStatus {
    pub installed: bool,
    pub loader_installed: bool,
    pub path: String,
    pub message: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineIniCheck {
    pub valid: bool,
    pub path: String,
    pub application_scale: Option<f32>,
    pub message: String,
}

fn default_path() -> &'static Path {
    Path::new(r"C:\Program Files\NevernessToEverness")
}

fn validate(path: &Path) -> GameFolderCheck {
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

    let valid = global_valid || cn_valid;

    let game_version = if global_valid {
        "global"
    } else if cn_valid {
        "cn"
    } else {
        "unknown"
    };

    GameFolderCheck {
        valid,
        path: path.to_string_lossy().to_string(),
        game_version: game_version.to_string(),

        root_launcher_found: global_root_launcher_found || cn_root_launcher_found,

        nteglobal_folder_found,
        nteglobal_game_found,
        nteglobal_launcher_found,
        nteglobal_update_found,

        ntelauncher_folder_found,
        nte_game_found,
        ntelauncher_launcher_found,
        nte_update_found,

        ht_game_found,

        global_ucas_found,
        global_utoc_found,

        message: if valid {
            format!("Valid Neverness to Everness install folder")
        } else {
            "The selected folder does not look like a valid Neverness to Everness install"
                .to_string()
        },
    }
}

#[tauri::command]
pub fn auto_detect_game_folder() -> GameFolderCheck {
    validate(default_path())
}

#[tauri::command]
pub fn check_game_folder(path: String) -> GameFolderCheck {
    validate(Path::new(&path))
}

#[tauri::command(rename_all = "camelCase")]
pub fn launch_game(path: String) -> Result<(), String> {
    let check = validate(Path::new(&path));

    let launcher = match check.game_version.as_str() {
        "global" => Path::new(&path).join("NTEGlobalLauncher.exe"),
        "cn" => Path::new(&path).join("NTELauncher.exe"),
        _ => return Err("Could not detect game version".into()),
    };

    if !launcher.exists() {
        return Err("Game launcher was not found".into());
    }

    Command::new(launcher).spawn().map_err(|e| e.to_string())?;

    Ok(())
}

fn loader_proxy_info(game_version: &str) -> (&'static str, &'static str) {
    match game_version {
        "cn" => ("cn/dinput8.dll", "dinput8.dll"),
        _ => ("global/version.dll", "version.dll"),
    }
}

fn loader_target_dir(path: &Path) -> std::path::PathBuf {
    path.join("Client")
        .join("WindowsNoEditor")
        .join("HT")
        .join("Binaries")
        .join("Win64")
}

fn anticensor_target_path(path: &Path) -> std::path::PathBuf {
    loader_target_dir(path).join("Anticensor.asi")
}

fn anticensor_resource_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource folder: {e}"))?
        .join("resources")
        .join("anticensor")
        .join("Anticensor.asi"))
}

#[tauri::command(rename_all = "camelCase")]
pub fn check_loader_files(path: String) -> LoaderFilesCheck {
    let loader_dir = loader_target_dir(Path::new(&path));

    let asi_found = loader_dir.join("AyakaNTEModLoader.asi").is_file();
    let cutils_found = loader_dir.join("cutils.dll").is_file();

    let game_check = validate(Path::new(&path));
    let (_, proxy_dll_name) = loader_proxy_info(&game_check.game_version);
    let proxy_dll_found = loader_dir.join(proxy_dll_name).is_file();

    let mut missing_files = Vec::new();

    if !asi_found {
        missing_files.push("AyakaNTEModLoader.asi".to_string());
    }

    if !cutils_found {
        missing_files.push("cutils.dll".to_string());
    }

    if !proxy_dll_found {
        missing_files.push(proxy_dll_name.to_string());
    }

    let valid = missing_files.is_empty();

    LoaderFilesCheck {
        valid,
        loader_dir: loader_dir.to_string_lossy().to_string(),

        asi_found,
        cutils_found,
        proxy_dll_found,

        missing_files,

        message: if valid {
            "Required loader files are installed".to_string()
        } else {
            "Required loader files are missing".to_string()
        },
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn install_loader_files(
    app: tauri::AppHandle,
    path: String,
) -> Result<LoaderFilesCheck, String> {
    let loader_dir = loader_target_dir(std::path::Path::new(&path));

    std::fs::create_dir_all(&loader_dir)
        .map_err(|e| format!("Failed to create loader folder: {e}"))?;

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource folder: {e}"))?;

    let game_check = validate(std::path::Path::new(&path));

    if !game_check.valid {
        return Err("Invalid game folder".to_string());
    }

    let (proxy_resource_path, proxy_dll_name) = loader_proxy_info(&game_check.game_version);

    let files = [
        (
            resource_dir
                .join("resources")
                .join("loader")
                .join("AyakaNTEModLoader.asi"),
            loader_dir.join("AyakaNTEModLoader.asi"),
        ),
        (
            resource_dir
                .join("resources")
                .join("loader")
                .join("cutils.dll"),
            loader_dir.join("cutils.dll"),
        ),
        (
            resource_dir
                .join("resources")
                .join("loader")
                .join(proxy_resource_path),
            loader_dir.join(proxy_dll_name),
        ),
    ];

    for (source, target) in files {
        if !source.is_file() {
            return Err(format!(
                "Bundled loader file not found: {}",
                source.display()
            ));
        }

        std::fs::copy(&source, &target)
            .map_err(|e| format!("Failed to copy {}: {e}", target.display()))?;
    }

    Ok(check_loader_files(path))
}

#[tauri::command(rename_all = "camelCase")]
pub fn uninstall_loader_files(path: String) -> Result<LoaderFilesCheck, String> {
    let loader_dir = loader_target_dir(std::path::Path::new(&path));
    let game_check = validate(std::path::Path::new(&path));
    let (_, proxy_dll_name) = loader_proxy_info(&game_check.game_version);

    let files = [
        loader_dir.join("AyakaNTEModLoader.asi"),
        loader_dir.join("cutils.dll"),
        loader_dir.join(proxy_dll_name),
        loader_dir.join("Anticensor.asi"),
    ];

    for file in files {
        if file.exists() {
            std::fs::remove_file(&file)
                .map_err(|e| format!("Failed to remove {}: {e}", file.display()))?;
        }
    }

    Ok(check_loader_files(path))
}

fn is_allowed_engine_ini_path(path: &Path) -> bool {
    let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };

    if !file_name.eq_ignore_ascii_case("Engine.ini") {
        return false;
    }

    let normalized = path.to_string_lossy().replace('/', "\\");

    normalized.ends_with("\\Config\\Windows\\Engine.ini")
        && (
            normalized.contains("\\HT\\Saved_Global\\")
            || normalized.contains("\\HT\\Saved\\")
        )
}

fn engine_ini_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let local_app_data = PathBuf::from(local_app_data);

        paths.push(local_app_data.join("HT").join("Saved_Global").join("Config").join("Windows").join("Engine.ini"));
        paths.push(local_app_data.join("HT").join("Saved").join("Config").join("Windows").join("Engine.ini"));
    }

    paths
}

fn parse_application_scale(content: &str) -> Option<f32> {
    let mut in_ui_section = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_ui_section = trimmed == "[/Script/Engine.UserInterfaceSettings]";
            continue;
        }

        if in_ui_section {
            if let Some(value) = trimmed.strip_prefix("ApplicationScale=") {
                return value.trim().parse::<f32>().ok();
            }
        }
    }

    None
}

fn check_engine_ini_path(path: &Path) -> EngineIniCheck {
    if !is_allowed_engine_ini_path(path) {
        return EngineIniCheck {
            valid: false,
            path: path.to_string_lossy().to_string(),
            application_scale: None,
            message: "Invalid file. Select the game's Engine.ini file only.".to_string(),
        };
    }

    if !path.is_file() {
        return EngineIniCheck {
            valid: false,
            path: path.to_string_lossy().to_string(),
            application_scale: None,
            message: "Engine.ini was not found".to_string(),
        };
    }

    let application_scale = fs::read_to_string(path)
        .ok()
        .and_then(|content| parse_application_scale(&content));

    EngineIniCheck {
        valid: true,
        path: path.to_string_lossy().to_string(),
        application_scale,
        message: "Engine.ini detected".to_string(),
    }
}

fn update_application_scale(content: &str, scale: f32) -> String {
    let section = "[/Script/Engine.UserInterfaceSettings]";
    let scale_line = format!("ApplicationScale={scale:.2}");

    let mut lines: Vec<String> = content.lines().map(str::to_string).collect();

    if let Some(section_index) = lines.iter().position(|line| line.trim() == section) {
        let mut insert_index = lines.len();

        for index in (section_index + 1)..lines.len() {
            let trimmed = lines[index].trim();

            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                insert_index = index;
                break;
            }

            if trimmed.starts_with("ApplicationScale=") {
                lines[index] = scale_line;
                return format!("{}\n", lines.join("\n"));
            }
        }

        lines.insert(insert_index, scale_line);
        return format!("{}\n", lines.join("\n"));
    }

    let mut output = content.trim_end().to_string();

    if !output.is_empty() {
        output.push_str("\n\n");
    }

    output.push_str(section);
    output.push('\n');
    output.push_str(&scale_line);
    output.push('\n');

    output
}

#[tauri::command]
pub fn auto_detect_engine_ini() -> EngineIniCheck {
    for path in engine_ini_candidates() {
        if path.is_file() {
            return check_engine_ini_path(&path);
        }
    }

    EngineIniCheck {
        valid: false,
        path: engine_ini_candidates()
            .first()
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
        application_scale: None,
        message: "Engine.ini was not auto-detected. Select it manually.".to_string(),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn check_engine_ini(path: String) -> EngineIniCheck {
    check_engine_ini_path(Path::new(&path))
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_ui_scale(path: String, scale: f32) -> Result<EngineIniCheck, String> {
    let path = Path::new(&path);

    if !is_allowed_engine_ini_path(path) {
        return Err("Invalid file. Only the game's Engine.ini can be edited.".to_string());
    }

    if !path.is_file() {
        return Err("Engine.ini was not found".to_string());
    }

    let scale = scale.clamp(0.25, 1.5);
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read Engine.ini metadata: {e}"))?;
    let was_readonly = metadata.permissions().readonly();

    if was_readonly {
        let mut permissions = metadata.permissions();
        permissions.set_readonly(false);
        fs::set_permissions(path, permissions)
            .map_err(|e| format!("Failed to remove read-only from Engine.ini: {e}"))?;
    }

    let write_result = (|| -> Result<(), String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read Engine.ini: {e}"))?;

        let updated = update_application_scale(&content, scale);

        fs::write(path, updated)
            .map_err(|e| format!("Failed to write Engine.ini: {e}"))?;

        Ok(())
    })();

    let restore_result = if was_readonly {
        fs::metadata(path)
            .map(|metadata| {
                let mut permissions = metadata.permissions();
                permissions.set_readonly(true);
                permissions
            })
            .map_err(|e| format!("Failed to read Engine.ini metadata after write: {e}"))
            .and_then(|permissions| {
                fs::set_permissions(path, permissions)
                    .map_err(|e| format!("Failed to restore read-only on Engine.ini: {e}"))
            })
    } else {
        Ok(())
    };

    write_result?;
    restore_result?;

    Ok(check_engine_ini_path(path))
}

#[tauri::command(rename_all = "camelCase")]
pub fn check_anticensor_mod(path: String) -> Result<AnticensorStatus, String> {
    let game_path = Path::new(&path);
    let target = anticensor_target_path(game_path);
    let loader_check = check_loader_files(path);

    if !loader_check.valid && target.is_file() {
        std::fs::remove_file(&target)
            .map_err(|e| format!("Failed to remove Anticensor.asi because loader is missing: {e}"))?;
    }

    Ok(AnticensorStatus {
        installed: loader_check.valid && target.is_file(),
        loader_installed: loader_check.valid,
        path: target.to_string_lossy().to_string(),
        message: if loader_check.valid {
            if target.is_file() {
                "Anticensor is installed".to_string()
            } else {
                "Anticensor is not installed".to_string()
            }
        } else {
            "Install loader files first".to_string()
        },
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_anticensor_mod(
    app: tauri::AppHandle,
    path: String,
    enabled: bool,
) -> Result<AnticensorStatus, String> {
    let game_path = Path::new(&path);
    let target = anticensor_target_path(game_path);
    let loader_check = check_loader_files(path.clone());

    if !loader_check.valid {
        if target.is_file() {
            std::fs::remove_file(&target)
                .map_err(|e| format!("Failed to remove Anticensor.asi: {e}"))?;
        }

        return Ok(AnticensorStatus {
            installed: false,
            loader_installed: false,
            path: target.to_string_lossy().to_string(),
            message: "Install loader files first".to_string(),
        });
    }

    if enabled {
        let source = anticensor_resource_path(&app)?;

        if !source.is_file() {
            return Err(format!("Bundled Anticensor.asi was not found: {}", source.display()));
        }

        std::fs::copy(&source, &target)
            .map_err(|e| format!("Failed to copy Anticensor.asi: {e}"))?;
    } else if target.is_file() {
        std::fs::remove_file(&target)
            .map_err(|e| format!("Failed to remove Anticensor.asi: {e}"))?;
    }

    Ok(AnticensorStatus {
        installed: target.is_file(),
        loader_installed: true,
        path: target.to_string_lossy().to_string(),
        message: if target.is_file() {
            "Anticensor is installed".to_string()
        } else {
            "Anticensor is not installed".to_string()
        },
    })
}