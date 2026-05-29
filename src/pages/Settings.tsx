import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { useEffect, useState } from "react"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { loaderVersions } from "@lib/config"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { dialog } from "@/lib/dialog"
import { SettingsProps } from "@/interfaces/app"
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
  isValidLoaderProxyName,
  readLoaderProxyConfig,
  writeLoaderProxyConfig,
} from "@/helpers/loaderProxySettings"

const SAVED_GAME_INSTALLS_KEY = "savedGameInstalls"
const GAME_VERSIONS = ["global", "cn", "tw"] as const
const gameVersionLabels: Record<GameVersion, string> = {
  global: "GL",
  cn: "CN",
  tw: "TW",
}

function isKnownGameVersion(version: GameFolderCheck["gameVersion"]): version is GameVersion {
  return version === "global" || version === "cn" || version === "tw"
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

export default function Settings({ onBackHome }: SettingsProps) {
  const [gamePath, setGamePath] = useState("")
  const [gameCheck, setGameCheck] = useState<GameFolderCheck | null>(null)
  const [loaderCheck, setLoaderCheck] = useState<LoaderFilesCheck | null>(null)
  const [closeOnLaunch, setCloseOnLaunch] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState("animated")
  const [updateStatus, setUpdateStatus] = useState("")
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

    const result = await invoke<GameFolderCheck>("auto_detect_game_folder")

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
    for (const version of ["global", "cn", "tw"] as const) {
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

        for (const version of ["global", "cn", "tw"] as const) {
          if (cleanedInstalls[version] === savedPath) {
            delete cleanedInstalls[version]
          }
        }

        writeSavedGameInstalls(cleanedInstalls)
        setSavedGameInstalls(cleanedInstalls)

        await dialog({
          title: "Saved Game Folder Removed",
          message: "The saved game folder is no longer valid and was removed from the saved installs list.",
          kind: "warning",
        })

        await switchToFirstValidSavedInstall(cleanedInstalls)
        return
      }

      await switchToFirstValidSavedInstall(installs)
    }

    initGameFolder()
  }, [])

  async function browseFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Neverness to Everness folder",
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
      title: "Saved Install Removed",
      message: `${gameVersionLabels[version]} install is no longer valid and was removed from the saved installs list.`,
      kind: "warning",
    })

    await switchToFirstValidSavedInstall(updatedInstalls)
  }
  
  async function removeSelectedSavedInstall() {
    if (!selectedSavedVersion) return

    const updatedInstalls = removeSavedGameInstall(selectedSavedVersion)
    setSavedGameInstalls(updatedInstalls)

    const remainingVersions = (["global", "cn", "tw"] as const).filter(
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
        `${gameVersionLabels[version]} can only have up to ${MAX_CUSTOM_LOADER_PROXY_NAMES[version]} custom loader names`,
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
        localStorage.setItem("loaderVersions", JSON.stringify(loaderVersions))
      } else {
        localStorage.removeItem("loaderVersions")
      }

      window.dispatchEvent(new Event("loaderProxyConfigChanged"))
    } finally {
      setIsApplyingLoaderProxy(false)
    }
  }

  async function checkForUpdates() {
    try {
      setIsCheckingUpdate(true)
      setUpdateStatus("Checking for updates...")

      const update = await check()

      if (!update) {
        setUpdateStatus("")
        await dialog({
          title: "Update Check",
          message: "NTEMM is already up to date",
          kind: "info",
          timer: 10,
          timerTo: "yes"
        });
        return
      }

      setUpdateStatus(`Downloading update ${update.version}...`)

      await update.downloadAndInstall()

      setUpdateStatus("")
      await dialog({
        title: "Update Check",
        message: "Update installed, Restarting the app...",
        kind: "success",
      });
      await relaunch()
    } catch (error) {
      console.error(error)
      setUpdateStatus("")
      await dialog({
        title: "Update Check",
        message: "Update check failed",
        kind: "error",
      });
    } finally {
      setIsCheckingUpdate(false)
    }
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
    <div className="flex flex-col space-y-2 p-6 w-full items-center">
      <div className="w-full max-w-400">
        <div className="relative flex items-center">
          <section className="rounded-xl bg-zinc-900 p-1">
            <button
              onClick={onBackHome}
              className="rounded-lg p-2 text-sm font-semibold text-zinc-400 hover:bg-zinc-700"
            >
              <AppIcon icon={Icons.anglesLeft} className="mr-2 text-[15px]" />
              Back to Home
            </button>
          </section>

          {updateStatus && (
            <section className="absolute left-1/2 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2">
              <div className="text-sm text-zinc-400">{updateStatus}</div>
            </section>
          )}
        </div>
      </div>

      <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">App updates</div>
            <div className="text-sm text-zinc-500">
              Check for a new NTEMM version and install it automatically
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex rounded-lg bg-zinc-800 p-1">
              <button
                onClick={() => {
                  window.dispatchEvent(new Event("showDevChangelog"))
                }}
                className="rounded-lg px-4 text-sm font-semibold text-zinc-400 hover:bg-zinc-700"
              >
                Show Changelog
              </button>
            </div>

            <button
              onClick={checkForUpdates}
              disabled={isCheckingUpdate}
              className="rounded-lg bg-pink-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCheckingUpdate ? "Checking..." : "Check for updates"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400">
        <label className="font-semibold" htmlFor="game-folder">
          Game Folder
        </label>

        <div className="flex gap-2 mt-1">
          <input
            id="game-folder"
            value={gamePath}
            onChange={(e) => setGamePath(e.target.value)}
            onBlur={checkTypedPath}
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-800 px-3 py-2 text-sm text-zinc-500 outline-none focus:border-pink-500"
            placeholder="Select your Neverness to Everness install folder"
          />

          <div className="flex rounded-lg bg-zinc-800 p-1">
            <button
              onClick={browseFolder}
              className="rounded-lg px-4 text-sm font-semibold g-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              Browse
            </button>
          </div>

          {savedInstallEntries.length > 1 && (
            <div className="flex gap-2 border border-pink-700/60 rounded-lg p-1">
              <div className="relative">
                <select
                  title="Select saved game path"
                  value={selectedSavedVersion}
                  onMouseDown={() => setSavedSelectOpen((open) => !open)}
                  onFocus={() => setSavedSelectOpen(true)}
                  onBlur={() => setSavedSelectOpen(false)}
                  onChange={(e) => {
                    selectSavedInstall(e.target.value as GameVersion)
                    setSavedSelectOpen(false)
                  }}
                  className="w-13 appearance-none rounded-lg bg-zinc-800 py-1 pr-4 text-center text-sm text-zinc-400 outline-none"
                >
                  {savedInstallEntries.map(({ version }) => (
                    <option key={version} value={version}>
                      {gameVersionLabels[version]}
                    </option>
                  ))}
                </select>

                <AppIcon
                  icon={savedSelectOpen ? Icons.chevronUp : Icons.chevronDown}
                  className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
                />
              </div>

              <button
                type="button"
                title="Remove saved game path"
                onClick={removeSelectedSavedInstall}
                disabled={!selectedSavedVersion || !savedGameInstalls[selectedSavedVersion]}
                className="rounded-lg text-md text-zinc-500 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <AppIcon icon={Icons.delete} />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={resetSavedGameFolder}
            className="rounded-lg border border-pink-800 bg-pink-950/40 px-3 py-2 text-sm text-pink-300 hover:bg-pink-900/40 min-w-max"
          >
            Reset Game Folder
          </button>

          <div className="flex gap-2 w-full justify-end content-end">
            {gameCheck && (
              <div
                className={`flex items-center rounded-lg border px-3 py-2 text-sm ${
                  gameCheck.valid
                    ? "border-green-700 bg-green-950/30 text-green-200"
                    : "border-red-700 bg-red-950/30 text-red-200"
                }`}
              >
                <div className="font-semibold">
                  {gameCheck.message} {" "}
                  {gameCheck?.valid && `(${(gameCheck.gameVersion.toUpperCase())})`}</div>
              </div>
            )}

            {loaderCheck && (
              <div
                className={`flex flex-col justify-center rounded-lg border px-3 py-2 text-sm ${
                  loaderCheck.valid
                    ? "border-green-700 bg-green-950/30 text-green-200"
                    : "border-yellow-700 bg-yellow-950/30 text-yellow-200"
                }`}
              >
                <div className="font-semibold">{loaderCheck.message}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">Loader DLL files</div>
            <div className="text-sm text-zinc-500">
              Choose which loader proxy DLL files NTEMM should install for {gameCheck?.gameVersion.toUpperCase()} version
            </div>
          </div>

          <div className="flex gap-2">
            {hasLoaderProxyChanges && !loaderProxyError && (
              <div className="rounded-lg border border-yellow-700 bg-yellow-950/30 px-3 py-1.5 text-sm text-yellow-200">
                Loader changes are pending
              </div>
            )}
            
            {currentLoaderProxyVersion && (
              <div className="flex rounded-lg bg-zinc-800 p-1">
                <button
                  onClick={() => addCustomLoaderProxyName(currentLoaderProxyVersion)}
                  disabled={
                    loaderProxyConfig[currentLoaderProxyVersion].filter((entry) => entry.custom).length >=
                    MAX_CUSTOM_LOADER_PROXY_NAMES[currentLoaderProxyVersion]
                  }
                  className="rounded-lg bg-zinc-800 px-4 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-600 disabled:hover:bg-zinc-800"
                >
                  {loaderProxyConfig[currentLoaderProxyVersion].filter((entry) => entry.custom).length >=
                  MAX_CUSTOM_LOADER_PROXY_NAMES[currentLoaderProxyVersion]
                    ? "Max Custom"
                    : "Add Custom"}
                </button>
              </div>
            )}
            
            <button
              type="button"
              onClick={applyLoaderProxyConfig}
              disabled={!hasLoaderProxyChanges || Boolean(loaderProxyError) || isApplyingLoaderProxy}
              className="rounded-lg bg-pink-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplyingLoaderProxy ? "Applying..." : "Apply Changes"}
            </button>
          </div>
        </div>

        {currentLoaderProxyVersion ? (
          <div className="min-h-12 overflow-x-auto overflow-y-hidden py-2">
            <div className="flex w-max min-w-full justify-start gap-2 sm:justify-center">
              {loaderProxyConfig[currentLoaderProxyVersion].map((entry, index) => {
                const invalid = !isValidLoaderProxyName(entry.name)

                return (
                  <div
                    key={`${currentLoaderProxyVersion}-${index}`}
                    className={`flex h-10 w-40 shrink-0 items-center rounded-xl border gap-1 px-1 ${
                      entry.enabled
                        ? "border-pink-700/60"
                        : "border-zinc-800"
                    }`}
                  >
                    <button
                      title={entry.enabled ? "Disable proxy dll name" : "Enable proxy dll name"}
                      type="button"
                      onClick={() => toggleLoaderProxyName(currentLoaderProxyVersion, index)}
                      className={`grid h-6 w-6 shrink-0 place-items-center text-md transition ${
                        entry.enabled
                          ? "text-pink-700 hover:text-pink-500"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      
                      <AppIcon icon={entry.enabled ? Icons.check : Icons.close} />
                    </button>

                    {entry.custom ? (
                      <input
                        title="Custom proxy dll name"
                        value={entry.name}
                        onChange={(e) =>
                          updateCustomLoaderProxyName(
                            currentLoaderProxyVersion,
                            index,
                            e.target.value,
                          )
                        }
                        className={`h-7 min-w-0 flex-1 rounded-lg border bg-zinc-800 px-2 text-sm outline-none ${
                          invalid
                            ? "border-red-700 text-red-200"
                            : "border-zinc-800 text-zinc-300 focus:border-zinc-700"
                        }`}
                      />
                    ) : (
                      <div className="flex h-7 min-w-0 flex-1 items-center truncate rounded-lg bg-zinc-800 px-2 text-sm text-zinc-300">
                        {entry.name}
                      </div>
                    )}

                    {entry.custom && (
                      <button
                        title="Delete proxy dll name"
                        type="button"
                        onClick={() => removeCustomLoaderProxyName(currentLoaderProxyVersion, index)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:text-red-500"
                      >
                        <AppIcon icon={Icons.delete} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-yellow-700 bg-yellow-950/30 px-3 py-2 text-sm text-yellow-200">
            Select a valid game folder to edit loader DLL names.
          </div>
        )}

        {loaderProxyError && (
          <div className="rounded-lg border border-red-700 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {loaderProxyError}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">Close app when launching game</div>
            <div className="text-sm text-zinc-500">
              Automatically close NTEMM after Launching the Game
            </div>
          </div>

          <div className={`flex rounded-lg bg-zinc-800 p-1 ${
            closeOnLaunch
              ? "bg-pink-700 text-white"
              : "bg-zinc-800"
          }`}>
            <button
              onClick={() => {
                const next = !closeOnLaunch
                setCloseOnLaunch(next)
                localStorage.setItem("closeOnLaunch", String(next))
              }}
              className={`rounded-lg px-4 py-1 text-sm font-semibold ${
                closeOnLaunch
                  ? "bg-pink-700 text-white hover:bg-pink-600"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {closeOnLaunch ? "On" : "Off"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">App background</div>
            <div className="text-sm text-zinc-500">
              Choose between a static image, animated video, or no background
            </div>
          </div>

          <div className="flex rounded-lg bg-zinc-800 p-1">
            {(["none", "static", "animated"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setBackgroundMode(mode)
                  localStorage.setItem("backgroundMode", mode)
                  window.dispatchEvent(new Event("backgroundModeChanged"))
                }}
                className={`rounded-md px-4 py-1 text-sm font-semibold capitalize ${
                  backgroundMode === mode
                    ? "bg-pink-700 text-white"
                    : "text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}