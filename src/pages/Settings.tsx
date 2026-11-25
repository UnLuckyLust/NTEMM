import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { useEffect, useState } from "react"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { loaderVersions } from "@lib/config"
import { dialog } from "@/lib/dialog"
import { useI18n } from "@/i18n"
import { AppBackgroundCard } from "@/components/settings/AppBackgroundCard"
import { AppUpdatesCard } from "@/components/settings/AppUpdatesCard"
import { CloseOnLaunchCard } from "@/components/settings/CloseOnLaunchCard"
import { GameFolderCard } from "@/components/settings/GameFolderCard"
import { LanguageCard } from "@/components/settings/LanguageCard"
import { LoaderDllFilesCard } from "@/components/settings/LoaderDllFilesCard"
import { 
  GameFolderCheck, 
  LoaderFilesCheck, 
  GameVersion, 
  SavedGameInstalls,
  LoaderProxyConfig,
} from "@/types/modManager"
import {
  MAX_CUSTOM_LOADER_PROXY_NAMES,
  getEnabledLoaderProxyNames,
  getKnownLoaderProxyNames,
  getLoaderProxyConfigError,
  readLoaderProxyConfig,
  writeLoaderProxyConfig,
} from "@/helpers/loaderProxySettings"
import {
  removeStoredLoaderVersions,
  saveStoredLoaderVersions,
} from "@/helpers/modStorage"

const SAVED_GAME_INSTALLS_KEY = "savedGameInstalls"
const GAME_VERSIONS = ["steam", "epic", "global", "cn", "tw"] as const
const gameVersionLabels: Record<GameVersion, string> = {
  steam: "ST",
  epic: "EP",
  global: "GL",
  cn: "CN",
  tw: "TW",
}

type BackgroundMode = "none" | "static" | "animated"

function isKnownGameVersion(
  version: GameFolderCheck["gameVersion"],
): version is GameVersion {
  return GAME_VERSIONS.includes(version as GameVersion)
}

function sanitizeSavedGameInstalls(value: unknown): SavedGameInstalls {
  if (!value || typeof value !== "object") {
    return {}
  }

  const raw = value as Record<string, unknown>
  const installs: SavedGameInstalls = {}

  for (const version of GAME_VERSIONS) {
    const path = raw[version]

    if (typeof path === "string" && path.trim()) {
      installs[version] = path.trim()
    }
  }

  return installs
}

function readSavedGameInstalls(): SavedGameInstalls {
  try {
    const installs = sanitizeSavedGameInstalls(
      JSON.parse(localStorage.getItem(SAVED_GAME_INSTALLS_KEY) ?? "{}"),
    )

    writeSavedGameInstalls(installs)
    return installs
  } catch {
    localStorage.removeItem(SAVED_GAME_INSTALLS_KEY)
    return {}
  }
}

function writeSavedGameInstalls(installs: SavedGameInstalls) {
  localStorage.setItem(
    SAVED_GAME_INSTALLS_KEY,
    JSON.stringify(sanitizeSavedGameInstalls(installs)),
  )
}

function rememberGameInstall(result: GameFolderCheck): SavedGameInstalls {
  if (!result.valid || !isKnownGameVersion(result.gameVersion)) {
    return readSavedGameInstalls()
  }

  const installs = sanitizeSavedGameInstalls({
    ...readSavedGameInstalls(),
    [result.gameVersion]: result.path,
  })

  writeSavedGameInstalls(installs)
  return installs
}

function removeSavedGameInstall(version: GameVersion): SavedGameInstalls {
  const installs = readSavedGameInstalls()
  delete installs[version]
  writeSavedGameInstalls(installs)
  return installs
}

export default function Settings() {
  const [gamePath, setGamePath] = useState("")
  const [gameCheck, setGameCheck] = useState<GameFolderCheck | null>(null)
  const [loaderCheck, setLoaderCheck] = useState<LoaderFilesCheck | null>(null)
  const [closeOnLaunch, setCloseOnLaunch] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState("animated")
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [savedGameInstalls, setSavedGameInstalls] = useState<SavedGameInstalls>({})
  const [selectedSavedVersion, setSelectedSavedVersion] = useState<GameVersion | "">("")
  const [savedSelectOpen, setSavedSelectOpen] = useState(false)
  const [loaderProxyConfig, setLoaderProxyConfig] = useState<LoaderProxyConfig>(() =>
    readLoaderProxyConfig(),
  )
  const [savedLoaderProxyConfig, setSavedLoaderProxyConfig] = useState<LoaderProxyConfig>(() =>
    readLoaderProxyConfig(),
  )
  const [loaderProxyError, setLoaderProxyError] = useState("")
  const [isApplyingLoaderProxy, setIsApplyingLoaderProxy] = useState(false)
  const { t } = useI18n()

  const [autoCheckUpdates, setAutoCheckUpdates] = useState(
    localStorage.getItem("autoCheckUpdates") !== "false",
  )

  const [isDetectingGameFolders, setIsDetectingGameFolders] = useState(false)

  function applyValidGameFolder(result: GameFolderCheck) {
    setGamePath(result.path)
    setGameCheck(result)
    setLoaderCheck(null)

    localStorage.setItem("gameFolder", result.path)

    const installs = rememberGameInstall(result)
    setSavedGameInstalls(installs)

    if (isKnownGameVersion(result.gameVersion)) {
      setSelectedSavedVersion(result.gameVersion)
    } else {
      setSelectedSavedVersion("")
    }

    window.dispatchEvent(new Event("gameFolderChanged"))
    checkLoaderFiles(result.path, result.gameVersion)
  }

  async function resetToDefaultGameFolder() {
    localStorage.removeItem("gameFolder")
    setLoaderCheck(null)

    const result = await invoke<GameFolderCheck>("auto_detect_game_folder", {
      version: null,
    })

    setGamePath(result.path)
    setGameCheck(result)

    if (result.valid) {
      applyValidGameFolder(result)
      return
    }

    setSelectedSavedVersion("")
    window.dispatchEvent(new Event("gameFolderChanged"))
  }

  async function switchToFirstValidSavedInstall(installs: SavedGameInstalls) {
    for (const version of GAME_VERSIONS) {
      const path = installs[version]

      if (!path) {
        continue
      }

      const result = await invoke<GameFolderCheck>("check_game_folder", {
        path,
      })

      if (result.valid && result.gameVersion === version) {
        applyValidGameFolder(result)
        return true
      }

      const updatedInstalls = removeSavedGameInstall(version)
      setSavedGameInstalls(updatedInstalls)
    }

    await resetToDefaultGameFolder()
    return false
  }

  useEffect(() => {
    async function initGameFolder() {
      const installs = readSavedGameInstalls()
      setSavedGameInstalls(installs)
      setLoaderProxyConfig(readLoaderProxyConfig())

      setCloseOnLaunch(localStorage.getItem("closeOnLaunch") === "true")
      setBackgroundMode(localStorage.getItem("backgroundMode") ?? "animated")

      const savedPath = localStorage.getItem("gameFolder")

      if (savedPath) {
        const result = await invoke<GameFolderCheck>("check_game_folder", {
          path: savedPath,
        })

        if (result.valid) {
          applyValidGameFolder(result)
          return
        }

        const cleanedInstalls = { ...installs }

        for (const version of GAME_VERSIONS) {
          if (cleanedInstalls[version] === savedPath) {
            delete cleanedInstalls[version]
          }
        }

        writeSavedGameInstalls(cleanedInstalls)
        setSavedGameInstalls(cleanedInstalls)

        await dialog({
          titleKey: "dialogs.savedGameFolderRemovedTitle",
          messageKey: "dialogs.savedGameFolderRemovedMessage",
          kind: "warning",
        })

        await switchToFirstValidSavedInstall(cleanedInstalls)
        return
      }

      await switchToFirstValidSavedInstall(installs)
    }

    initGameFolder()
  }, [])

  async function detectAllGameFolders() {
    try {
      setIsDetectingGameFolders(true)

      const detectedInstalls = {
        ...readSavedGameInstalls(),
      }

      let firstDetected: GameFolderCheck | null = null

      for (const version of GAME_VERSIONS) {
        try {
          const result = await invoke<GameFolderCheck>("auto_detect_game_folder", {
            version,
          })

          if (!result.valid || result.gameVersion !== version) {
            continue
          }

          detectedInstalls[version] = result.path

          if (!firstDetected) {
            firstDetected = result
          }
        } catch (error) {
          console.warn(`Failed to detect ${version} game folder:`, error)
        }
      }

      writeSavedGameInstalls(detectedInstalls)
      setSavedGameInstalls(detectedInstalls)

      if (gameCheck?.valid) {
        return
      }

      if (firstDetected) {
        applyValidGameFolder(firstDetected)
      }
    } finally {
      setIsDetectingGameFolders(false)
    }
  }

  async function browseFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("settings.selectNteFolder"),
    })

    if (typeof selected !== "string") return

    setGamePath(selected)

    const result = await invoke<GameFolderCheck>("check_game_folder", {
      path: selected,
    })

    setGameCheck(result)
    setLoaderCheck(null)

    if (result.valid) {
      applyValidGameFolder(result)
    }
  }

  async function checkTypedPath() {
    if (!gamePath.trim()) return

    const result = await invoke<GameFolderCheck>("check_game_folder", {
      path: gamePath.trim(),
    })

    setGameCheck(result)
    setLoaderCheck(null)

    if (result.valid) {
      applyValidGameFolder(result)
    }
  }

  async function resetSavedGameFolder() {
    await resetToDefaultGameFolder()
  }

  async function selectSavedInstall(version: GameVersion) {
    const path = savedGameInstalls[version]

    if (!path) {
      setSelectedSavedVersion(version)
      return
    }

    const result = await invoke<GameFolderCheck>("check_game_folder", {
      path,
    })

    if (result.valid && result.gameVersion === version) {
      applyValidGameFolder(result)
      return
    }

    const updatedInstalls = removeSavedGameInstall(version)
    setSavedGameInstalls(updatedInstalls)

    await dialog({
      titleKey: "dialogs.savedInstallRemovedTitle",
      messageKey: "dialogs.savedInstallRemovedMessage",
      params: {
        version: gameVersionLabels[version],
      },
      kind: "warning",
    })

    await switchToFirstValidSavedInstall(updatedInstalls)
  }
  
  async function removeSelectedSavedInstall() {
    if (!selectedSavedVersion) return

    const updatedInstalls = removeSavedGameInstall(selectedSavedVersion)
    setSavedGameInstalls(updatedInstalls)

    const remainingVersions = GAME_VERSIONS.filter(
      (version) => updatedInstalls[version],
    )

    if (gameCheck?.gameVersion === selectedSavedVersion) {
      await switchToFirstValidSavedInstall(updatedInstalls)
      return
    }

    setSelectedSavedVersion(
      remainingVersions.length > 1 ? remainingVersions[0] : "",
    )
  }

  async function checkLoaderFiles(path: string, version = gameCheck?.gameVersion) {
    const config = readLoaderProxyConfig()

    const proxyDllNames =
      version && isKnownGameVersion(version)
        ? getEnabledLoaderProxyNames(config, version)
        : undefined

    const result = await invoke<LoaderFilesCheck>("check_loader_files", {
      path,
      proxyDllNames,
    })

    setLoaderCheck(result)
  }

  const currentLoaderProxyVersion =
    gameCheck?.valid && isKnownGameVersion(gameCheck.gameVersion)
      ? gameCheck.gameVersion
      : null

  const hasLoaderProxyChanges = currentLoaderProxyVersion
    ? JSON.stringify(loaderProxyConfig[currentLoaderProxyVersion]) !==
      JSON.stringify(savedLoaderProxyConfig[currentLoaderProxyVersion])
    : false

  function getCurrentLoaderProxyConfigError(config: LoaderProxyConfig) {
    if (!currentLoaderProxyVersion) {
      return ""
    }

    return getLoaderProxyConfigError({
      ...savedLoaderProxyConfig,
      [currentLoaderProxyVersion]: config[currentLoaderProxyVersion],
    })
  }

  function updateLoaderProxyConfig(nextConfig: LoaderProxyConfig) {
    setLoaderProxyConfig(nextConfig)
    setLoaderProxyError(getCurrentLoaderProxyConfigError(nextConfig))
  }

  function toggleLoaderProxyName(version: GameVersion, index: number) {
    updateLoaderProxyConfig({
      ...loaderProxyConfig,
      [version]: loaderProxyConfig[version].map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, enabled: !entry.enabled } : entry,
      ),
    })
  }

  function updateCustomLoaderProxyName(version: GameVersion, index: number, nextName: string) {
    updateLoaderProxyConfig({
      ...loaderProxyConfig,
      [version]: loaderProxyConfig[version].map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, name: nextName } : entry,
      ),
    })
  }

  function addCustomLoaderProxyName(version: GameVersion) {
    const customCount = loaderProxyConfig[version].filter((entry) => entry.custom).length

    if (customCount >= MAX_CUSTOM_LOADER_PROXY_NAMES[version]) {
      setLoaderProxyError(
        t("settings.loaderProxyErrors.maxCustomNames", {
          version: gameVersionLabels[version],
          count: MAX_CUSTOM_LOADER_PROXY_NAMES[version],
        }),
      )
      return
    }

    let index = 1
    let name = `custom${index}.dll`
    const usedNames = new Set(loaderProxyConfig[version].map((entry) => entry.name.toLowerCase()))

    while (usedNames.has(name.toLowerCase())) {
      index += 1
      name = `custom${index}.dll`
    }

    updateLoaderProxyConfig({
      ...loaderProxyConfig,
      [version]: [
        ...loaderProxyConfig[version],
        {
          name,
          custom: true,
          enabled: true,
        },
      ],
    })
  }

  function removeCustomLoaderProxyName(version: GameVersion, index: number) {
    updateLoaderProxyConfig({
      ...loaderProxyConfig,
      [version]: loaderProxyConfig[version].filter(
        (entry, entryIndex) => !entry.custom || entryIndex !== index,
      ),
    })
  }

  async function applyLoaderProxyConfig() {
    const error = getCurrentLoaderProxyConfigError(loaderProxyConfig)

    if (error) {
      setLoaderProxyError(error)
      return
    }

    const savedConfig = writeLoaderProxyConfig(loaderProxyConfig)
    const allProxyDllNames = getKnownLoaderProxyNames(savedConfig)

    setLoaderProxyConfig(savedConfig)
    setSavedLoaderProxyConfig(savedConfig)
    setLoaderProxyError("")

    if (!gamePath || !gameCheck?.valid || !currentLoaderProxyVersion) {
      window.dispatchEvent(new Event("loaderProxyConfigChanged"))
      return
    }

    try {
      setIsApplyingLoaderProxy(true)

      const proxyDllNames = getEnabledLoaderProxyNames(savedConfig, currentLoaderProxyVersion)

      const result = await invoke<LoaderFilesCheck>(
        proxyDllNames.length > 0 ? "install_loader_files" : "uninstall_loader_files",
        proxyDllNames.length > 0
          ? {
              path: gamePath,
              proxyDllNames,
              allProxyDllNames,
            }
          : {
              path: gamePath,
              allProxyDllNames,
            },
      )

      setLoaderCheck(result)

      if (result.valid) {
        saveStoredLoaderVersions(loaderVersions, currentLoaderProxyVersion)
      } else {
        removeStoredLoaderVersions(currentLoaderProxyVersion)
      }

      window.dispatchEvent(new Event("loaderProxyConfigChanged"))
    } finally {
      setIsApplyingLoaderProxy(false)
    }
  }

  async function checkForUpdates() {
    try {
      setIsCheckingUpdate(true)

      const update = await check()

      if (!update) {
        await dialog({
          titleKey: "dialogs.updateCheckTitle",
          messageKey: "dialogs.alreadyUpToDate",
          kind: "info",
          timer: 10,
          timerTo: "yes",
        })
        return
      }

      const shouldUpdate = await dialog({
        titleKey: "dialogs.updateCheckTitle",
        messageKey: "dialogs.updateAvailableConfirm",
        kind: "info",
        okLabelKey: "dialogs.updateAvailableOk",
        isCancel: true,
        cancelLabelKey: "dialogs.updateAvailableCancel",
        timer: 60,
        timerTo: "yes",
      })

      if (!shouldUpdate.ok) {
        return
      }

      await update.downloadAndInstall()

      await dialog({
        titleKey: "dialogs.updateCheckTitle",
        messageKey: "dialogs.updateInstalledRestarting",
        kind: "success",
        timer: 30,
        timerTo: "yes",
      })

      await relaunch()
    } catch (error) {
      console.error(error)

      await dialog({
        titleKey: "dialogs.updateCheckTitle",
        messageKey: "dialogs.updateCheckFailed",
        kind: "error",
      })
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  function updateAutoCheckUpdates(next: boolean) {
    setAutoCheckUpdates(next)
    localStorage.setItem("autoCheckUpdates", String(next))
  }

  function updateCloseOnLaunch(next: boolean) {
    setCloseOnLaunch(next)
    localStorage.setItem("closeOnLaunch", String(next))
  }

  function updateBackgroundMode(mode: BackgroundMode) {
    setBackgroundMode(mode)
    localStorage.setItem("backgroundMode", mode)
    window.dispatchEvent(new Event("backgroundModeChanged"))
  }

  const savedInstallEntries = GAME_VERSIONS
    .map((version) => ({
      version,
      path: savedGameInstalls[version],
    }))
    .filter((install): install is { version: GameVersion; path: string } =>
      Boolean(install.path),
    )

  return (
    <div className="flex w-full justify-center p-6">
      <div className="flex w-full max-w-400 flex-col space-y-1 rounded-2xl bg-zinc-900 p-4">
        <AppUpdatesCard
          isCheckingUpdate={isCheckingUpdate}
          autoCheckUpdates={autoCheckUpdates}
          onCheckForUpdates={checkForUpdates}
          onAutoCheckUpdatesChange={updateAutoCheckUpdates}
        />

        <LanguageCard />

        <GameFolderCard
          gamePath={gamePath}
          gameCheck={gameCheck}
          loaderCheck={loaderCheck}
          savedGameInstalls={savedGameInstalls}
          savedInstallEntries={savedInstallEntries}
          selectedSavedVersion={selectedSavedVersion}
          savedSelectOpen={savedSelectOpen}
          gameVersionLabels={gameVersionLabels}
          isDetectingGameFolders={isDetectingGameFolders}
          onGamePathChange={setGamePath}
          onCheckTypedPath={checkTypedPath}
          onBrowseFolder={browseFolder}
          onAutoDetectGameFolders={detectAllGameFolders}
          onResetSavedGameFolder={resetSavedGameFolder}
          onSelectSavedInstall={selectSavedInstall}
          onRemoveSelectedSavedInstall={removeSelectedSavedInstall}
          onSavedSelectOpenChange={setSavedSelectOpen}
        />

        <LoaderDllFilesCard
          gameCheck={gameCheck}
          currentLoaderProxyVersion={currentLoaderProxyVersion}
          loaderProxyConfig={loaderProxyConfig}
          loaderProxyError={loaderProxyError}
          hasLoaderProxyChanges={hasLoaderProxyChanges}
          isApplyingLoaderProxy={isApplyingLoaderProxy}
          onAddCustomLoaderProxyName={addCustomLoaderProxyName}
          onApplyLoaderProxyConfig={applyLoaderProxyConfig}
          onToggleLoaderProxyName={toggleLoaderProxyName}
          onUpdateCustomLoaderProxyName={updateCustomLoaderProxyName}
          onRemoveCustomLoaderProxyName={removeCustomLoaderProxyName}
        />

        <CloseOnLaunchCard
          closeOnLaunch={closeOnLaunch}
          onCloseOnLaunchChange={updateCloseOnLaunch}
        />

        <AppBackgroundCard
          backgroundMode={backgroundMode}
          onBackgroundModeChange={updateBackgroundMode}
        />
      </div>
    </div>
  )
}
