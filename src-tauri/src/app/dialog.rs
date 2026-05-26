#[tauri::command]
pub fn play_dialog_sound(kind: String) {
    #[cfg(target_os = "windows")]
    unsafe {
        use std::ffi::c_void;
        use std::os::windows::ffi::OsStrExt;

        #[link(name = "winmm")]
        unsafe extern "system" {
            fn PlaySoundW(psz_sound: *const u16, hmod: *mut c_void, fdw_sound: u32) -> i32;
        }

        const SND_ASYNC: u32 = 0x0001;
        const SND_ALIAS: u32 = 0x0001_0000;
        const SND_NODEFAULT: u32 = 0x0002;

        let sound_name = match kind.as_str() {
            "error" => "SystemHand",
            "warning" => "SystemQuestion",
            "success" => "SystemAsterisk",
            "info" => "SystemAsterisk",
            _ => "SystemQuestion",
        };

        let wide: Vec<u16> = std::ffi::OsStr::new(sound_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let _ = PlaySoundW(
            wide.as_ptr(),
            std::ptr::null_mut(),
            SND_ALIAS | SND_ASYNC | SND_NODEFAULT,
        );
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = kind;
    }
}
