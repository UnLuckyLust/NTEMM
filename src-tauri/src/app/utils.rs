use std::{
    fs,
    io::{BufReader, Read},
    path::Path,
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
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create {}: {e}", parent.display()))?;
    }

    fs::copy(source, target).map_err(|e| {
        format!(
            "Failed to copy {} to {}: {e}",
            source.display(),
            target.display()
        )
    })?;

    Ok(())
}