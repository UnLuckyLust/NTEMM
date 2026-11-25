use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnticensorStatus {
    pub installed: bool,
    pub loader_installed: bool,
    pub path: String,
    pub message_key: String,
}

#[derive(Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub mod_name: String,
    pub output_path: String,
    pub warnings: Vec<String>,
    pub warning_keys: Vec<String>,
    pub copied_files: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAnalysis {
    pub suggested_name: Option<String>,
    pub name_conflict: bool,
}

#[derive(Clone)]
pub(crate) struct SourceFile {
    pub(crate) path: PathBuf,
    pub(crate) relative_path: PathBuf,
}

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModMetadata {
    #[serde(alias = "Name")]
    pub name: Option<String>,

    #[serde(alias = "Version")]
    pub version: Option<String>,

    #[serde(alias = "Author")]
    pub author: Option<String>,

    #[serde(alias = "Description")]
    pub description: Option<String>,

    #[serde(alias = "ModLink")]
    pub mod_link: Option<String>,

    #[serde(alias = "SupportLink")]
    pub support_link: Option<String>,

    #[serde(alias = "Image")]
    pub image: Option<String>,

    #[serde(alias = "Tags")]
    pub tags: Option<Vec<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedMod {
    pub name: String,
    pub path: String,
    pub files: Vec<String>,
    pub icon_path: Option<String>,
    pub preview_image_paths: Vec<String>,
    pub metadata: Option<ModMetadata>,
    pub metadata_error: Option<String>,
}

#[derive(Serialize)]
pub struct ModInstallStatus {
    pub name: String,
    pub status: String,
    pub installed_files: usize,
    pub expected_files: usize,
    pub missing_files: Vec<String>,
}

#[derive(Clone)]
pub(crate) struct StoredMod {
    pub(crate) name: String,
    pub(crate) dir: PathBuf,
    pub(crate) files: Vec<PathBuf>,
    pub(crate) is_pak: bool,
    pub(crate) is_asi: bool,
}

pub(crate) struct GameTargets {
    pub(crate) pak_target: PathBuf,
    pub(crate) asi_target: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiModsStatus {
    pub hide_uid_installed: bool,
    pub hide_ping_installed: bool,
    pub path: String,
    pub message_key: String,
}

pub(crate) struct UiModInfo {
    pub(crate) source_folder: &'static str,
    pub(crate) target_folder: &'static str,
    pub(crate) files: &'static [&'static str],
}
