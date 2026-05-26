export type ImportResult = {
  success: boolean
  mod_name: string
  output_path: string
  warnings: string[]
  copied_files: string[]
}

export type ModMetadata = {
  name?: string
  version?: string
  author?: string
  description?: string
  modLink?: string
  supportLink?: string
  image?: string
  tags?: string[]
}

export type ImportedMod = {
  name: string
  path: string
  files: string[]
  iconPath?: string | null
  metadata?: ModMetadata | null
  metadataError?: string | null
}

export type ImportAnalysis = {
  suggestedName: string | null
  nameConflict: boolean
}

export type ModInstallStatus = {
  name: string
  status: "enabled" | "disabled" | "needs_fix"
  installed_files: number
  expected_files: number
  missing_files: string[]
}

export type ModCategory = {
  id: string
  name: string
  modNames: string[]
}

export type ModsView = "pak" | "asi"
export type ModUiStatus = "Enabled" | "Disabled" | "Needs Fix" | "Pending Enable" | "Pending Disable" | "Pending Move"
export type CategoryMoveDirection = "up" | "down"

export type GameFolderCheck = {
  valid: boolean
  path: string
  gameVersion: "global" | "cn" | "tw" | "unknown"
  root_launcher_found: boolean
  nteglobal_folder_found: boolean
  nteglobal_game_found: boolean
  nteglobal_launcher_found: boolean
  nteglobal_update_found: boolean
  ht_game_found: boolean
  global_ucas_found: boolean
  global_utoc_found: boolean
  message: string
}

export type LoaderFilesCheck = {
  valid: boolean
  loaderDir: string
  asiFound: boolean
  cutilsFound: boolean
  proxyDllFound: boolean
  missingFiles: string[]
  message: string
}