use super::structs::{
    ElevatedApplyModsRequest, ElevatedFolderIconRequest, ElevatedLoaderFilesRequest,
    ElevatedOpenFolderRequest, ElevatedResult,
};
use std::{fs, path::PathBuf};

#[cfg(target_os = "windows")]
use std::{ffi::OsStr, os::windows::ffi::OsStrExt};

#[cfg(target_os = "windows")]
fn wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
fn wide_str(value: &str) -> Vec<u16> {
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(target_os = "windows")]
pub(crate) fn is_elevated() -> bool {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token = std::ptr::null_mut();

        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;

        let ok = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            size,
            &mut size,
        );

        CloseHandle(token);

        ok != 0 && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn is_elevated() -> bool {
    true
}

pub fn needs_elevation_for_path(path: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::path::{Component, Path, Prefix};

        for component in Path::new(path).components() {
            if let Component::Prefix(prefix) = component {
                return match prefix.kind() {
                    Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) => {
                        drive.to_ascii_uppercase() == b'C'
                    }
                    _ => false,
                };
            }
        }

        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        false
    }
}

#[cfg(target_os = "windows")]
fn run_as_admin_and_wait(args: &str) -> Result<(), String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{WaitForSingleObject, INFINITE};
    use windows_sys::Win32::UI::Shell::{
        ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    };

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    let verb = wide_str("runas");
    let file = wide(exe.as_os_str());
    let parameters = wide_str(args);

    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        hwnd: std::ptr::null_mut(),
        lpVerb: verb.as_ptr(),
        lpFile: file.as_ptr(),
        lpParameters: parameters.as_ptr(),
        lpDirectory: std::ptr::null(),
        nShow: 0,
        hInstApp: std::ptr::null_mut(),
        lpIDList: std::ptr::null_mut(),
        lpClass: std::ptr::null(),
        hkeyClass: std::ptr::null_mut(),
        dwHotKey: 0,
        Anonymous: Default::default(),
        hProcess: std::ptr::null_mut(),
    };

    unsafe {
        if ShellExecuteExW(&mut info) == 0 {
            return Err("errors.adminPermissionCancelledOrFailed".into());
        }

        if !info.hProcess.is_null() {
            WaitForSingleObject(info.hProcess, INFINITE);
            CloseHandle(info.hProcess);
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn run_as_admin_and_wait(_args: &str) -> Result<(), String> {
    Err("errors.adminActionFailed".to_string())
}

fn bundled_resource_root() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    Ok(exe
        .parent()
        .ok_or("errors.failedResolveAppFolder")?
        .join("resources"))
}

fn apply_bundled_mods_from_request(request: &ElevatedApplyModsRequest) -> Result<(), String> {
    let has_bundled_changes = request.hide_uid_enabled.is_some()
        || request.hide_ping_enabled.is_some()
        || request.anticensor_enabled.is_some();

    if !has_bundled_changes {
        return Ok(());
    }

    let resource_root = bundled_resource_root()?;
    let game_check = crate::game::game::validate(std::path::Path::new(&request.game_path));

    if !game_check.valid {
        return Err("errors.invalidGameFolder".to_string());
    }

    let loader_check = crate::game::loader::check_loader_files_inner(&request.game_path, None);
    let loader_installed = loader_check.valid;

    if let Some(enabled) = request.hide_uid_enabled {
        crate::mods::ui_mods::set_ui_mod_inner_with_loader_status(
            &resource_root,
            request.game_path.clone(),
            "hide_uid".to_string(),
            enabled,
            loader_installed,
        )?;
    }

    if let Some(enabled) = request.hide_ping_enabled {
        crate::mods::ui_mods::set_ui_mod_inner_with_loader_status(
            &resource_root,
            request.game_path.clone(),
            "hide_ping".to_string(),
            enabled,
            loader_installed,
        )?;
    }

    if let Some(enabled) = request.anticensor_enabled {
        crate::mods::anticensor::set_anticensor_mod_inner_with_loader_status(
            &resource_root,
            request.game_path.clone(),
            enabled,
            loader_installed,
        )?;
    }

    Ok(())
}

pub fn run_apply_mod_selection_elevated(
    request: ElevatedApplyModsRequest,
) -> Result<Vec<String>, String> {
    if is_elevated() || !needs_elevation_for_path(&request.game_path) {
        let active = crate::mods::manage::apply_mod_selection_inner(
            request.game_path.clone(),
            request.selected_mods.clone(),
            request.pak_categories.clone(),
        )?;

        apply_bundled_mods_from_request(&request)?;

        return Ok(active);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let request_path = std::env::temp_dir().join(format!("ntemm_apply_request_{id}.json"));
    let result_path = std::env::temp_dir().join(format!("ntemm_apply_result_{id}.json"));

    fs::write(
        &request_path,
        serde_json::to_string(&request).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let args = format!(
        "--ntemm-elevated apply-mod-selection \"{}\" \"{}\"",
        request_path.to_string_lossy(),
        result_path.to_string_lossy()
    );

    run_as_admin_and_wait(&args)?;

    let result_text = fs::read_to_string(&result_path)
        .map_err(|_| "errors.adminActionNoResult".to_string())?;

    let _ = fs::remove_file(&request_path);
    let _ = fs::remove_file(&result_path);

    let result: ElevatedResult<Vec<String>> =
        serde_json::from_str(&result_text).map_err(|e| e.to_string())?;

    if result.ok {
        Ok(result.data.unwrap_or_default())
    } else {
        Err(result
            .error
            .unwrap_or_else(|| "errors.adminActionFailed".into()))
    }
}

pub fn run_loader_files_elevated(
    request: ElevatedLoaderFilesRequest,
) -> Result<crate::game::loader::LoaderFilesCheck, String> {
    if is_elevated() || !needs_elevation_for_path(&request.path) {
        if request.clean {
            return crate::game::loader::clean_game_mods_inner(
                request.path,
                request.all_proxy_dll_names,
            );
        }

        if request.install {
            let resource_root = bundled_resource_root()?;

            return crate::game::loader::install_loader_files_inner(
                &resource_root,
                request.path,
                request.proxy_dll_names,
                request.all_proxy_dll_names,
            );
        }

        return crate::game::loader::uninstall_loader_files_inner(
            request.path,
            request.all_proxy_dll_names,
        );
    }

    let id = uuid::Uuid::new_v4().to_string();
    let request_path = std::env::temp_dir().join(format!("ntemm_loader_request_{id}.json"));
    let result_path = std::env::temp_dir().join(format!("ntemm_loader_result_{id}.json"));

    fs::write(
        &request_path,
        serde_json::to_string(&request).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let args = format!(
        "--ntemm-elevated loader-files \"{}\" \"{}\"",
        request_path.to_string_lossy(),
        result_path.to_string_lossy()
    );

    run_as_admin_and_wait(&args)?;

    let result_text = fs::read_to_string(&result_path)
        .map_err(|_| "errors.adminActionNoResult".to_string())?;

    let _ = fs::remove_file(&request_path);
    let _ = fs::remove_file(&result_path);

    let result: ElevatedResult<crate::game::loader::LoaderFilesCheck> =
        serde_json::from_str(&result_text).map_err(|e| e.to_string())?;

    if result.ok {
        result
            .data
            .ok_or_else(|| "errors.adminActionNoLoaderResult".to_string())
    } else {
        Err(result
            .error
            .unwrap_or_else(|| "errors.adminActionFailed".into()))
    }
}

pub fn run_open_folder_elevated(request: ElevatedOpenFolderRequest) -> Result<(), String> {
    if is_elevated() || !needs_elevation_for_path(&request.path) {
        return super::utils_functions::open_folder_inner(request.path);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let request_path = std::env::temp_dir().join(format!("ntemm_open_folder_request_{id}.json"));
    let result_path = std::env::temp_dir().join(format!("ntemm_open_folder_result_{id}.json"));

    fs::write(
        &request_path,
        serde_json::to_string(&request).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let args = format!(
        "--ntemm-elevated open-folder \"{}\" \"{}\"",
        request_path.to_string_lossy(),
        result_path.to_string_lossy()
    );

    run_as_admin_and_wait(&args)?;

    let result_text = fs::read_to_string(&result_path)
        .map_err(|_| "errors.adminActionNoResult".to_string())?;

    let _ = fs::remove_file(&request_path);
    let _ = fs::remove_file(&result_path);

    let result: ElevatedResult<()> =
        serde_json::from_str(&result_text).map_err(|e| e.to_string())?;

    if result.ok {
        Ok(())
    } else {
        Err(result
            .error
            .unwrap_or_else(|| "errors.adminActionFailed".into()))
    }
}

pub fn run_folder_icon_elevated(request: ElevatedFolderIconRequest) -> Result<(), String> {
    if is_elevated() || !needs_elevation_for_path(&request.folder_path) {
        return crate::mods::folder_icon::apply_folder_icon_inner(
            request.folder_path,
            request.icon_path,
        );
    }

    let id = uuid::Uuid::new_v4().to_string();
    let request_path = std::env::temp_dir().join(format!("ntemm_folder_icon_request_{id}.json"));
    let result_path = std::env::temp_dir().join(format!("ntemm_folder_icon_result_{id}.json"));

    fs::write(
        &request_path,
        serde_json::to_string(&request).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let args = format!(
        "--ntemm-elevated folder-icon \"{}\" \"{}\"",
        request_path.to_string_lossy(),
        result_path.to_string_lossy()
    );

    run_as_admin_and_wait(&args)?;

    let result_text = fs::read_to_string(&result_path)
        .map_err(|_| "errors.adminActionNoResult".to_string())?;

    let _ = fs::remove_file(&request_path);
    let _ = fs::remove_file(&result_path);

    let result: ElevatedResult<()> =
        serde_json::from_str(&result_text).map_err(|e| e.to_string())?;

    if result.ok {
        Ok(())
    } else {
        Err(result
            .error
            .unwrap_or_else(|| "errors.adminActionFailed".into()))
    }
}

pub fn handle_elevated_cli() -> bool {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 5 || args[1] != "--ntemm-elevated" {
        return false;
    }

    let action = &args[2];
    let request_path = PathBuf::from(&args[3]);
    let result_path = PathBuf::from(&args[4]);

    match action.as_str() {
        "apply-mod-selection" => {
            let result = run_apply_mod_selection_from_file(&request_path);
            let output = match result {
                Ok(data) => ElevatedResult {
                    ok: true,
                    data: Some(data),
                    error: None,
                },
                Err(error) => ElevatedResult::<Vec<String>> {
                    ok: false,
                    data: None,
                    error: Some(error),
                },
            };

            write_elevated_result(&result_path, &output);
            true
        }
        "loader-files" => {
            let result = run_loader_files_from_file(&request_path);
            let output = match result {
                Ok(data) => ElevatedResult {
                    ok: true,
                    data: Some(data),
                    error: None,
                },
                Err(error) => ElevatedResult::<crate::game::loader::LoaderFilesCheck> {
                    ok: false,
                    data: None,
                    error: Some(error),
                },
            };

            write_elevated_result(&result_path, &output);
            true
        }
        "open-folder" => {
            let result = run_open_folder_from_file(&request_path);
            let output = match result {
                Ok(()) => ElevatedResult::<()> {
                    ok: true,
                    data: None,
                    error: None,
                },
                Err(error) => ElevatedResult::<()> {
                    ok: false,
                    data: None,
                    error: Some(error),
                },
            };

            write_elevated_result(&result_path, &output);
            true
        }
        "folder-icon" => {
            let result = run_folder_icon_from_file(&request_path);
            let output = match result {
                Ok(()) => ElevatedResult::<()> {
                    ok: true,
                    data: None,
                    error: None,
                },
                Err(error) => ElevatedResult::<()> {
                    ok: false,
                    data: None,
                    error: Some(error),
                },
            };

            write_elevated_result(&result_path, &output);
            true
        }
        _ => false,
    }
}

fn write_elevated_result<T: serde::Serialize>(path: &PathBuf, result: &ElevatedResult<T>) {
    let json = serde_json::to_string(result).unwrap_or_else(|_| {
        r#"{"ok":false,"data":null,"error":"errors.failedSerializeResult"}"#.to_string()
    });

    let _ = fs::write(path, json);
}

fn run_apply_mod_selection_from_file(path: &PathBuf) -> Result<Vec<String>, String> {
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let request: ElevatedApplyModsRequest =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;

    let active = crate::mods::manage::apply_mod_selection_inner(
        request.game_path.clone(),
        request.selected_mods.clone(),
        request.pak_categories.clone(),
    )?;

    apply_bundled_mods_from_request(&request)?;

    Ok(active)
}

fn run_loader_files_from_file(
    path: &PathBuf,
) -> Result<crate::game::loader::LoaderFilesCheck, String> {
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let request: ElevatedLoaderFilesRequest =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;

    if request.clean {
        return crate::game::loader::clean_game_mods_inner(
            request.path,
            request.all_proxy_dll_names,
        );
    }

    if request.install {
        let resource_root = bundled_resource_root()?;

        return crate::game::loader::install_loader_files_inner(
            &resource_root,
            request.path,
            request.proxy_dll_names,
            request.all_proxy_dll_names,
        );
    }

    crate::game::loader::uninstall_loader_files_inner(request.path, request.all_proxy_dll_names)
}

fn run_open_folder_from_file(path: &PathBuf) -> Result<(), String> {
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let request: ElevatedOpenFolderRequest =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;

    super::utils_functions::open_folder_inner(request.path)
}

fn run_folder_icon_from_file(path: &PathBuf) -> Result<(), String> {
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let request: ElevatedFolderIconRequest =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;

    crate::mods::folder_icon::apply_folder_icon_inner(request.folder_path, request.icon_path)
}
