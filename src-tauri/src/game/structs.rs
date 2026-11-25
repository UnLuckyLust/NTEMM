use serde::{Deserialize, Serialize};

#[derive(Serialize)]
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

    pub message_key: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineIniCheck {
    pub valid: bool,
    pub path: String,
    pub application_scale: Option<f32>,
    pub message_key: String,
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
    pub message_key: String,
}
