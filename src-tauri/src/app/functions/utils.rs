use std::{
    fs,
    io::{BufReader, Read},
    path::{Path, PathBuf},
    process::Command,
};

fn same_file_contents(source: &Path, target: &Path) -> bool {
    let Ok(source_meta) = source.metadata() else {
        return false;
    };

    let Ok(target_meta) = target.metadata() else {
        return false;
    };

    if source_meta.len() != target_meta.len() {
        return false;
    }

    let Ok(source_file) = fs::File::open(source) else {
        return false;
    };

    let Ok(target_file) = fs::File::open(target) else {
        return false;
    };

    let mut source_reader = BufReader::new(source_file);
    let mut target_reader = BufReader::new(target_file);

    let mut source_buf = [0u8; 64 * 1024];
    let mut target_buf = [0u8; 64 * 1024];

    loop {
        let Ok(source_read) = source_reader.read(&mut source_buf) else {
            return false;
        };

        let Ok(target_read) = target_reader.read(&mut target_buf) else {
            return false;
        };

        if source_read != target_read {
            return false;
        }

        if source_read == 0 {
            return true;
        }

        if source_buf[..source_read] != target_buf[..target_read] {
            return false;
        }
    }
}

pub fn copy_if_changed(source: &Path, target: &Path) -> Result<(), String> {
    if target.is_file() && same_file_contents(source, target) {
        return Ok(());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|_| "errors.failedCreateFolder".to_string())?;
    }

    fs::copy(source, target).map_err(|_| "errors.failedCopyFile".to_string())?;

    Ok(())
}

pub fn open_folder_inner(path: String) -> Result<(), String> {
    let folder = PathBuf::from(path);

    if !folder.exists() {
        fs::create_dir_all(&folder).map_err(|_| "errors.failedCreateFolder".to_string())?;
    }

    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&folder)
        .spawn()
        .map_err(|_| "errors.failedOpenFolder".to_string())?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&folder)
        .spawn()
        .map_err(|_| "errors.failedOpenFolder".to_string())?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&folder)
        .spawn()
        .map_err(|_| "errors.failedOpenFolder".to_string())?;

    Ok(())
}

pub fn get_ntemm_mods_dir_inner() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "errors.failedGetAppInstallDirectory".to_string())?;

    Ok(exe_dir.join("NTEMM_Mods").to_string_lossy().to_string())
}
