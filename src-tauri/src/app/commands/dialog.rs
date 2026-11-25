#[tauri::command]
pub fn play_dialog_sound(kind: String) {
    super::dialog_functions::play_dialog_sound_inner(&kind);
}
