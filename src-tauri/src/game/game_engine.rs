use std::fs;
use std::path::{Path, PathBuf};

use crate::game::game::validate;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineIniCheck {
    pub valid: bool,
    pub path: String,
    pub application_scale: Option<f32>,
    pub message: String,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn check_engine_ini(path: String) -> Result<EngineIniCheck, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(check_engine_ini_path(Path::new(&path))))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn detect_engine_ini_for_game(game_path: String) -> Result<EngineIniCheck, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let game_check = validate(Path::new(&game_path));

        if !game_check.valid {
            return Ok(EngineIniCheck {
                valid: false,
                path: String::new(),
                application_scale: None,
                message: "Game folder/version was not detected".to_string(),
            });
        }

        let Some(path) = engine_ini_path_for_version(&game_check.game_version) else {
            return Ok(EngineIniCheck {
                valid: false,
                path: String::new(),
                application_scale: None,
                message: "Unsupported game version".to_string(),
            });
        };

        Ok(check_engine_ini_path(&path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_ui_scale(game_path: String, scale: f32) -> Result<EngineIniCheck, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let game_check = validate(Path::new(&game_path));

        if !game_check.valid {
            return Err("Game folder/version was not detected".to_string());
        }

        let path = engine_ini_path_for_version(&game_check.game_version)
            .ok_or_else(|| "Unsupported game version".to_string())?;

        let path = path.as_path();

        if !is_allowed_engine_ini_path(path) {
            return Err("Invalid file. Only the game's Engine.ini can be edited.".to_string());
        }

        if !path.is_file() {
            return Err("Engine.ini was not found".to_string());
        }

        let scale = scale.clamp(0.25, 1.5);
        let metadata =
            fs::metadata(path).map_err(|e| format!("Failed to read Engine.ini metadata: {e}"))?;

        if metadata.permissions().readonly() {
            set_engine_ini_readonly(path, false)?;
        }

        let write_result = (|| -> Result<(), String> {
            let content =
                fs::read_to_string(path).map_err(|e| format!("Failed to read Engine.ini: {e}"))?;

            let updated = update_application_scale(&content, scale);

            fs::write(path, updated).map_err(|e| format!("Failed to write Engine.ini: {e}"))?;

            Ok(())
        })();

        let readonly_result = set_engine_ini_readonly(path, true);

        write_result?;
        readonly_result?;

        Ok(check_engine_ini_path(path))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn set_engine_ini_readonly(path: &Path, readonly: bool) -> Result<(), String> {
    let metadata =
        fs::metadata(path).map_err(|e| format!("Failed to read Engine.ini metadata: {e}"))?;

    let mut permissions = metadata.permissions();

    if permissions.readonly() == readonly {
        return Ok(());
    }

    permissions.set_readonly(readonly);

    fs::set_permissions(path, permissions).map_err(|e| {
        if readonly {
            format!("Failed to set Engine.ini as read-only: {e}")
        } else {
            format!("Failed to remove read-only from Engine.ini: {e}")
        }
    })
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

fn is_allowed_engine_ini_path(path: &Path) -> bool {
    let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };

    if !file_name.eq_ignore_ascii_case("Engine.ini") {
        return false;
    }

    let normalized = path.to_string_lossy().replace('/', "\\");

    normalized.ends_with("\\Config\\Windows\\Engine.ini")
        && (normalized.contains("\\HT\\Saved_Global\\")
            || normalized.contains("\\HT\\Saved\\")
            || normalized.contains("\\HT\\Saved_GAT\\"))
}

fn engine_ini_path_for_version(game_version: &str) -> Option<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    let local_app_data = PathBuf::from(local_app_data);

    let saved_folder = match game_version {
        "global" => "Saved_Global",
        "cn" => "Saved",
        "tw" => "Saved_GAT",
        _ => return None,
    };

    Some(
        local_app_data
            .join("HT")
            .join(saved_folder)
            .join("Config")
            .join("Windows")
            .join("Engine.ini"),
    )
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
