import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ask, message, open } from "@tauri-apps/plugin-dialog"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import type {
  CategoryMoveDirection,
  ImportedMod,
  ImportResult,
  ModCategory,
  ModInstallStatus,
  ModsView,
  LoaderFilesCheck,
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

  const importingRef = useRef(false)
  const validatingDropRef = useRef(false)
  const lastDropRef = useRef(0)
  const internalDragRef = useRef(false)

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
    setSelectedMods(active)
  }, [])

  const refreshDetectedState = useCallback(() => {
    void loadImportedMods()
    void loadModStatuses()
  }, [loadImportedMods, loadModStatuses])

  const launchGame = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await message("Please configure the game folder in Settings first", {
        title: "Game Folder Missing",
        kind: "warning",
      })
      return
    }

    try {
      await launchGameCommand(gameFolder)

      if (shouldCloseOnLaunch()) {
        await getCurrentWindow().close()
      }
    } catch (err) {
      await message(String(err), {
        title: "Launch Failed",
        kind: "error",
      })
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

  const hasPendingChanges = useCallback(
    () =>
      hasPendingModChanges({
        activeMods,
        selectedMods,
        categoryNameErrors,
        pakCategories,
        appliedPakInstallLocationByMod,
      }),
    [activeMods, appliedPakInstallLocationByMod, categoryNameErrors, pakCategories, selectedMods],
  )

  const removeImportedMod = useCallback(
    async (name: string) => {
      const isActive = activeMods.includes(name)

      const confirmed = await ask(
        isActive
          ? `Delete "${name}" from NTEMM?\n\nThis mod is currently active, so its copied files will also be removed from the game folder`
          : `Delete "${name}" from NTEMM?\n\nThis removes the stored source files only`,
        {
          title: "Delete Imported Mod?",
          kind: "warning",
          okLabel: "Delete",
          cancelLabel: "Cancel",
        },
      )

      if (!confirmed) return

      try {
        if (isActive) {
          const gameFolder = getGameFolder()

          if (!gameFolder) {
            await message(
              "This mod is active, but the game folder is not configured. Please configure it first so the copied files can be removed",
              {
                title: "Game Folder Missing",
                kind: "warning",
              },
            )
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
        await message(String(err), {
          title: "Delete Failed",
          kind: "error",
        })
      }
    },
    [activeMods, loadImportedMods, loadModStatuses, pakCategories, selectedMods],
  )

  const confirmImport = useCallback(async () => {
    if (!pendingPaths) return

    const cleanName = modName.trim()

    if (!cleanName) {
      await message("Please enter a mod name", {
        title: "Mod Name Required",
        kind: "warning",
      })
      return
    }

    const existingMod = importedMods.find(
      (mod) => mod.name.toLowerCase() === cleanName.toLowerCase(),
    )

    let overwrite = false

    if (existingMod) {
      overwrite = await ask(
        `A mod named "${cleanName}" already exists\n\nDo you want to update it?\n\nThe old files will be deleted and replaced with the new import`,
        {
          title: "Update Existing Mod?",
          kind: "warning",
          okLabel: "Update",
          cancelLabel: "Cancel",
        },
      )

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
        await message(result.warnings.join("\n"), {
          title: "Import Warning",
          kind: "warning",
        })
      }
    } catch (err) {
      await message(String(err), {
        title: "Import Failed",
        kind: "error",
      })
    } finally {
      importingRef.current = false
      setIsImporting(false)
    }
  }, [importedMods, loadImportedMods, modName, pendingPaths])

  const toggleLoaderFiles = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await message("Please configure the game folder in Settings first", {
        title: "Game Folder Missing",
        kind: "warning",
      })
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

      await message(
        current.valid
          ? "Loader files removed successfully"
          : "Loader files installed successfully",
        {
          title: current.valid ? "Loader Uninstalled" : "Loader Installed",
          kind: "info",
        },
      )
    } catch (err) {
      await message(String(err), {
        title: "Loader Action Failed",
        kind: "error",
      })
    }
  }, [])

  const refreshLoaderCheck = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      setLoaderCheck(null)
      return
    }

    const result = await invoke<LoaderFilesCheck>("check_loader_files", {
      path: gameFolder,
    })

    setLoaderCheck(result)
  }, [])

  const applyModChanges = useCallback(async () => {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      await message("Please configure the game folder in Settings first", {
        title: "Game Folder Missing",
        kind: "warning",
      })
      return
    }

    const loaderCheck = await invoke<LoaderFilesCheck>("check_loader_files", {
      path: gameFolder,
    })

    if (!loaderCheck.valid) {
      await message(
        `Required loader files are missing, Install them first`,
        {
          title: "Loader Files Missing",
          kind: "warning",
        },
      )
      return
    }

    try {
      const active = await applyModSelection({
        gamePath: gameFolder,
        selectedMods,
        pakCategories,
      })

      setActiveMods(active)
      setSelectedMods(active)

      const appliedLocations = getAppliedPakInstallLocations(active, pakCategories)
      setAppliedPakInstallLocationByMod(appliedLocations)
      saveAppliedPakInstallLocationByMod(appliedLocations)

      await loadModStatuses()

      await message("Mod changes applied successfully", {
        title: "Apply Complete",
        kind: "info",
      })
    } catch (err) {
      await message(String(err), {
        title: "Apply Failed",
        kind: "error",
      })
    }
  }, [loadModStatuses, pakCategories, selectedMods])

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
        await message(String(err), {
          title: "Icon Change Failed",
          kind: "error",
        })
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
            await message(result.warnings.join("\n"), {
              title: "Import Warning",
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
    },
    [loadImportedMods],
  )

  useEffect(() => {
    refreshLoaderCheck()

    const intervalId = window.setInterval(() => {
      refreshLoaderCheck()
    }, 3000)

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
            await message(String(err), {
              title: "Invalid Mod Files",
              kind: "warning",
            })
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
    },
    actions: {
      setModsView,
      setShowCategoryDialog,
      setNewCategoryName,
      setCategoryDialogError,
      setModName,
      launchGame,
      toggleLoaderFiles,
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
    },
  }
}
