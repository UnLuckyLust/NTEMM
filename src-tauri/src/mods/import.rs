use serde::Serialize;
use std::process::Command;
use tauri::Manager;

use crate::mods::folder_icon::save_mod_icon_from_ico;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};
use tauri::path::BaseDirectory;
use walkdir::WalkDir;
use zip::ZipArchive;

use crate::mods::manage::ModMetadata;

#[derive(Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub mod_name: String,
    pub output_path: String,
    pub warnings: Vec<String>,
    pub copied_files: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAnalysis {
    pub suggested_name: Option<String>,
    pub name_conflict: bool,
}

pub fn get_mod_storage_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            return Ok(parent.join("NTEMM_Mods"));
        }
    }

    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("NTEMM_Mods"))
}

pub fn ext(path: &Path) -> String {
    path.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn validate_pak_sets(files: &[PathBuf]) -> Result<(), String> {
    let mut grouped: HashMap<String, HashSet<String>> = HashMap::new();

    for file in files {
        let e = ext(file);

        if e != "pak" && e != "ucas" && e != "utoc" {
            continue;
        }

        let stem = file
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        grouped.entry(stem).or_default().insert(e);
    }

    for (name, exts) in grouped {
        let mut missing = Vec::new();

        for required in ["pak", "ucas", "utoc"] {
            if !exts.contains(required) {
                missing.push(required);
            }
        }

        if !missing.is_empty() {
            return Err(format!(
                "PAK mod \"{}\" is incomplete.\nMissing files: {}",
                name,
                missing
                    .iter()
                    .map(|e| format!("{}.{}", name, e))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
    }

    Ok(())
}

fn validate_ini_requires_asi(files: &[PathBuf]) -> Result<(), String> {
    let has_ini = files.iter().any(|file| ext(file) == "ini");
    let has_asi = files.iter().any(|file| ext(file) == "asi");

    if has_ini && !has_asi {
        return Err("INI files can only be imported together with an ASI file".into());
    }

    Ok(())
}

fn is_supported_file(path: &Path) -> bool {
    matches!(
        ext(path).as_str(),
        "pak" | "ucas" | "utoc" | "asi" | "ini" | "json"
    )
}

fn collect_supported_files(root: &Path, out: &mut Vec<PathBuf>) {
    let mut files = Vec::new();
    let mut has_asi = false;

    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        let path = entry.path();

        if !path.is_file() || !is_supported_file(path) {
            continue;
        }

        let extension = ext(path);

        if extension == "asi" {
            has_asi = true;
        }

        files.push((path.to_path_buf(), extension));
    }

    out.extend(
        files
            .into_iter()
            .filter(|(_, extension)| extension != "ini" || has_asi)
            .map(|(path, _)| path),
    );
}

fn is_archive(path: &Path) -> bool {
    matches!(ext(path).as_str(), "zip" | "rar" | "7z")
}

fn extract_zip_native(zip_path: &Path, output_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;

        let Some(enclosed) = file.enclosed_name() else {
            continue;
        };

        let out_path = output_dir.join(enclosed);

        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            let mut out_file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out_file).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn extract_with_7zip(
    app: &tauri::AppHandle,
    archive_path: &Path,
    output_dir: &Path,
) -> Result<(), String> {
    let bundled_7za = app
        .path()
        .resolve("resources/binaries/7z.exe", BaseDirectory::Resource)
        .ok();

    let mut command = if let Some(path) = bundled_7za {
        Command::new(path)
    } else {
        Command::new("7z")
    };

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let status = command
        .arg("x")
        .arg(archive_path.to_string_lossy().to_string())
        .arg(format!("-o{}", output_dir.to_string_lossy().to_string()))
        .arg("-y")
        .status()
        .map_err(|_| {
            "7-Zip extractor was not found. Missing bundled 7z.exe or 7z.dll".to_string()
        })?;

    if !status.success() {
        return Err("Failed to extract archive".into());
    }

    Ok(())
}

fn extract_archive(
    app: &tauri::AppHandle,
    archive_path: &Path,
    output_dir: &Path,
) -> Result<(), String> {
    match ext(archive_path).as_str() {
        "zip" => extract_zip_native(archive_path, output_dir),
        "rar" | "7z" => extract_with_7zip(app, archive_path, output_dir),
        _ => Err("Unsupported archive format".into()),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn analyze_import_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<ImportAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if paths.is_empty() {
            return Err("No files were dropped".into());
        }

        let storage_root = get_mod_storage_root(&app)?;

        let temp_dir = std::env::temp_dir().join(format!("NTEMM_analyze_import_{}", uuid::Uuid::new_v4()));

        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }

        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

        let mut source_files = Vec::new();

        for raw in &paths {
            let path = PathBuf::from(raw);

            if path.is_dir() {
                collect_supported_files(&path, &mut source_files);
                continue;
            }

            if is_archive(&path) {
                extract_archive(&app, &path, &temp_dir)?;
                collect_supported_files(&temp_dir, &mut source_files);
                continue;
            }

            if is_supported_file(&path) {
                source_files.push(path);
            }
        }

        if source_files.is_empty() {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err("No supported mod files found. Supports ZIP/RAR/7Z, folders, ASI mods, and complete PAK + UCAS + UTOC sets".into());
        }

        validate_pak_sets(&source_files)?;
        validate_ini_requires_asi(&source_files)?;

        let suggested_name = source_files
            .iter()
            .find(|file| {
                file.file_name()
                    .map(|name| name.to_string_lossy().eq_ignore_ascii_case("mod.json"))
                    .unwrap_or(false)
            })
            .and_then(|file| fs::read_to_string(file).ok())
            .and_then(|content| serde_json::from_str::<ModMetadata>(&content).ok())
            .and_then(|metadata| metadata.name)
            .map(|name| sanitize_filename::sanitize(name.trim()));

        let name_conflict = suggested_name
            .as_ref()
            .map(|name| storage_root.join(name).exists())
            .unwrap_or(false);

        let _ = fs::remove_dir_all(&temp_dir);

        Ok(ImportAnalysis {
            suggested_name,
            name_conflict,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn compact_match_text(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn spaced_match_text(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn icon_stem_matches(search_text: &str, icon_stem: &str) -> bool {
    let search_spaced = spaced_match_text(search_text);
    let search_compact = compact_match_text(search_text);

    let icon_spaced = spaced_match_text(icon_stem);
    let icon_compact = compact_match_text(icon_stem);

    if icon_spaced.is_empty() || icon_compact.is_empty() {
        return false;
    }

    search_spaced.contains(&icon_spaced) || search_compact.contains(&icon_compact)
}

fn find_matching_bundled_icon(
    app: &tauri::AppHandle,
    search_text: &str,
) -> Result<Option<PathBuf>, String> {
    let icons_dir = app
        .path()
        .resolve("resources/icons", BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve bundled icons folder: {e}"))?;

    if !icons_dir.exists() || !icons_dir.is_dir() {
        return Ok(None);
    }

    let mut icons = fs::read_dir(&icons_dir)
        .map_err(|e| format!("Failed to read bundled icons folder: {e}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("ico"))
                    .unwrap_or(false)
        })
        .filter_map(|path| {
            let stem = path.file_stem()?.to_string_lossy().to_string();
            Some((stem, path))
        })
        .collect::<Vec<_>>();

    icons.sort_by(|a, b| b.0.len().cmp(&a.0.len()));

    Ok(icons
        .into_iter()
        .find(|(stem, _)| icon_stem_matches(search_text, stem))
        .map(|(_, path)| path))
}

fn auto_apply_known_mod_icon(
    app: &tauri::AppHandle,
    output_dir: &Path,
    mod_name: &str,
    copied_files: &[String],
) -> Result<(), String> {
    let mut search_text = String::from(mod_name);

    for file in copied_files {
        search_text.push(' ');
        search_text.push_str(file);
    }

    let metadata_path = output_dir.join("mod.json");

    if let Ok(content) = fs::read_to_string(metadata_path) {
        if let Ok(metadata) = serde_json::from_str::<ModMetadata>(&content) {
            if let Some(name) = metadata.name {
                search_text.push(' ');
                search_text.push_str(&name);
            }

            if let Some(tags) = metadata.tags {
                for tag in tags {
                    search_text.push(' ');
                    search_text.push_str(&tag);
                }
            }
        }
    }

    let Some(icon_path) = find_matching_bundled_icon(app, &search_text)? else {
        return Ok(());
    };

    save_mod_icon_from_ico(&icon_path, output_dir)
}

fn stored_mod_file_names(mod_dir: &Path) -> Result<Vec<String>, String> {
    let mut files = Vec::new();

    for entry in fs::read_dir(mod_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().map(|name| name.to_string_lossy().to_string()) else {
            continue;
        };

        if file_name.eq_ignore_ascii_case("icon.ico")
            || file_name.eq_ignore_ascii_case("icon.png")
            || file_name.eq_ignore_ascii_case("desktop.ini")
            || file_name.eq_ignore_ascii_case("mod.json")
        {
            continue;
        }

        files.push(file_name);
    }

    Ok(files)
}

fn refresh_auto_mod_icons_inner(app: &tauri::AppHandle) -> Result<u32, String> {
    let storage_root = get_mod_storage_root(app)?;

    if !storage_root.exists() || !storage_root.is_dir() {
        return Ok(0);
    }

    let mut applied_count = 0;

    for entry in fs::read_dir(storage_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let mod_dir = entry.path();

        if !mod_dir.is_dir() {
            continue;
        }

        let has_existing_icon = mod_dir.join("icon.ico").exists() || mod_dir.join("icon.png").exists();

        if has_existing_icon {
            continue;
        }

        let mod_name = mod_dir
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();

        if mod_name.is_empty() {
            continue;
        }

        let files = stored_mod_file_names(&mod_dir)?;

        let had_icon_before = mod_dir.join("icon.ico").exists();

        auto_apply_known_mod_icon(app, &mod_dir, &mod_name, &files)?;

        if !had_icon_before && mod_dir.join("icon.ico").exists() {
            applied_count += 1;
        }
    }

    Ok(applied_count)
}

#[tauri::command]
pub async fn refresh_auto_mod_icons(app: tauri::AppHandle) -> Result<u32, String> {
    tauri::async_runtime::spawn_blocking(move || refresh_auto_mod_icons_inner(&app))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn import_mod_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
    mod_name: String,
    overwrite: bool,
) -> Result<ImportResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if paths.is_empty() {
            return Err("No files were dropped".into());
        }

        let storage_root = get_mod_storage_root(&app)?;
        fs::create_dir_all(&storage_root).map_err(|e| e.to_string())?;

        let mod_name = sanitize_filename::sanitize(mod_name.trim());

        if mod_name.is_empty() {
            return Err("Mod name cannot be empty".into());
        }

        let output_dir = storage_root.join(&mod_name);

        if output_dir.exists() {
            if !overwrite {
                return Err("A mod with this name already exists".into());
            }

            fs::remove_dir_all(&output_dir).map_err(|e| e.to_string())?;
        }

        fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

        let temp_dir = output_dir.join("_temp_extract");
        let mut source_files = Vec::new();

        for raw in paths {
            let path = PathBuf::from(raw);

            if path.is_dir() {
                collect_supported_files(&path, &mut source_files);
                continue;
            }

            if is_archive(&path) {
                fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
                extract_archive(&app, &path, &temp_dir)?;
                collect_supported_files(&temp_dir, &mut source_files);
                continue;
            }

            if is_supported_file(&path) {
                source_files.push(path);
            }
        }

        if source_files.is_empty() {
            return Err("No supported mod files found. Supports ZIP/RAR/7Z, folders, ASI mods, and complete PAK + UCAS + UTOC sets".into());
        }

        validate_pak_sets(&source_files)?;
        validate_ini_requires_asi(&source_files)?;

        let mut copied_files = Vec::new();

        for file in source_files {
            let file_name = file
                .file_name()
                .ok_or("Invalid file name")?
                .to_string_lossy()
                .to_string();

            let dest = output_dir.join(&file_name);

            fs::copy(&file, &dest).map_err(|e| e.to_string())?;
            copied_files.push(file_name);
        }

        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }

        let mut warnings = Vec::new();

        if let Err(err) = auto_apply_known_mod_icon(&app, &output_dir, &mod_name, &copied_files) {
            warnings.push(format!("Auto icon detection failed: {err}"));
        }

        Ok(ImportResult {
            success: true,
            mod_name,
            output_path: output_dir.to_string_lossy().to_string(),
            warnings,
            copied_files,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn validate_mod_paths(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if paths.is_empty() {
            return Err("No files were dropped".into());
        }

        let mut source_files = Vec::new();

        for raw in paths {
            let path = PathBuf::from(raw);

            if path.is_dir() {
                collect_supported_files(&path, &mut source_files);
                continue;
            }

            if is_archive(&path) {
                let temp_dir = std::env::temp_dir().join(format!("NTEMM_validate_archive_{}", uuid::Uuid::new_v4()));

                if temp_dir.exists() {
                    let _ = fs::remove_dir_all(&temp_dir);
                }

                fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
                extract_archive(&app, &path, &temp_dir)?;
                collect_supported_files(&temp_dir, &mut source_files);

                let _ = fs::remove_dir_all(&temp_dir);
                continue;
            }

            if is_supported_file(&path) {
                source_files.push(path);
            }
        }

        if source_files.is_empty() {
            return Err("No supported mod files found. Supports ZIP/RAR/7Z, folders, ASI mods, and complete PAK + UCAS + UTOC sets".into());
        }

        validate_pak_sets(&source_files)?;
        validate_ini_requires_asi(&source_files)?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
