use std::path::Path;
use std::process::Command;

fn default_path() -> &'static Path {
    Path::new(r"C:\Program Files\Neverness To Everness")
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
        "global"
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

        message: if valid {
            format!("Valid Neverness to Everness install folder")
        } else {
            "The selected folder does not look like a valid Neverness to Everness install"
                .to_string()
        },
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn launch_game(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let check = validate(Path::new(&path));

        let launcher = match check.game_version.as_str() {
            "global" => Path::new(&path).join("NTEGlobalLauncher.exe"),
            "cn" => Path::new(&path).join("NTELauncher.exe"),
            "tw" => Path::new(&path).join("NTETWLauncher.exe"),
            _ => return Err("Could not detect game version".into()),
        };

        if !launcher.exists() {
            return Err("Game launcher was not found".into());
        }

        Command::new(launcher).spawn().map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

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

    pub ntetw_folder_found: bool,
    pub ntetw_game_found: bool,
    pub ntetw_launcher_found: bool,
    pub ntetw_update_found: bool,

    pub ht_game_found: bool,

    pub global_ucas_found: bool,
    pub global_utoc_found: bool,

    pub message: String,
}

#[tauri::command]
pub async fn auto_detect_game_folder() -> Result<GameFolderCheck, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(validate(default_path())))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn check_game_folder(path: String) -> Result<GameFolderCheck, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(validate(Path::new(&path))))
        .await
        .map_err(|e| e.to_string())?
}
