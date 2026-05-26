import { invoke } from "@tauri-apps/api/core"
import type { ImportResult, ImportedMod, ImportAnalysis, ModCategory, ModInstallStatus } from "@/types/modManager"
import { buildPakCategoriesPayload } from "@/helpers/modCategories"

export function listImportedMods() {
  return invoke<ImportedMod[]>("list_imported_mods")
}

export function refreshAutoModIcons() {
  return invoke<number>("refresh_auto_mod_icons")
}

export function getModInstallStatuses(gamePath: string) {
  return invoke<ModInstallStatus[]>("get_mod_install_statuses", { gamePath })
}

export function validateModPaths(paths: string[]) {
  return invoke("validate_mod_paths", { paths })
}

export function importModPaths(params: {
  paths: string[]
  modName: string
  overwrite: boolean
}) {
  return invoke<ImportResult>("import_mod_paths", params)
}

export function analyzeImportPaths(paths: string[]) {
  return invoke<ImportAnalysis>("analyze_import_paths", { paths })
}

export function removeImportedModCommand(name: string) {
  return invoke("remove_imported_mod", { name })
}

export function applyModSelection(params: {
  gamePath: string
  selectedMods: string[]
  pakCategories: ModCategory[]
  hideUidEnabled?: boolean
  hidePingEnabled?: boolean
  anticensorEnabled?: boolean
}) {
  return invoke<string[]>("apply_mod_selection", {
    gamePath: params.gamePath,
    selectedMods: params.selectedMods,
    pakCategories: buildPakCategoriesPayload(params.pakCategories),
    hideUidEnabled: params.hideUidEnabled,
    hidePingEnabled: params.hidePingEnabled,
    anticensorEnabled: params.anticensorEnabled,
  })
}

export function launchGameCommand(path: string) {
  return invoke("launch_game", { path })
}
