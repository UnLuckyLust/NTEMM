use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameBananaMod {
    pub id: u64,
    pub name: String,
    pub description: String,
    pub owner_name: String,
    pub preview_image_url: Option<String>,
    pub page_url: String,
    pub likes: u64,
    pub downloads: u64,
    pub date_added: u64,
    pub date_modified: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameBananaModsResponse {
    pub mods: Vec<GameBananaMod>,
    pub cached: bool,
    pub cache_age_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameBananaCacheFile {
    pub saved_at: u64,
    pub mods: Vec<GameBananaMod>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameBananaModDetails {
    pub id: u64,
    pub name: String,
    pub description: String,
    pub owner_name: String,
    pub preview_image_url: Option<String>,
    pub page_url: String,
    pub likes: u64,
    pub downloads: u64,
    pub date_added: u64,
    pub date_modified: u64,
    pub full_description: String,
    pub screenshots: Vec<String>,
    pub file_name: String,
    pub file_size: u64,
    pub download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameBananaModDetailsCacheFile {
    pub saved_at: u64,
    pub details: GameBananaModDetails,
}