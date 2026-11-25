use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevatedApplyModsRequest {
    pub game_path: String,
    pub selected_mods: Vec<String>,
    pub pak_categories: HashMap<String, Vec<String>>,

    #[serde(default)]
    pub hide_uid_enabled: Option<bool>,

    #[serde(default)]
    pub hide_ping_enabled: Option<bool>,

    #[serde(default)]
    pub anticensor_enabled: Option<bool>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevatedLoaderFilesRequest {
    pub path: String,
    pub install: bool,

    #[serde(default)]
    pub clean: bool,

    #[serde(default)]
    pub proxy_dll_names: Option<Vec<String>>,

    #[serde(default)]
    pub all_proxy_dll_names: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevatedFolderIconRequest {
    pub folder_path: String,
    pub icon_path: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevatedOpenFolderRequest {
    pub path: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevatedResult<T> {
    pub ok: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
