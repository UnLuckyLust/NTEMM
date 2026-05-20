import { invoke } from "@tauri-apps/api/core"

export function setPakModIcon(modName: string, iconPath: string) {
  return invoke("set_pak_mod_icon", { modName, iconPath })
}

export function applyPakFolderIcon(folderPath: string, iconPath: string) {
  return invoke("apply_folder_icon", { folderPath, iconPath })
}

export function clearPakModIcon(modName: string) {
  return invoke("clear_pak_mod_icon", { modName })
}