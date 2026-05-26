import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { useEffect, useState } from "react"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { GameFolderCheck, LoaderFilesCheck } from "@/types/modManager"
import { dialog } from "@/lib/dialog"

interface SettingsProps {
  onBackHome: () => void
}

export default function Settings({ onBackHome }: SettingsProps) {
  const [gamePath, setGamePath] = useState("")
  const [gameCheck, setGameCheck] = useState<GameFolderCheck | null>(null)
  const [loaderCheck, setLoaderCheck] = useState<LoaderFilesCheck | null>(null)
  const [closeOnLaunch, setCloseOnLaunch] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState("animated")
  const [updateStatus, setUpdateStatus] = useState("")
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  useEffect(() => {
    const savedPath = localStorage.getItem("gameFolder")
    setCloseOnLaunch(localStorage.getItem("closeOnLaunch") === "true")
    setBackgroundMode(localStorage.getItem("backgroundMode") ?? "animated")

    if (savedPath) {
      setGamePath(savedPath)

      invoke<GameFolderCheck>("check_game_folder", {
        path: savedPath,
      }).then((result) => {
        setGameCheck(result)

        if (result.valid) {
          checkLoaderFiles(result.path)
        }
      })

      return
    }

    invoke<GameFolderCheck>("auto_detect_game_folder").then((result) => {
      setGamePath(result.path)
      setGameCheck(result)

      if (result.valid) {
        localStorage.setItem("gameFolder", result.path)
        window.dispatchEvent(new Event("gameFolderChanged"))
        checkLoaderFiles(result.path)
      }
    })
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
      localStorage.setItem("gameFolder", result.path)
      window.dispatchEvent(new Event("gameFolderChanged"))
      checkLoaderFiles(result.path)
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
      localStorage.setItem("gameFolder", result.path)
      window.dispatchEvent(new Event("gameFolderChanged"))
      checkLoaderFiles(result.path)
    }
  }

  function resetSavedGameFolder() {
    localStorage.removeItem("gameFolder")
    setGamePath("")
    setGameCheck(null)
    setLoaderCheck(null)
    window.dispatchEvent(new Event("gameFolderChanged"))
  }

  async function checkLoaderFiles(path: string) {
    const result = await invoke<LoaderFilesCheck>("check_loader_files", {
      path,
    })

    setLoaderCheck(result)
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