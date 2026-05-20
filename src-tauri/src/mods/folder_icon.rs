use crate::mods::importer::get_mod_storage_root;

#[cfg(target_os = "windows")]
fn refresh_folder_icon(folder: &std::path::Path) {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::{
        SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNE_UPDATEITEM, SHCNF_IDLIST, SHCNF_PATHW,
    };

    let mut path: Vec<u16> = folder.as_os_str().encode_wide().collect();
    path.push(0);

    unsafe {
        SHChangeNotify(
            SHCNE_UPDATEITEM as i32,
            SHCNF_PATHW,
            path.as_ptr() as _,
            std::ptr::null(),
        );

        SHChangeNotify(
            SHCNE_ASSOCCHANGED as i32,
            SHCNF_IDLIST,
            std::ptr::null(),
            std::ptr::null(),
        );
    }
}

#[cfg(not(target_os = "windows"))]
fn refresh_folder_icon() {}

#[tauri::command]
pub fn apply_folder_icon(folder_path: String, icon_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    use std::process::Command;

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

    fs::write(&desktop_ini, content).map_err(|e| format!("Failed to write desktop.ini: {e}"))?;

    Command::new("attrib")
        .args(["+h", "+s", desktop_ini.to_string_lossy().as_ref()])
        .status()
        .map_err(|e| format!("Failed to hide desktop.ini: {e}"))?;

    Command::new("attrib")
        .args(["+r", folder.to_string_lossy().as_ref()])
        .status()
        .map_err(|e| format!("Failed to set folder readonly attribute: {e}"))?;

    refresh_folder_icon(folder);

    if let Some(parent) = folder.parent() {
        refresh_folder_icon(parent);
    }

    Ok(())
}

#[tauri::command]
pub fn set_pak_mod_icon(
    app: tauri::AppHandle,
    mod_name: String,
    icon_path: String,
) -> Result<(), String> {
    use image::{imageops::FilterType, ImageReader};
    use std::path::Path;

    let source = Path::new(&icon_path);

    if !source.exists() || !source.is_file() {
        return Err("Selected icon/image file does not exist".into());
    }

    let storage_root = get_mod_storage_root(&app)?;
    let mod_folder = storage_root.join(&mod_name);

    if !mod_folder.exists() || !mod_folder.is_dir() {
        return Err(format!(
            "Stored mod folder not found: {}",
            mod_folder.display()
        ));
    }

    let target_icon = mod_folder.join("icon.ico");
    let preview_icon = mod_folder.join("icon.png");

    let image = ImageReader::open(source)
        .map_err(|e| format!("Failed to open selected image: {e}"))?
        .decode()
        .map_err(|e| format!("Failed to decode selected image: {e}"))?;

    image
        .save(&preview_icon)
        .map_err(|e| format!("Failed to save preview image: {e}"))?;

    let icon_image = image.resize(256, 256, FilterType::Lanczos3);

    icon_image
        .save(&target_icon)
        .map_err(|e| format!("Failed to save folder icon: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn clear_pak_mod_icon(app: tauri::AppHandle, mod_name: String) -> Result<(), String> {
    use std::fs;
    use std::process::Command;

    let storage_root = get_mod_storage_root(&app)?;
    let mod_folder = storage_root.join(&mod_name);

    let ico = mod_folder.join("icon.ico");
    let preview = mod_folder.join("icon.png");
    let desktop_ini = mod_folder.join("desktop.ini");

    if ico.exists() {
        let _ = fs::remove_file(&ico);
    }

    if preview.exists() {
        let _ = fs::remove_file(&preview);
    }

    if desktop_ini.exists() {
        let _ = Command::new("attrib")
            .args(["-h", "-s", desktop_ini.to_string_lossy().as_ref()])
            .status();

        let _ = fs::remove_file(&desktop_ini);
    }

    refresh_folder_icon(&mod_folder);

    if let Some(parent) = mod_folder.parent() {
        refresh_folder_icon(parent);
    }

    let _ = Command::new("attrib")
        .args(["-r", mod_folder.to_string_lossy().as_ref()])
        .status();

    Ok(())
}
