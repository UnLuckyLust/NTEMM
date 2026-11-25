import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { loaderVersions } from "@lib/config"
import { dialog } from "@/lib/dialog";
import { useI18n } from "@/i18n"
import type {
  CategoryMoveDirection,
  ImportedMod,
  ImportResult,
  ModCategory,
  ModInstallStatus,
  ModsView,
  LoaderFilesCheck,
  GameFolderCheck,
  GameVersion,
} from "@/types/modManager"
import {
  createPakCategory,
  deletePakCategory as deletePakCategoryHelper,
  getCategoryNameError,
  movePakCategory as movePakCategoryHelper,
  renamePakCategory,
} from "@/helpers/modCategories"
import { getPakModsWithoutCategory, isAsiMod, isPakMod, suggestModName } from "@/helpers/modFilters"
import {
  getAppliedPakInstallLocations,
  getModUiStatus,
  hasPendingModChanges,
} from "@/helpers/modStatus"
import {
  getGameFolder,
  loadAppliedPakInstallLocationByMod,
  loadCollapsedUncategorized,
  loadCollapsedPakCategories,
  loadPakCategories,
  loadStoredLoaderVersions,
  loadUncategorizedPakMods,
  removeStoredLoaderVersions,
  saveAppliedPakInstallLocationByMod,
  saveCollapsedUncategorized,
  saveCollapsedPakCategories,
  savePakCategories,
  saveStoredLoaderVersions,
  saveUncategorizedPakMods,
  shouldCloseOnLaunch,
} from "@/helpers/modStorage"
import {
  analyzeImportPaths,
  applyModSelection,
  getModInstallStatuses,
  importModPaths,
  launchGameCommand,
  listImportedMods,
  refreshAutoModIcons,
  removeImportedModCommand,
  renameImportedModCommand,
  validateModPaths,
} from "@/helpers/tauriModCommands"
import {
  getEnabledLoaderProxyNames,
  getKnownLoaderProxyNames,
  readLoaderProxyConfig,
} from "@/helpers/loaderProxySettings"
import { setPakModIcon, clearPakModIcon } from "@/helpers/folderIcons"

function isKnownGameVersion(version: unknown): version is GameVersion {
  return version === "global" || version === "cn" || version === "tw"
}

function moveItemBefore(list: string[], item: string, beforeItem: string | null) {
  const withoutItem = list.filter((name) => name !== item)

  if (!beforeItem) {
    return [...withoutItem, item]
  }

  const targetIndex = withoutItem.indexOf(beforeItem)

  if (targetIndex === -1) {
    return [...withoutItem, item]
  }

  return [
    ...withoutItem.slice(0, targetIndex),
    item,
    ...withoutItem.slice(targetIndex),
  ]
}

function replaceModName(list: string[], oldName: string, newName: string) {
  return list.map((name) => (name === oldName ? newName : name))
}

export function useModManager() {
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isReadingImport, setIsReadingImport] = useState(false)
  const [lastImport, setLastImport] = useState<ImportResult | null>(null)
  const [importedMods, setImportedMods] = useState<ImportedMod[]>([])
  const [pendingPaths, setPendingPaths] = useState<string[] | null>(null)
  const [modName, setModName] = useState("")
  const [showLastImport, setShowLastImport] = useState(false)
  const [modsView, setModsView] = useState<ModsView>("pak")
  const [activeMods, setActiveMods] = useState<string[]>([])
  const [selectedMods, setSelectedMods] = useState<string[]>([])
  const [modStatuses, setModStatuses] = useState<ModInstallStatus[]>([])
  const [pakCategories, setPakCategories] = useState<ModCategory[]>([])
  const [uncategorizedPakMods, setUncategorizedPakMods] = useState<string[]>([])
  const [draggedPakModName, setDraggedPakModName] = useState<string | null>(null)
  const [appliedPakInstallLocationByMod, setAppliedPakInstallLocationByMod] =
    useState<Record<string, string>>({})
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [categoryDialogError, setCategoryDialogError] = useState("")
  const [categoryNameErrors, setCategoryNameErrors] = useState<Record<string, string>>({})
  const [lastValidCategoryNames, setLastValidCategoryNames] = useState<Record<string, string>>({})
  const [collapsedUncategorized, setCollapsedUncategorized] = useState(false)
  const [collapsedPakCategories, setCollapsedPakCategories] = useState<Record<string, boolean>>({})
  const [loaderCheck, setLoaderCheck] = useState<LoaderFilesCheck | null>(null)
  const [hideUidInstalled, setHideUidInstalled] = useState(false)
  const [hideUidSelected, setHideUidSelected] = useState(false)
  const [hidePingInstalled, setHidePingInstalled] = useState(false)
  const [hidePingSelected, setHidePingSelected] = useState(false)
  const [anticensorInstalled, setAnticensorInstalled] = useState(false)
  const [anticensorSelected, setAnticensorSelected] = useState(false)
  const [isRunningAsAdmin, setIsRunningAsAdmin] = useState(false)
  const [gameVersion, setGameVersion] = useState<GameVersion | null>(null)

  const importingRef = useRef(false)
  const validatingDropRef = useRef(false)
  const readingImportRef = useRef(false)
  const lastDropRef = useRef(0)
  const internalDragRef = useRef(false)
  const dragScrollFrameRef = useRef<number | null>(null)
  const dragScrollSpeedRef = useRef(0)
  const modStatusesInitializedRef = useRef(false)
  const { t } = useI18n()

  const bundledInstalledRef = useRef({
    hideUidInstalled: false,
    hidePingInstalled: false,
    anticensorInstalled: false,
  })

  const visibleMods = useMemo(
    () => (modsView === "pak" ? importedMods.filter(isPakMod) : importedMods.filter(isAsiMod)),
    [importedMods, modsView],
  )

  const pakModsWithoutCategory = useMemo(() => {
    const uncategorizedMods = getPakModsWithoutCategory(importedMods, pakCategories)

    const orderedMods = uncategorizedPakMods
      .map((modName) => uncategorizedMods.find((mod) => mod.name === modName))
      .filter((mod): mod is ImportedMod => Boolean(mod))

    const newMods = uncategorizedMods.filter(
      (mod) => !uncategorizedPakMods.includes(mod.name),
    )

    return [...orderedMods, ...newMods]
  }, [importedMods, pakCategories, uncategorizedPakMods])

  const loadImportedMods = useCallback(async () => {
    const mods = await listImportedMods()
    setImportedMods(mods)
  }, [])

  const loadModStatuses = useCallback(async () => {
    const gameFolder = getGameFolder()
    if (!gameFolder) return

    const statuses = await getModInstallStatuses(gameFolder)
    setModStatuses(statuses)

    const active = statuses
      .filter((mod) => mod.status === "enabled")
      .map((mod) => mod.name)

    setActiveMods(active)

    setSelectedMods((currentSelected) => {
      if (!modStatusesInitializedRef.current) {
        modStatusesInitializedRef.current = true
        return active
      }

      const hasPendingSelection =
        currentSelected.length !== activeMods.length ||
        currentSelected.some((modName) => !activeMods.includes(modName))

      return hasPendingSelection ? currentSelected : active
    })
  }, [activeMods])

  const refreshBundledMods = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      setHideUidInstalled(false)
      setHideUidSelected(false)

      setHidePingInstalled(false)
      setHidePingSelected(false)

      setAnticensorInstalled(false)
      setAnticensorSelected(false)
      return
    }

    const uiStatus = await invoke<{
      hideUidInstalled: boolean
      hidePingInstalled: boolean
    }>("check_ui_mods", {
      path: gameFolder,
    })

    const previousInstalled = bundledInstalledRef.current

    setHideUidInstalled(uiStatus.hideUidInstalled)
    setHideUidSelected((currentSelected) =>
      currentSelected !== previousInstalled.hideUidInstalled
        ? currentSelected
        : uiStatus.hideUidInstalled,
    )

    setHidePingInstalled(uiStatus.hidePingInstalled)
    setHidePingSelected((currentSelected) =>
      currentSelected !== previousInstalled.hidePingInstalled
        ? currentSelected
        : uiStatus.hidePingInstalled,
    )

    const anticensorStatus = await invoke<{ installed: boolean }>("check_anticensor_mod", {
      path: gameFolder,
    })

    setAnticensorInstalled(anticensorStatus.installed)
    setAnticensorSelected((currentSelected) =>
      currentSelected !== previousInstalled.anticensorInstalled
        ? currentSelected
        : anticensorStatus.installed,
    )
  }, [])

  const refreshGameVersion = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      setGameVersion(null)
      setAppliedPakInstallLocationByMod({})
      return
    }

    try {
      const result = await invoke<GameFolderCheck>("check_game_folder", {
        path: gameFolder,
      })

      const nextVersion = result.valid && isKnownGameVersion(result.gameVersion)
        ? result.gameVersion
        : null

      setGameVersion(nextVersion)
      setAppliedPakInstallLocationByMod(loadAppliedPakInstallLocationByMod(nextVersion))
    } catch {
      setGameVersion(null)
      setAppliedPakInstallLocationByMod({})
    }
  }, [])

  const refreshDetectedState = useCallback(async () => {
    void refreshGameVersion()
    void loadModStatuses()
    void refreshBundledMods()

    try {
      await refreshAutoModIcons()
    } catch (err) {
      console.warn("Auto icon refresh failed:", err)
    }

    await loadImportedMods()
  }, [refreshGameVersion, loadImportedMods, loadModStatuses, refreshBundledMods])

  const launchGame = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await dialog({
        title: t("dialogs.gameFolderMissingTitle"),
        message: t("dialogs.configureGameFolderFirst"),
        kind: "warning",
      });
      return
    }

    try {
      await launchGameCommand(gameFolder)

      if (shouldCloseOnLaunch()) {
        await getCurrentWindow().close()
      }
    } catch (err) {
      await dialog({
        title: t("dialogs.launchFailedTitle"),
        message: String(err),
        kind: "error",
      });
    }
  }, [t])

  const toggleModSelection = useCallback((name: string) => {
    setSelectedMods((prev) =>
      prev.includes(name)
        ? prev.filter((modName) => modName !== name)
        : [...prev, name],
    )
  }, [])

  const getModStatus = useCallback(
    (name: string) =>
      getModUiStatus({
        name,
        activeMods,
        selectedMods,
        modStatuses,
        pakCategories,
        appliedPakInstallLocationByMod,
      }),
    [activeMods, appliedPakInstallLocationByMod, modStatuses, pakCategories, selectedMods],
  )

  const getBundledModStatus = useCallback((installed: boolean, selected: boolean) => {
    if (installed && selected) return "Enabled"
    if (!installed && !selected) return "Disabled"
    if (!installed && selected) return "Pending Enable"
    return "Pending Disable"
  }, [])

  const hasPendingChanges = useCallback(
    () =>
      hasPendingModChanges({
        activeMods,
        selectedMods,
        categoryNameErrors,
        pakCategories,
        appliedPakInstallLocationByMod,
      }) ||
      hideUidInstalled !== hideUidSelected ||
      hidePingInstalled !== hidePingSelected ||
      anticensorInstalled !== anticensorSelected,
    [
      activeMods,
      selectedMods,
      categoryNameErrors,
      pakCategories,
      appliedPakInstallLocationByMod,
      hideUidInstalled,
      hideUidSelected,
      hidePingInstalled,
      hidePingSelected,
      anticensorInstalled,
      anticensorSelected,
    ],
  )

  const removeImportedMod = useCallback(
    async (name: string) => {
      const isActive = activeMods.includes(name)

      const confirmed = await dialog({
        title: t("dialogs.deleteImportedModTitle"),
        message: isActive
          ? t("dialogs.deleteImportedActiveModMessage", { name })
          : t("dialogs.deleteImportedModMessage", { name }),
        kind: "warning",
        isCancel: true,
        okLabel: t("common.delete"),
        cancelLabel: t("common.cancel"),
      });

      if (!confirmed.ok) return

      try {
        if (isActive) {
          const gameFolder = getGameFolder()

          if (!gameFolder) {
            await dialog({
              title: t("dialogs.gameFolderMissingTitle"),
              message: t("dialogs.activeModRemovalNeedsGameFolder"),
              kind: "warning",
            });
            return
          }

          const nextSelectedMods = selectedMods.filter((modName) => modName !== name)

          await applyModSelection({
            gamePath: gameFolder,
            selectedMods: nextSelectedMods,
            pakCategories,
          })

          setActiveMods(nextSelectedMods)
          setSelectedMods(nextSelectedMods)
        }

        await removeImportedModCommand(name)

        setPakCategories((prev) =>
          prev.map((category) => ({
            ...category,
            modNames: category.modNames.filter((modName) => modName !== name),
          })),
        )

        setUncategorizedPakMods((prev) => prev.filter((modName) => modName !== name))

        await loadImportedMods()
        await loadModStatuses()
      } catch (err) {
        await dialog({
          title: t("dialogs.deleteFailedTitle"),
          message: String(err),
          kind: "error",
        });
      }
    },
    [activeMods, loadImportedMods, loadModStatuses, pakCategories, selectedMods, t],
  )

  const getModRenameError = useCallback(
    (oldName: string, newName: string) => {
      const trimmedName = newName.trim()

      if (!trimmedName) {
        return t("mods.renameErrors.empty")
      }

      if (/[<>:"/\\|?*\x00-\x1F]/.test(trimmedName)) {
        return t("mods.renameErrors.invalid")
      }

      const hasConflict = importedMods.some(
        (mod) =>
          mod.name.toLowerCase() === trimmedName.toLowerCase() &&
          mod.name.toLowerCase() !== oldName.toLowerCase(),
      )

      return hasConflict ? t("mods.renameErrors.exists") : ""
    },
    [importedMods, t],
  )

  const renameImportedMod = useCallback(
    async (oldName: string, newName: string) => {
      const renameError = getModRenameError(oldName, newName)

      if (renameError) {
        await dialog({
          title: t("dialogs.renameFailedTitle"),
          message: renameError,
          kind: "error",
        })

        return null
      }

      const trimmedName = newName.trim()

      if (trimmedName === oldName) {
        return oldName
      }

      const gameFolder = getGameFolder()
      const wasActive = activeMods.includes(oldName)
      const wasSelected = selectedMods.includes(oldName)

      if (wasActive && !gameFolder) {
        await dialog({
          title: t("dialogs.gameFolderMissingTitle"),
          message: t("dialogs.activeModRenameNeedsGameFolder"),
          kind: "warning",
        })

        return null
      }

      try {
        const selectedWithoutOld = selectedMods.filter((name) => name !== oldName)

        if (wasActive && gameFolder) {
          const active = await applyModSelection({
            gamePath: gameFolder,
            selectedMods: selectedWithoutOld,
            pakCategories,
          })

          setActiveMods(active)
          setSelectedMods(active)
        }

        const renamedName = await renameImportedModCommand(oldName, trimmedName)

        const nextPakCategories = pakCategories.map((category) => ({
          ...category,
          modNames: replaceModName(category.modNames, oldName, renamedName),
        }))

        const nextSelectedMods = wasSelected
          ? [...selectedWithoutOld, renamedName]
          : selectedWithoutOld

        setPakCategories(nextPakCategories)
        setUncategorizedPakMods((prev) => replaceModName(prev, oldName, renamedName))
        setSelectedMods(nextSelectedMods)

        setAppliedPakInstallLocationByMod((prev) => {
          const next = { ...prev }

          if (next[oldName]) {
            next[renamedName] = next[oldName]
            delete next[oldName]
          }

          saveAppliedPakInstallLocationByMod(
            next,
            isKnownGameVersion(gameVersion) ? gameVersion : null,
          )

          return next
        })

        if (wasActive && gameFolder) {
          const active = await applyModSelection({
            gamePath: gameFolder,
            selectedMods: nextSelectedMods,
            pakCategories: nextPakCategories,
          })

          setActiveMods(active)
          setSelectedMods(active)

          const appliedLocations = getAppliedPakInstallLocations(active, nextPakCategories)

          setAppliedPakInstallLocationByMod(appliedLocations)
          saveAppliedPakInstallLocationByMod(
            appliedLocations,
            isKnownGameVersion(gameVersion) ? gameVersion : null,
          )
        }

        await loadImportedMods()
        await loadModStatuses()

        return renamedName
      } catch (err) {
        await dialog({
          title: t("dialogs.renameFailedTitle"),
          message: String(err),
          kind: "error",
        })

        await loadImportedMods()
        await loadModStatuses()

        return null
      }
    },
    [
      activeMods,
      selectedMods,
      pakCategories,
      gameVersion,
      importedMods,
      getModRenameError,
      loadImportedMods,
      loadModStatuses,
      t,
    ],
  )

  const confirmImport = useCallback(async () => {
    if (!pendingPaths) return

    const cleanName = modName.trim()

    if (!cleanName) {
      await dialog({
        title: t("dialogs.modNameRequiredTitle"),
        message: t("dialogs.enterModNameMessage"),
        kind: "warning",
      });
      return
    }

    const existingMod = importedMods.find(
      (mod) => mod.name.toLowerCase() === cleanName.toLowerCase(),
    )

    let overwrite = false

    const wasInstalledBeforeUpdate = existingMod
      ? activeMods.includes(existingMod.name)
      : false

    const activeModsBeforeUpdate = activeMods

    if (existingMod) {
      const overwriteAsk = await dialog({
        title: t("dialogs.updateExistingModTitle"),
        message: t("dialogs.updateExistingModMessage", { name: cleanName }),
        kind: "warning",
        isCancel: true,
        okLabel: t("common.update"),
        cancelLabel: t("common.cancel"),
      });

      overwrite = overwriteAsk.ok

      if (!overwrite) return
    }

    importingRef.current = true
    setIsImporting(true)

    try {
      const result = await importModPaths({
        paths: pendingPaths,
        modName: cleanName,
        overwrite,
      })

      setLastImport(result)
      setPendingPaths(null)
      setModName("")

      await loadImportedMods()

      if (overwrite && wasInstalledBeforeUpdate) {
        const gameFolder = getGameFolder()

        if (!gameFolder) {
          await dialog({
            title: t("dialogs.gameFolderMissingTitle"),
            message: t("dialogs.updatedModNeedsGameFolder"),
            kind: "warning",
          })
        } else {
          const syncedActiveMods = await applyModSelection({
            gamePath: gameFolder,
            selectedMods: activeModsBeforeUpdate,
            pakCategories,
            hideUidEnabled: hideUidInstalled,
            hidePingEnabled: hidePingInstalled,
            anticensorEnabled: anticensorInstalled,
          })

          setActiveMods(syncedActiveMods)
          await loadModStatuses()
        }
      }

      if (result.warnings.length > 0) {
        await dialog({
          title: t("dialogs.importWarningTitle"),
          message: result.warnings.join("\n"),
          kind: "warning",
        });
      }
    } catch (err) {
      await dialog({
        title: t("dialogs.importFailedTitle"),
        message: String(err),
        kind: "error",
      });
    } finally {
      importingRef.current = false
      setIsImporting(false)
    }
  }, [
    activeMods,
    anticensorInstalled,
    hidePingInstalled,
    hideUidInstalled,
    importedMods,
    loadImportedMods,
    loadModStatuses,
    modName,
    pakCategories,
    pendingPaths,
    t,
  ])

  async function getCurrentLoaderProxyPayload(gameFolder: string) {
    const gameCheck = await invoke<GameFolderCheck>("check_game_folder", {
      path: gameFolder,
    })

    const config = readLoaderProxyConfig()

    return {
      gameCheck,
      proxyDllNames:
        gameCheck.valid && isKnownGameVersion(gameCheck.gameVersion)
          ? getEnabledLoaderProxyNames(config, gameCheck.gameVersion)
          : undefined,
      allProxyDllNames: getKnownLoaderProxyNames(config),
    }
  }

  const toggleLoaderFiles = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await dialog({
        title: t("dialogs.gameFolderMissingTitle"),
        message: t("dialogs.configureGameFolderFirst"),
        kind: "warning",
      });
      return
    }

    try {
      const { proxyDllNames, allProxyDllNames } = await getCurrentLoaderProxyPayload(gameFolder)

      const current = await invoke<LoaderFilesCheck>("check_loader_files", {
        path: gameFolder,
        proxyDllNames,
      })

      if (!current.valid && proxyDllNames?.length === 0) {
        await dialog({
          title: t("dialogs.loaderNameMissingTitle"),
          message: t("dialogs.selectLoaderNameFirst"),
          kind: "warning",
        })
        return
      }

      const result = await invoke<LoaderFilesCheck>(
        current.valid ? "uninstall_loader_files" : "install_loader_files",
        current.valid
          ? {
              path: gameFolder,
              allProxyDllNames,
            }
          : {
              path: gameFolder,
              proxyDllNames,
              allProxyDllNames,
            },
      )

      setLoaderCheck(result)

      if (current.valid) {
        removeStoredLoaderVersions(isKnownGameVersion(gameVersion) ? gameVersion : null)
      } else {
        saveStoredLoaderVersions(loaderVersions,
          isKnownGameVersion(gameVersion) ? gameVersion : null,
        )
      }

      await dialog({
        title: current.valid ? t("dialogs.loaderUninstalledTitle") : t("dialogs.loaderInstalledTitle"),
        message: current.valid ? t("dialogs.loaderFilesRemoved") : t("dialogs.loaderFilesInstalled"),
        kind: "success",
        timer: 10,
        timerTo: "yes"
      });
    } catch (err) {
      await dialog({
        title: t("dialogs.loaderActionFailedTitle"),
        message: String(err),
        kind: "error",
      });
    }
  }, [gameVersion, t])

  const cleanGameMods = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await dialog({
        title: t("dialogs.gameFolderMissingTitle"),
        message: t("dialogs.configureGameFolderFirst"),
        kind: "warning",
      })
      return
    }

    const confirmed = await dialog({
      title: t("dialogs.cleanGameFilesTitle"),
      message: t("dialogs.cleanGameFilesMessage"),
      kind: "warning",
      isCancel: true,
      okLabel: t("common.clean"),
      cancelLabel: t("common.cancel"),
    })

    if (!confirmed.ok) return

    try {
      const { allProxyDllNames } = await getCurrentLoaderProxyPayload(gameFolder)

      const result = await invoke<LoaderFilesCheck>("clean_game_mods", {
        path: gameFolder,
        allProxyDllNames,
      })

      setLoaderCheck(result)
      setActiveMods([])
      setSelectedMods([])
      setHideUidInstalled(false)
      setHideUidSelected(false)
      setHidePingInstalled(false)
      setHidePingSelected(false)
      setAnticensorInstalled(false)
      setAnticensorSelected(false)

      removeStoredLoaderVersions(isKnownGameVersion(gameVersion) ? gameVersion : null)
      saveAppliedPakInstallLocationByMod({},
        isKnownGameVersion(gameVersion) ? gameVersion : null,
      )
      setAppliedPakInstallLocationByMod({})

      await loadModStatuses()
      await refreshBundledMods()

      await dialog({
        title: t("dialogs.cleanCompleteTitle"),
        message: t("dialogs.allFilesRemoved"),
        kind: "success",
        timer: 30,
        timerTo: "yes"
      })
    } catch (err) {
      await dialog({
        title: t("dialogs.cleanFailedTitle"),
        message: String(err),
        kind: "error",
      })
    }
  }, [gameVersion, loadModStatuses, refreshBundledMods, t])
  
  const checkLoaderVersion = async (
    gameFolder: string,
    currentLoaderCheck: LoaderFilesCheck,
    currentGameVersion: GameVersion | null,
  ) => {
    if (!currentLoaderCheck.valid || !currentGameVersion) return currentLoaderCheck

    const storedVersions = loadStoredLoaderVersions(currentGameVersion)
    const currentVersions = loaderVersions

    const needsUpdate = storedVersions
      ? storedVersions.asi !== currentVersions.asi ||
        storedVersions.dll !== currentVersions.dll ||
        storedVersions.sub_dll !== currentVersions.sub_dll
      : true

    if (!needsUpdate) return currentLoaderCheck

    const updateConfirmed = await dialog({
      title: t("dialogs.loaderUpdateAvailableTitle"),
      message: t("dialogs.loaderUpdateAvailableMessage"),
      kind: "warning",
      isCancel: true,
      okLabel: t("common.update"),
      cancelLabel: t("updates.later"),
      timer: 59,
      timerTo: "yes",
    })

    if (!updateConfirmed.ok) return currentLoaderCheck

    const { proxyDllNames, allProxyDllNames } = await getCurrentLoaderProxyPayload(gameFolder)

    const result = await invoke<LoaderFilesCheck>("install_loader_files", {
      path: gameFolder,
      proxyDllNames,
      allProxyDllNames,
    })

    if (result.valid) {
      saveStoredLoaderVersions(currentVersions, currentGameVersion)

      await dialog({
        title: t("dialogs.loaderUpdateTitle"),
        message: t("dialogs.loaderFilesUpdated"),
        kind: "success",
        timer: 10,
        timerTo: "yes",
      })
    } else {
      removeStoredLoaderVersions(currentGameVersion)

      await dialog({
        title: t("dialogs.loaderUpdateTitle"),
        message: t("dialogs.loaderFilesUpdateFailed"),
        kind: "error",
      })
    }

    return result
  }

  const refreshLoaderCheck = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      setLoaderCheck(null)
      return
    }

    const folderCheck = await invoke<GameFolderCheck>("check_game_folder", {
      path: gameFolder,
    })

    const currentGameVersion =
      folderCheck.valid && isKnownGameVersion(folderCheck.gameVersion)
        ? folderCheck.gameVersion
        : null

    const { proxyDllNames } = await getCurrentLoaderProxyPayload(gameFolder)

    const result = await invoke<LoaderFilesCheck>("check_loader_files", {
      path: gameFolder,
      proxyDllNames,
    })

    const versionCheckedResult = await checkLoaderVersion(
      gameFolder,
      result,
      currentGameVersion,
    )

    setLoaderCheck(versionCheckedResult)
  }, [])

  useEffect(() => {
    function onLoaderProxyConfigChanged() {
      refreshLoaderCheck()
    }

    window.addEventListener("loaderProxyConfigChanged", onLoaderProxyConfigChanged)

    return () => {
      window.removeEventListener("loaderProxyConfigChanged", onLoaderProxyConfigChanged)
    }
  }, [refreshLoaderCheck])

  useEffect(() => {
    refreshLoaderCheck()

    const intervalId = window.setInterval(() => {
      refreshLoaderCheck()
    }, 61*1000)

    window.addEventListener("gameFolderChanged", refreshLoaderCheck)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("gameFolderChanged", refreshLoaderCheck)
    }
  }, [refreshLoaderCheck])

  const applyModChanges = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await dialog({
        title: t("dialogs.gameFolderMissingTitle"),
        message: t("dialogs.configureGameFolderFirst"),
        kind: "warning",
      });
      return
    }

    const { proxyDllNames } = await getCurrentLoaderProxyPayload(gameFolder)

    const loaderCheck = await invoke<LoaderFilesCheck>("check_loader_files", {
      path: gameFolder,
      proxyDllNames,
    })

    if (!loaderCheck.valid) {
      await dialog({
        title: t("dialogs.loaderFilesMissingTitle"),
        message: t("dialogs.installLoaderFilesFirst"),
        kind: "warning",
      });
      return
    }

    try {
      const active = await applyModSelection({
        gamePath: gameFolder,
        selectedMods,
        pakCategories,
        hideUidEnabled: hideUidSelected,
        hidePingEnabled: hidePingSelected,
        anticensorEnabled: anticensorSelected,
      })

      setActiveMods(active)
      setSelectedMods(active)

      const appliedLocations = getAppliedPakInstallLocations(active, pakCategories)
      setAppliedPakInstallLocationByMod(appliedLocations)
      saveAppliedPakInstallLocationByMod(appliedLocations,
        isKnownGameVersion(gameVersion) ? gameVersion : null,
      )

      await loadModStatuses()
      await refreshBundledMods()
      await refreshLoaderCheck()

      await dialog({
        title: t("dialogs.applyCompleteTitle"),
        message: t("dialogs.modChangesApplied"),
        kind: "success",
        timer: 10,
        timerTo: "yes"
      });
    } catch (err) {
      await dialog({
        title: t("dialogs.applyFailedTitle"),
        message: String(err),
        kind: "error",
      });
    }
  }, [
    loadModStatuses,
    pakCategories,
    selectedMods,
    hideUidSelected,
    hidePingSelected,
    anticensorSelected,
    refreshBundledMods,
    refreshLoaderCheck,
    t,
  ])

  const addPakCategory = useCallback(() => {
    const error = getCategoryNameError(pakCategories, newCategoryName)

    if (error) {
      setCategoryDialogError(error)
      return
    }

    setPakCategories((prev) => [...prev, createPakCategory(newCategoryName)])
    setNewCategoryName("")
    setCategoryDialogError("")
    setShowCategoryDialog(false)
  }, [newCategoryName, pakCategories])

  const updatePakCategoryName = useCallback(
    (categoryId: string, name: string) => {
      const error = getCategoryNameError(pakCategories, name, categoryId)

      setCategoryNameErrors((prev) => ({ ...prev, [categoryId]: error }))
      setPakCategories((prev) => renamePakCategory(prev, categoryId, name))

      if (!error) {
        setLastValidCategoryNames((prev) => ({ ...prev, [categoryId]: name }))
      }
    },
    [pakCategories],
  )

  const revertPakCategoryName = useCallback(
    (categoryId: string) => {
      setPakCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId
            ? { ...category, name: lastValidCategoryNames[categoryId] ?? t("mods.category.unnamed") }
            : category,
        ),
      )

      setCategoryNameErrors((prev) => ({ ...prev, [categoryId]: "" }))
    },
    [lastValidCategoryNames, t],
  )

  const movePakCategory = useCallback((categoryId: string, direction: CategoryMoveDirection) => {
    setPakCategories((prev) => movePakCategoryHelper(prev, categoryId, direction))
  }, [])

  const deletePakCategory = useCallback((categoryId: string) => {
    setPakCategories((prev) => deletePakCategoryHelper(prev, categoryId))
  }, [])

  const movePakModDragOver = useCallback(
    (targetCategoryId: string, targetModName: string | null) => {
      if (!draggedPakModName) return
      if (draggedPakModName === targetModName) return

      setPakCategories((prev) => {
        const withoutDragged = prev.map((category) => ({
          ...category,
          modNames: category.modNames.filter((modName) => modName !== draggedPakModName),
        }))

        if (targetCategoryId === "uncategorized") {
          return withoutDragged
        }

        return withoutDragged.map((category) => {
          if (category.id !== targetCategoryId) return category

          return {
            ...category,
            modNames: moveItemBefore(category.modNames, draggedPakModName, targetModName),
          }
        })
      })

      setUncategorizedPakMods((prev) => {
        const withoutDragged = prev.filter((modName) => modName !== draggedPakModName)

        if (targetCategoryId !== "uncategorized") {
          return withoutDragged
        }

        return moveItemBefore(prev, draggedPakModName, targetModName)
      })
    },
    [draggedPakModName],
  )

  const endPakDrag = useCallback(() => {
    const preview = document.getElementById("drag-preview")
    preview?.classList.add("hidden")

    setDraggedPakModName(null)
    internalDragRef.current = false
  }, [])

  const toggleUncategorizedCollapsed = useCallback(() => {
    setCollapsedUncategorized((prev) => {
      const next = !prev
      saveCollapsedUncategorized(next)
      return next
    })
  }, [])

  const togglePakCategoryCollapsed = useCallback((categoryId: string) => {
    setCollapsedPakCategories((prev) => {
      const next = { ...prev, [categoryId]: !prev[categoryId] }
      saveCollapsedPakCategories(next)
      return next
    })
  }, [])

  const beginInternalPakDrag = useCallback((modName: string) => {
    internalDragRef.current = true
    setDraggedPakModName(modName)
  }, [])

  const changePakModIcon = useCallback(
    async (modName: string) => {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: t("mods.filePicker.images"),
            extensions: ["ico", "png", "jpg", "jpeg", "webp", "bmp"],
          },
        ],
      })

      if (!selected || Array.isArray(selected)) return

      try {
        await setPakModIcon(modName, selected)
        await loadImportedMods()

        const gameFolder = getGameFolder()

        if (gameFolder && selectedMods.includes(modName)) {
          const active = await applyModSelection({
            gamePath: gameFolder,
            selectedMods,
            pakCategories,
          })

          setActiveMods(active)
          setSelectedMods(active)

          await loadModStatuses()
        }
      } catch (err) {
        await dialog({
          title: t("dialogs.iconChangeFailedTitle"),
          message: String(err),
          kind: "error",
        });
      }
    },
    [loadImportedMods, pakCategories, selectedMods, loadModStatuses, t],
  )

  const clearPakModIconForMod = useCallback(
    async (modName: string) => {
      await clearPakModIcon(modName)
      await loadImportedMods()

      if (selectedMods.includes(modName)) {
        const gameFolder = getGameFolder()
        if (!gameFolder) return

        const active = await applyModSelection({
          gamePath: gameFolder,
          selectedMods,
          pakCategories,
        })

        setActiveMods(active)
        setSelectedMods(active)
        await loadModStatuses()
      }
    },
    [selectedMods, pakCategories, loadImportedMods, loadModStatuses],
  )

  const closeImportDialog = useCallback(() => {
    setPendingPaths(null)
  }, [])

  const closeCategoryDialog = useCallback(() => {
    setNewCategoryName("")
    setShowCategoryDialog(false)
  }, [])

  const importDroppedPaths = useCallback(
    async (paths: string[]) => {
      readingImportRef.current = true
      setIsReadingImport(true)

      try {
        await validateModPaths(paths)

        const analysis = await analyzeImportPaths(paths)
        const suggestedName = analysis.suggestedName?.trim() || suggestModName(paths)

        if (analysis.suggestedName && !analysis.nameConflict) {
          importingRef.current = true
          setIsImporting(true)

          try {
            const result = await importModPaths({
              paths,
              modName: suggestedName,
              overwrite: false,
            })

            setLastImport(result)
            await loadImportedMods()

            if (result.warnings.length > 0) {
              await dialog({
                title: t("dialogs.importWarningTitle"),
                message: result.warnings.join("\n"),
                kind: "warning",
              })
            }
          } finally {
            importingRef.current = false
            setIsImporting(false)
          }

          return
        }

        setPendingPaths(paths)
        setModName(suggestedName)
      } finally {
        readingImportRef.current = false
        setIsReadingImport(false)
      }
    },
    [loadImportedMods, pakCategories, selectedMods, loadModStatuses, t],
  )

  const openImportFilePicker = useCallback(async () => {
    if (importingRef.current || validatingDropRef.current || readingImportRef.current) return

    const selected = await open({
      multiple: true,
      filters: [
        {
          name: t("mods.filePicker.supportedModFiles"),
          extensions: ["zip", "rar", "7z", "asi", "ini", "pak", "ucas", "utoc"],
        },
      ],
    })

    if (!selected) return

    const paths = Array.isArray(selected) ? selected : [selected]

    if (paths.length === 0) return

    validatingDropRef.current = true

    try {
      await importDroppedPaths(paths)
    } catch (err) {
      await dialog({
        title: t("dialogs.invalidModFilesTitle"),
        message: String(err),
        kind: "warning",
      })
    } finally {
      validatingDropRef.current = false
    }
  }, [importDroppedPaths, t])

  const openImportFolderPicker = useCallback(async () => {
    if (importingRef.current || validatingDropRef.current || readingImportRef.current) return

    const selected = await open({
      directory: true,
      multiple: false,
    })

    if (!selected) return

    const paths = Array.isArray(selected) ? selected : [selected]

    if (paths.length === 0) return

    validatingDropRef.current = true

    try {
      await importDroppedPaths(paths)
    } catch (err) {
      await dialog({
        title: t("dialogs.invalidModFolderTitle"),
        message: String(err),
        kind: "warning",
      })
    } finally {
      validatingDropRef.current = false
    }
  }, [importDroppedPaths, t])

  useEffect(() => {
    invoke<boolean>("is_app_elevated")
      .then(setIsRunningAsAdmin)
      .catch(() => setIsRunningAsAdmin(false))
  }, [])

  useEffect(() => {
    bundledInstalledRef.current = {
      hideUidInstalled,
      hidePingInstalled,
      anticensorInstalled,
    }
  }, [hideUidInstalled, hidePingInstalled, anticensorInstalled])

  useEffect(() => {
    const savedCategories = loadPakCategories()

    setPakCategories(savedCategories)
    setCollapsedUncategorized(loadCollapsedUncategorized())
    setCollapsedPakCategories(loadCollapsedPakCategories())
    setAppliedPakInstallLocationByMod(loadAppliedPakInstallLocationByMod(gameVersion))
    setLastValidCategoryNames(Object.fromEntries(savedCategories.map((category) => [category.id, category.name])))
    setUncategorizedPakMods(loadUncategorizedPakMods())
  }, [])

  useEffect(() => {
    savePakCategories(pakCategories)
  }, [pakCategories])

  useEffect(() => {
    saveUncategorizedPakMods(uncategorizedPakMods)
  }, [uncategorizedPakMods])

  useEffect(() => {
    let unlisten: (() => void) | undefined

    refreshDetectedState()

    getCurrentWindow()
      .onDragDropEvent(async (event) => {
        const payload = event.payload

        if (internalDragRef.current) {
          setIsDragging(false)
          return
        }

        if (payload.type === "over") setIsDragging(true)
        if (payload.type === "leave") setIsDragging(false)

        if (payload.type === "drop") {
          const now = Date.now()

          if (now - lastDropRef.current < 800) return
          lastDropRef.current = now

          setIsDragging(false)

          if (importingRef.current || validatingDropRef.current || readingImportRef.current) return

          validatingDropRef.current = true

          try {
            await importDroppedPaths(payload.paths)
          } catch (err) {
            await dialog({
              title: t("dialogs.invalidModFilesTitle"),
              message: String(err),
              kind: "warning",
            });
          } finally {
            validatingDropRef.current = false
          }
        }
      })
      .then((fn) => {
        unlisten = fn
      })

    return () => {
      unlisten?.()
    }
  }, [importDroppedPaths, refreshDetectedState, t])

  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden) refreshDetectedState()
    }

    window.addEventListener("focus", refreshDetectedState)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.removeEventListener("focus", refreshDetectedState)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [refreshDetectedState])

  useEffect(() => {
    if (!lastImport) return

    setShowLastImport(true)

    const fadeTimer = window.setTimeout(() => setShowLastImport(false), 4000)
    const removeTimer = window.setTimeout(() => setLastImport(null), 4500)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(removeTimer)
    }
  }, [lastImport])

  useEffect(() => {
    if (!draggedPakModName) return

    function stopDragAutoScroll() {
      dragScrollSpeedRef.current = 0

      if (dragScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(dragScrollFrameRef.current)
        dragScrollFrameRef.current = null
      }
    }

    function runDragAutoScroll(scrollElement: HTMLElement) {
      if (dragScrollFrameRef.current !== null) return

      const scroll = () => {
        if (!dragScrollSpeedRef.current) {
          dragScrollFrameRef.current = null
          return
        }

        scrollElement.scrollBy({
          top: dragScrollSpeedRef.current,
          behavior: "auto",
        })

        dragScrollFrameRef.current = window.requestAnimationFrame(scroll)
      }

      dragScrollFrameRef.current = window.requestAnimationFrame(scroll)
    }

    function updateDragAutoScroll(clientY: number) {
      const scrollElement = document.querySelector("[data-pak-mods-scroll]") as HTMLElement | null

      if (!scrollElement) {
        stopDragAutoScroll()
        return
      }

      const rect = scrollElement.getBoundingClientRect()
      const edgeSize = 90
      const minSpeed = 1
      const maxSpeed = 4

      if (clientY < rect.top + edgeSize) {
        const distanceToEdge = Math.max(0, clientY - rect.top)
        const strength = 1 - distanceToEdge / edgeSize

        dragScrollSpeedRef.current = -Math.round(
          minSpeed + (maxSpeed - minSpeed) * strength,
        )

        runDragAutoScroll(scrollElement)
        return
      }

      if (clientY > rect.bottom - edgeSize) {
        const distanceToEdge = Math.max(0, rect.bottom - clientY)
        const strength = 1 - distanceToEdge / edgeSize

        dragScrollSpeedRef.current = Math.round(
          minSpeed + (maxSpeed - minSpeed) * strength,
        )

        runDragAutoScroll(scrollElement)
        return
      }

      stopDragAutoScroll()
    }

    function onPointerMove(e: PointerEvent) {
      const preview = document.getElementById("drag-preview")

      if (preview) {
        preview.style.left = `${e.clientX}px`
        preview.style.top = `${e.clientY}px`
        preview.classList.remove("hidden")
      }

      updateDragAutoScroll(e.clientY)
    }

    function onPointerUp() {
      stopDragAutoScroll()
      endPakDrag()
    }

    document.addEventListener("pointermove", onPointerMove, true)
    document.addEventListener("pointerup", onPointerUp, true)

    return () => {
      document.removeEventListener("pointermove", onPointerMove, true)
      document.removeEventListener("pointerup", onPointerUp, true)
      stopDragAutoScroll()
    }
  }, [draggedPakModName, endPakDrag])

  return {
    state: {
      loaderCheck,
      gameVersion,
      isDragging,
      isImporting,
      isReadingImport,
      lastImport,
      pendingPaths,
      modName,
      showLastImport,
      modsView,
      selectedMods,
      pakCategories,
      pakModsWithoutCategory,
      visibleMods,
      draggedPakModName,
      showCategoryDialog,
      newCategoryName,
      categoryDialogError,
      categoryNameErrors,
      collapsedUncategorized,
      collapsedPakCategories,
      hideUidInstalled,
      hideUidSelected,
      hidePingInstalled,
      hidePingSelected,
      anticensorInstalled,
      anticensorSelected,
      isRunningAsAdmin,
    },
    actions: {
      setModsView,
      setShowCategoryDialog,
      setNewCategoryName,
      setCategoryDialogError,
      setModName,
      launchGame,
      toggleLoaderFiles,
      cleanGameMods,
      refreshLoaderCheck,
      applyModChanges,
      hasPendingChanges,
      refreshDetectedState,
      toggleModSelection,
      getModStatus,
      removeImportedMod,
      renameImportedMod,
      getModRenameError,
      confirmImport,
      addPakCategory,
      updatePakCategoryName,
      revertPakCategoryName,
      movePakCategory,
      deletePakCategory,
      toggleUncategorizedCollapsed,
      togglePakCategoryCollapsed,
      beginInternalPakDrag,
      movePakModDragOver,
      endPakDrag,
      changePakModIcon,
      clearPakModIconForMod,
      closeImportDialog,
      closeCategoryDialog,
      setHideUidSelected,
      setHidePingSelected,
      setAnticensorSelected,
      getBundledModStatus,
      refreshBundledMods,
      openImportFilePicker,
      openImportFolderPicker,
    },
  }
}
