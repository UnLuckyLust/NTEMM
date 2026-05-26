import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { loaderVersions } from "@lib/config"
import { dialog } from "@/lib/dialog";
import type {
  CategoryMoveDirection,
  ImportedMod,
  ImportResult,
  ModCategory,
  ModInstallStatus,
  ModsView,
  LoaderFilesCheck,
  GameFolderCheck,
} from "@/types/modManager"
import {
  createPakCategory,
  deletePakCategory as deletePakCategoryHelper,
  getCategoryNameError,
  movePakCategory as movePakCategoryHelper,
  movePakModToCategory as movePakModToCategoryHelper,
  renamePakCategory,
  updateUncategorizedPakMods,
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
  loadUncategorizedPakMods,
  saveAppliedPakInstallLocationByMod,
  saveCollapsedUncategorized,
  saveCollapsedPakCategories,
  savePakCategories,
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
  validateModPaths,
} from "@/helpers/tauriModCommands"
import { setPakModIcon, clearPakModIcon } from "@/helpers/folderIcons"

export function useModManager() {
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
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
  const [gameVersion, setGameVersion] = useState<string | null>(null)

  const importingRef = useRef(false)
  const validatingDropRef = useRef(false)
  const lastDropRef = useRef(0)
  const internalDragRef = useRef(false)
  const modStatusesInitializedRef = useRef(false)
  const bundledInstalledRef = useRef({
    hideUidInstalled: false,
    hidePingInstalled: false,
    anticensorInstalled: false,
  })

  const visibleMods = useMemo(
    () => (modsView === "pak" ? importedMods.filter(isPakMod) : importedMods.filter(isAsiMod)),
    [importedMods, modsView],
  )

  const pakModsWithoutCategory = useMemo(
    () => getPakModsWithoutCategory(importedMods, pakCategories),
    [importedMods, pakCategories],
  )

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
      return
    }

    try {
      const result = await invoke<GameFolderCheck>("check_game_folder", {
        path: gameFolder,
      })

      setGameVersion(result.valid ? result.gameVersion : null)
    } catch {
      setGameVersion(null)
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
        title: "Game Folder Missing",
        message: "Please configure the game folder in Settings first",
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
        title: "Launch Failed",
        message: String(err),
        kind: "error",
      });
    }
  }, [])

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
        title: "Delete Imported Mod?",
        message: isActive
          ? `Delete "${name}" from NTEMM?\nThis mod is currently active, so its copied files will also be removed from the game folder`
          : `Delete "${name}" from NTEMM?\nThis removes the stored source files only`,
        kind: "warning",
        isCancel: true,
        okLabel: "Delete",
        cancelLabel: "Cancel",
      });

      if (!confirmed.ok) return

      try {
        if (isActive) {
          const gameFolder = getGameFolder()

          if (!gameFolder) {
            await dialog({
              title: "Game Folder Missing",
              message: "This mod is active, but the game folder is not configured. Please configure it first so the copied files can be removed",
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
          title: "Delete Failed",
          message: String(err),
          kind: "error",
        });
      }
    },
    [activeMods, loadImportedMods, loadModStatuses, pakCategories, selectedMods],
  )

  const confirmImport = useCallback(async () => {
    if (!pendingPaths) return

    const cleanName = modName.trim()

    if (!cleanName) {
      await dialog({
        title: "Mod Name Required",
        message: "Please enter a mod name",
        kind: "warning",
      });
      return
    }

    const existingMod = importedMods.find(
      (mod) => mod.name.toLowerCase() === cleanName.toLowerCase(),
    )

    let overwrite = false

    if (existingMod) {
      const overwriteAsk = await dialog({
        title: "Update Existing Mod?",
        message: `A mod named "${cleanName}" already exists\nDo you want to update it?\nThe old files will be deleted and replaced with the new import`,
        kind: "warning",
        isCancel: true,
        okLabel: "Update",
        cancelLabel: "Cancel",
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

      if (result.warnings.length > 0) {
        await dialog({
          title: "Import Warning",
          message: result.warnings.join("\n"),
          kind: "warning",
        });
      }
    } catch (err) {
      await dialog({
        title: "Import Failed",
        message: String(err),
        kind: "error",
      });
    } finally {
      importingRef.current = false
      setIsImporting(false)
    }
  }, [importedMods, loadImportedMods, modName, pendingPaths])

  const toggleLoaderFiles = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await dialog({
        title: "Game Folder Missing",
        message: "Please configure the game folder in Settings first",
        kind: "warning",
      });
      return
    }

    try {
      const current = await invoke<LoaderFilesCheck>("check_loader_files", {
        path: gameFolder,
      })

      const result = await invoke<LoaderFilesCheck>(
        current.valid ? "uninstall_loader_files" : "install_loader_files",
        { path: gameFolder },
      )

      setLoaderCheck(result)

      if (current.valid) {
        localStorage.removeItem('loaderVersions');
      } else {
        const currentVersions = loaderVersions;
        localStorage.setItem("loaderVersions", JSON.stringify(currentVersions));
      }
      
      await dialog({
        title: current.valid ? "Loader Uninstalled" : "Loader Installed",
        message: current.valid ? "Loader files removed successfully" : "Loader files installed successfully",
        kind: "success",
      });
    } catch (err) {
      await dialog({
        title: "Loader Action Failed",
        message: String(err),
        kind: "error",
      });
    }
  }, [])

  const cleanGameMods = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await dialog({
        title: "Game Folder Missing",
        message: "Please configure the game folder in Settings first",
        kind: "warning",
      })
      return
    }

    const confirmed = await dialog({
      title: "Clean Game Files?",
      message:"This will fully clean the game folder by removing ~mods folder, all loader files, and copied ASI mod files.\nYour imported mods will stay saved in NTEMM",
      kind: "warning",
      isCancel: true,
      okLabel: "Clean",
      cancelLabel: "Cancel",
    })

    if (!confirmed.ok) return

    try {
      const result = await invoke<LoaderFilesCheck>("clean_game_mods", {
        path: gameFolder,
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

      localStorage.removeItem("loaderVersions")
      saveAppliedPakInstallLocationByMod({})
      setAppliedPakInstallLocationByMod({})

      await loadModStatuses()
      await refreshBundledMods()

      await dialog({
        title: "Clean Complete",
        message: "All files were removed from the game folder",
        kind: "success",
      })
    } catch (err) {
      await dialog({
        title: "Clean Failed",
        message: String(err),
        kind: "error",
      })
    }
  }, [loadModStatuses, refreshBundledMods])
  
  const checkLoaderVersion = async (gameFolder: string, currentLoaderCheck: LoaderFilesCheck) => {
    if (!currentLoaderCheck.valid) return currentLoaderCheck;

    const storedVersions = localStorage.getItem("loaderVersions");
    const currentVersions = loaderVersions;
    
    const needsUpdate = storedVersions ? (() => {
      const stored = JSON.parse(storedVersions);
      
      return (
        stored.asi !== currentVersions.asi ||
        stored.dll !== currentVersions.dll ||
        stored.sub_dll !== currentVersions.sub_dll
      );
    })() : true;

    if (needsUpdate) {

      const updateConfirmed = await dialog({
        title: "Loader Update Available",
        message: "New version of loader files available\nWould you like to update them?",
        kind: "warning",
        isCancel: true,
        okLabel: "Update",
        cancelLabel: "Later",
        timer: 59,
        timerTo: "yes",
      });
      
      if (updateConfirmed.ok) {
        const result = await invoke<LoaderFilesCheck>("install_loader_files", {
          path: gameFolder,
        });
        
        if (result.valid) {
          localStorage.setItem("loaderVersions", JSON.stringify(currentVersions));
          await dialog({
            title: "Loader Update",
            message: "Loader files updated successfully",
            kind: "success",
          });
        } else {
          localStorage.removeItem('loaderVersions');
          await dialog({
            title: "Loader Update",
            message: "Loader files faild to update",
            kind: "error",
          });
        }
        return result;
      }
    }
    
    return currentLoaderCheck;
  };

  const refreshLoaderCheck = useCallback(async () => {
    const gameFolder = getGameFolder();

    if (!gameFolder) {
      setLoaderCheck(null);
      return;
    }

    const result = await invoke<LoaderFilesCheck>("check_loader_files", {
      path: gameFolder,
    });

    const versionCheckedResult = await checkLoaderVersion(gameFolder, result);
    setLoaderCheck(versionCheckedResult);
  }, []);

  const applyModChanges = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await dialog({
        title: "Game Folder Missing",
        message: "Please configure the game folder in Settings first",
        kind: "warning",
      });
      return
    }

    const loaderCheck = await invoke<LoaderFilesCheck>("check_loader_files", {
      path: gameFolder,
    })

    if (!loaderCheck.valid) {
      await dialog({
        title: "Loader Files Missing",
        message: "Required loader files are missing, Install them first",
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
      saveAppliedPakInstallLocationByMod(appliedLocations)

      await loadModStatuses()
      await refreshBundledMods()
      await refreshLoaderCheck()

      await dialog({
        title: "Apply Complete",
        message: "Mod changes applied successfully",
        kind: "success",
      });
    } catch (err) {
      await dialog({
        title: "Apply Failed",
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
            ? { ...category, name: lastValidCategoryNames[categoryId] ?? "Unnamed Category" }
            : category,
        ),
      )

      setCategoryNameErrors((prev) => ({ ...prev, [categoryId]: "" }))
    },
    [lastValidCategoryNames],
  )

  const movePakCategory = useCallback((categoryId: string, direction: CategoryMoveDirection) => {
    setPakCategories((prev) => movePakCategoryHelper(prev, categoryId, direction))
  }, [])

  const deletePakCategory = useCallback((categoryId: string) => {
    setPakCategories((prev) => deletePakCategoryHelper(prev, categoryId))
  }, [])

  const movePakModToCategory = useCallback((modName: string, categoryId: string | null) => {
    setPakCategories((prev) => movePakModToCategoryHelper(prev, modName, categoryId))
    setUncategorizedPakMods((prev) => updateUncategorizedPakMods(prev, modName, categoryId))
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
            name: "Images",
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
          title: "Icon Change Failed",
          message: String(err),
          kind: "error",
        });
      }
    },
    [loadImportedMods],
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
              title: "Import Warning",
              message: result.warnings.join("\n"),
              kind: "warning",
            });
          }
        } finally {
          importingRef.current = false
          setIsImporting(false)
        }

        return
      }

      setPendingPaths(paths)
      setModName(suggestedName)
    },
    [loadImportedMods],
  )

  const openImportFilePicker = useCallback(async () => {
    if (importingRef.current || validatingDropRef.current) return

    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Supported Mod Files",
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
        title: "Invalid Mod Files",
        message: String(err),
        kind: "warning",
      })
    } finally {
      validatingDropRef.current = false
    }
  }, [importDroppedPaths])

  const openImportFolderPicker = useCallback(async () => {
    if (importingRef.current || validatingDropRef.current) return

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
        title: "Invalid Mod Folder",
        message: String(err),
        kind: "warning",
      })
    } finally {
      validatingDropRef.current = false
    }
  }, [importDroppedPaths])

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

  useEffect(() => {
    const savedCategories = loadPakCategories()

    setPakCategories(savedCategories)
    setCollapsedUncategorized(loadCollapsedUncategorized())
    setCollapsedPakCategories(loadCollapsedPakCategories())
    setAppliedPakInstallLocationByMod(loadAppliedPakInstallLocationByMod())
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

          if (importingRef.current || validatingDropRef.current) return

          validatingDropRef.current = true

          try {
            await importDroppedPaths(payload.paths)
          } catch (err) {
            await dialog({
              title: "Invalid Mod Files",
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
  }, [importDroppedPaths, refreshDetectedState])

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

    function onPointerMove(e: PointerEvent) {
      const preview = document.getElementById("drag-preview")

      if (preview) {
        preview.style.left = `${e.clientX}px`
        preview.style.top = `${e.clientY}px`
        preview.classList.remove("hidden")
      }
    }

    function onPointerUp(e: PointerEvent) {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const dropZone = target?.closest("[data-pak-category-id]") as HTMLElement | null

      if (dropZone && draggedPakModName) {
        const categoryId = dropZone.dataset.pakCategoryId

        movePakModToCategory(
          draggedPakModName,
          categoryId === "uncategorized" ? null : categoryId ?? null,
        )
      }

      const preview = document.getElementById("drag-preview")
      preview?.classList.add("hidden")

      setDraggedPakModName(null)
      internalDragRef.current = false
    }

    document.addEventListener("pointermove", onPointerMove, true)
    document.addEventListener("pointerup", onPointerUp, true)

    return () => {
      document.removeEventListener("pointermove", onPointerMove, true)
      document.removeEventListener("pointerup", onPointerUp, true)
    }
  }, [draggedPakModName, movePakModToCategory])

  return {
    state: {
      loaderCheck,
      gameVersion,
      isDragging,
      isImporting,
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
      confirmImport,
      addPakCategory,
      updatePakCategoryName,
      revertPakCategoryName,
      movePakCategory,
      deletePakCategory,
      toggleUncategorizedCollapsed,
      togglePakCategoryCollapsed,
      beginInternalPakDrag,
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
