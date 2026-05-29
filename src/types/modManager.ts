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
  previewImagePaths: string[]
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

export type GameVersion = "global" | "cn" | "tw"
export type SavedGameInstalls = Partial<Record<GameVersion, string>>

export type GameFolderCheck = {
  valid: boolean
  path: string
  gameVersion: GameVersion | "unknown"
  root_launcher_found: boolean

  nteglobal_folder_found: boolean
  nteglobal_game_found: boolean
  nteglobal_launcher_found: boolean
  nteglobal_update_found: boolean

  ntelauncher_folder_found: boolean
  nte_game_found: boolean
  ntelauncher_launcher_found: boolean
  nte_update_found: boolean

  ntetw_folder_found: boolean
  ntetw_game_found: boolean
  ntetw_launcher_found: boolean
  ntetw_update_found: boolean

  ht_game_found: boolean
  global_ucas_found: boolean
  global_utoc_found: boolean

  message: string
}

export type LoaderProxyEntry = {
  name: string
  custom: boolean
  enabled: boolean
}

export type LoaderProxyConfig = Record<GameVersion, LoaderProxyEntry[]>

export type LoaderFilesCheck = {
  valid: boolean
  loaderDir: string
  asiFound: boolean
  cutilsFound: boolean
  proxyDllFound: boolean
  proxyDllNames: string[]
  missingFiles: string[]
  message: string
}

export type ModsSectionProps = {
  modsView: ModsView
  visibleMods: ImportedMod[]
  pakModsWithoutCategory: ImportedMod[]
  allPakMods: ImportedMod[]
  pakCategories: ModCategory[]
  selectedMods: string[]
  draggedPakModName: string | null
  categoryNameErrors: Record<string, string>
  collapsedPakCategories: Record<string, boolean>
  collapsedUncategorized: boolean
  onModsViewChange: (view: ModsView) => void
  onAddCategoryClick: () => void
  onRefresh: () => void
  onBeginPakDrag: (modName: string) => void
  toggleModSelection: (name: string) => void
  getModStatus: (name: string) => ModUiStatus
  removeImportedMod: (name: string) => void
  updatePakCategoryName: (categoryId: string, name: string) => void
  revertPakCategoryName: (categoryId: string) => void
  movePakCategory: (categoryId: string, direction: "up" | "down") => void
  deletePakCategory: (categoryId: string) => void
  toggleUncategorizedCollapsed: () => void
  togglePakCategoryCollapsed: (categoryId: string) => void
  changePakModIcon: (modName: string) => void
  clearPakModIconForMod: (modName: string) => void
}