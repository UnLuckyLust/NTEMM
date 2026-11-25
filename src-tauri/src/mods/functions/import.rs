use crate::mods::structs::{ModMetadata, SourceFile};
use std::process::Command;
use tauri::Manager;
use std::ffi::OsStr;

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

pub fn is_preview_image_file_name(name: &OsStr) -> bool {
    let name = name.to_string_lossy().to_lowercase();

    if !name.contains("preview") {
        return false;
    }

    let ext = Path::new(name.as_str())
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();

    matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "avif"
    )
}


fn is_mod_payload_file(path: &Path) -> bool {
    matches!(ext(path).as_str(), "pak" | "ucas" | "utoc" | "asi")
}

fn is_image_file(path: &Path) -> bool {
    matches!(
        ext(path).as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "avif" | "ico"
    )
}

pub(crate) fn has_mod_payload(files: &[SourceFile]) -> bool {
    files.iter().any(|file| is_mod_payload_file(&file.path))
}

pub(crate) fn validate_pak_sets(files: &[SourceFile]) -> Result<(), String> {
    let mut grouped: HashMap<PathBuf, HashSet<String>> = HashMap::new();

    for file in files {
        let e = ext(&file.path);

        if e != "pak" && e != "ucas" && e != "utoc" {
            continue;
        }

        let parent = file
            .relative_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_default();

        let stem = file
            .relative_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        grouped.entry(parent.join(stem)).or_default().insert(e);
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
                name.to_string_lossy(),
                missing
                    .iter()
                    .map(|e| format!("{}.{}", name.to_string_lossy(), e))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
    }

    Ok(())
}

pub(crate) fn validate_ini_requires_asi(files: &[SourceFile]) -> Result<(), String> {
    let has_ini = files.iter().any(|file| ext(&file.path) == "ini");
    let has_asi = files.iter().any(|file| ext(&file.path) == "asi");

    if has_ini && !has_asi {
        return Err("errors.iniRequiresAsi".into());
    }

    Ok(())
}

fn is_supported_file(path: &Path) -> bool {
    matches!(
        ext(path).as_str(),
        "pak" | "ucas" | "utoc" | "asi" | "ini" | "json"
    ) || is_image_file(path)
}

fn safe_relative_path(base: &Path, path: &Path) -> Option<PathBuf> {
    let relative = path.strip_prefix(base).ok()?.to_path_buf();

    if relative
        .components()
        .any(|part| matches!(part, std::path::Component::ParentDir))
    {
        return None;
    }

    Some(relative)
}

pub(crate) fn strip_single_wrapper_folder(files: &mut [SourceFile]) {
    let Some(first_file) = files.first() else {
        return;
    };

    let Some(wrapper_name) = first_file.relative_path.components().next() else {
        return;
    };

    let wrapper_name = wrapper_name.as_os_str().to_os_string();

    let should_strip = files.iter().all(|file| {
        let mut components = file.relative_path.components();

        let Some(first) = components.next() else {
            return false;
        };

        first.as_os_str() == wrapper_name && components.next().is_some()
    });

    if !should_strip {
        return;
    }

    for file in files {
        if let Ok(stripped) = file.relative_path.strip_prefix(&wrapper_name) {
            file.relative_path = stripped.to_path_buf();
        }
    }
}

pub(crate) fn collect_supported_files(root: &Path, base: &Path, out: &mut Vec<SourceFile>) {
    let mut files = Vec::new();
    let mut has_asi = false;

    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        let path = entry.path();

        if !path.is_file() || !is_supported_file(path) {
            continue;
        }

        let Some(relative_path) = safe_relative_path(base, path) else {
            continue;
        };

        let extension = ext(path);

        if extension == "asi" {
            has_asi = true;
        }

        files.push((
            SourceFile {
                path: path.to_path_buf(),
                relative_path,
            },
            extension,
        ));
    }

    out.extend(
        files
            .into_iter()
            .filter(|(_, extension)| extension != "ini" || has_asi)
            .map(|(file, _)| file),
    );
}

pub(crate) fn collect_single_supported_file(path: &Path, out: &mut Vec<SourceFile>) {
    if !is_supported_file(path) {
        return;
    }

    let Some(file_name) = path.file_name() else {
        return;
    };

    out.push(SourceFile {
        path: path.to_path_buf(),
        relative_path: PathBuf::from(file_name),
    });
}

pub(crate) fn is_archive(path: &Path) -> bool {
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
            "errors.sevenZipMissing".to_string()
        })?;

    if !status.success() {
        return Err("errors.failedExtractArchive".into());
    }

    Ok(())
}

pub(crate) fn extract_archive(
    app: &tauri::AppHandle,
    archive_path: &Path,
    output_dir: &Path,
) -> Result<(), String> {
    match ext(archive_path).as_str() {
        "zip" => extract_zip_native(archive_path, output_dir),
        "rar" | "7z" => extract_with_7zip(app, archive_path, output_dir),
        _ => Err("errors.unsupportedArchiveFormat".into()),
    }
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

pub(crate) fn auto_apply_known_mod_icon(
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

    for entry in WalkDir::new(mod_dir).into_iter().filter_map(Result::ok) {
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
            || is_image_file(path)
        {
            continue;
        }

        if let Ok(relative) = path.strip_prefix(mod_dir) {
            files.push(relative.to_string_lossy().to_string());
        }
    }

    Ok(files)
}

pub(crate) fn refresh_auto_mod_icons_inner(app: &tauri::AppHandle) -> Result<u32, String> {
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
