use std::path::Path;
use crate::mods::import::get_mod_storage_root;

pub fn save_mod_icon_from_ico(source: &std::path::Path, mod_folder: &std::path::Path) -> Result<(), String> {
    use std::fs;

    if !source.exists() || !source.is_file() {
        return Err("Bundled icon file does not exist".into());
    }

    if !mod_folder.exists() || !mod_folder.is_dir() {
        return Err(format!("Stored mod folder not found: {}", mod_folder.display()));
    }

    let target_icon = mod_folder.join("icon.ico");

    let copy_needed = fs::metadata(source)
        .and_then(|source_meta| {
            fs::metadata(&target_icon).map(|target_meta| {
                source_meta.len() != target_meta.len()
            })
        })
        .unwrap_or(true);

    if copy_needed {
        fs::copy(source, &target_icon)
            .map_err(|e| format!("Failed to copy bundled mod icon: {e}"))?;
    }

    Ok(())
}

pub fn save_mod_icon_from_image(source: &Path, mod_folder: &Path) -> Result<(), String> {
    use image::{imageops::FilterType, ImageReader};

    if !source.exists() || !source.is_file() {
        return Err("Selected icon/image file does not exist".into());
    }

    if !mod_folder.exists() || !mod_folder.is_dir() {
        return Err(format!("Stored mod folder not found: {}", mod_folder.display()));
    }

    let target_icon = mod_folder.join("icon.ico");
    let preview_icon = mod_folder.join("icon.png");

    let image = ImageReader::open(source)
        .map_err(|e| format!("Failed to open icon image: {e}"))?
        .decode()
        .map_err(|e| format!("Failed to decode icon image: {e}"))?;

    image
        .save(&preview_icon)
        .map_err(|e| format!("Failed to save preview image: {e}"))?;

    let icon_image = image.resize(256, 256, FilterType::Lanczos3);

    icon_image
        .save(&target_icon)
        .map_err(|e| format!("Failed to save folder icon: {e}"))?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn wide_path(path: &std::path::Path) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    path.as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(target_os = "windows")]
fn refresh_folder_icon(folder: &std::path::Path) {
    use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_UPDATEITEM, SHCNF_PATHW};

    let path = wide_path(folder);

    unsafe {
        SHChangeNotify(
            SHCNE_UPDATEITEM as i32,
            SHCNF_PATHW,
            path.as_ptr() as _,
            std::ptr::null(),
        );
    }
}

#[cfg(not(target_os = "windows"))]
fn refresh_folder_icon(_folder: &std::path::Path) {}

#[cfg(target_os = "windows")]
fn set_file_attributes(path: &std::path::Path, attributes: u32) -> Result<(), String> {
    use windows_sys::Win32::Storage::FileSystem::SetFileAttributesW;

    let path = wide_path(path);

    unsafe {
        if SetFileAttributesW(path.as_ptr(), attributes) == 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn apply_desktop_ini_attributes(
    folder: &std::path::Path,
    desktop_ini: &std::path::Path,
) -> Result<(), String> {
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_READONLY, FILE_ATTRIBUTE_SYSTEM,
    };

    set_file_attributes(desktop_ini, FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM)
        .map_err(|e| format!("Failed to set desktop.ini attributes: {e}"))?;

    set_file_attributes(folder, FILE_ATTRIBUTE_READONLY)
        .map_err(|e| format!("Failed to set folder readonly attribute: {e}"))?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn apply_desktop_ini_attributes(
    _folder: &std::path::Path,
    _desktop_ini: &std::path::Path,
) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_folder_icon_attributes(folder: &std::path::Path, desktop_ini: &std::path::Path) {
    use windows_sys::Win32::Storage::FileSystem::{FILE_ATTRIBUTE_ARCHIVE, FILE_ATTRIBUTE_NORMAL};

    if desktop_ini.exists() {
        let _ = set_file_attributes(desktop_ini, FILE_ATTRIBUTE_NORMAL);
    }

    let _ = set_file_attributes(folder, FILE_ATTRIBUTE_ARCHIVE);
}

#[cfg(not(target_os = "windows"))]
fn clear_folder_icon_attributes(_folder: &std::path::Path, _desktop_ini: &std::path::Path) {}

#[tauri::command]
pub fn apply_folder_icon_inner(folder_path: String, icon_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let folder = Path::new(&folder_path);
    let icon = Path::new(&icon_path);

    if !folder.exists() || !folder.is_dir() {
        return Err("Target folder does not exist".into());
    }

    if !icon.exists() || !icon.is_file() {
        return Ok(());
    }

    let desktop_ini = folder.join("desktop.ini");

    let icon_path = icon
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize icon path: {e}"))?;

    let content = format!(
        "[.ShellClassInfo]\r\nIconResource={},0\r\n",
        icon_path.to_string_lossy()
    );

    let write_needed = fs::read_to_string(&desktop_ini)
        .map(|existing| existing != content)
        .unwrap_or(true);

    if write_needed {
        fs::write(&desktop_ini, content)
            .map_err(|e| format!("Failed to write desktop.ini: {e}"))?;
    }

    apply_desktop_ini_attributes(folder, &desktop_ini)?;

    refresh_folder_icon(folder);

    if let Some(parent) = folder.parent() {
        refresh_folder_icon(parent);
    }

    Ok(())
}

#[tauri::command]
pub async fn apply_folder_icon(folder_path: String, icon_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::app::elevated::run_folder_icon_elevated(
            crate::app::elevated::ElevatedFolderIconRequest {
                folder_path,
                icon_path,
            },
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_pak_mod_icon(
    app: tauri::AppHandle,
    mod_name: String,
    icon_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::path::Path;

        let storage_root = get_mod_storage_root(&app)?;
        let mod_folder = storage_root.join(&mod_name);

        save_mod_icon_from_image(Path::new(&icon_path), &mod_folder)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn clear_pak_mod_icon(app: tauri::AppHandle, mod_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::fs;

        let storage_root = get_mod_storage_root(&app)?;
        let mod_folder = storage_root.join(&mod_name);

        let ico = mod_folder.join("icon.ico");
        let preview = mod_folder.join("icon.png");
        let desktop_ini = mod_folder.join("desktop.ini");

        clear_folder_icon_attributes(&mod_folder, &desktop_ini);

        if ico.exists() {
            let _ = fs::remove_file(&ico);
        }

        if preview.exists() {
            let _ = fs::remove_file(&preview);
        }

        if desktop_ini.exists() {
            let _ = fs::remove_file(&desktop_ini);
        }

        refresh_folder_icon(&mod_folder);

        if let Some(parent) = mod_folder.parent() {
            refresh_folder_icon(parent);
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
