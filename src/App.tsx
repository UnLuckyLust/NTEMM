import { useEffect, useRef, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { invoke } from "@tauri-apps/api/core"
import { relaunch } from "@tauri-apps/plugin-process"
import { check, type Update } from "@tauri-apps/plugin-updater"
import AppLayout from "@/layout/AppLayout"
import Settings from "@/pages/Settings"
import Home from "@/pages/Home"
import GameBanana from "@/pages/GameBanana"
import { CHANGELOG_BY_VERSION } from "@/data/changelog"
import { dialog } from "@/lib/dialog";
import { AppPage } from "./types/app"
import { useI18n } from "@/i18n"

export default function App() {
  const { dir, t } = useI18n()

  const [activePage, setActivePage] = useState<AppPage>("home")
  const isHomeOpen = activePage === "home"
  const isSettingsOpen = activePage === "settings"
  const isGameBananaOpen = activePage === "gamebanana"

  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null)
  const [updateStatus, setUpdateStatus] = useState("")
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)

  const [changelogVersion, setChangelogVersion] = useState("")
  const [changelogItems, setChangelogItems] = useState<string[]>([])
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)

  const warnedRef = useRef(false)

  function toggleHome() {
    setActivePage("home")
  }

  function toggleSettings() {
    setActivePage((prev) => (prev === "settings" ? "home" : "settings"))
  }

  function toggleGameBanana() {
    setActivePage((prev) => (prev === "gamebanana" ? "home" : "gamebanana"))
  }

  async function installUpdate() {
    if (!availableUpdate) return

    try {
      setIsInstallingUpdate(true)
      setUpdateStatus(t("updates.downloadingInstalling"))

      await availableUpdate.downloadAndInstall()

      setUpdateStatus(t("updates.installedRestarting"))
      await relaunch()
    } catch (error) {
      console.error(error)
      setUpdateStatus(t("updates.installFailed"))
    } finally {
      setIsInstallingUpdate(false)
    }
  }

  useEffect(() => {
    async function checkForUpdatesOnLaunch() {
      const autoCheckUpdates =
        localStorage.getItem("autoCheckUpdates") !== "false"

      if (!autoCheckUpdates) {
        return
      }

      try {
        const update = await check()

        if (!update) return

        setAvailableUpdate(update)
        setUpdateStatus(
          update.body?.trim() ||
            t("updates.versionAvailable", { version: update.version }),
        )
      } catch (error) {
        console.warn("Update check failed:", error)
      }
    }

    checkForUpdatesOnLaunch()
  }, [])

  useEffect(() => {
    async function showChangelogForNewVersion() {
      try {
        const version = await getVersion()
        const lastSeenVersion = localStorage.getItem("lastSeenAppVersion")

        if (lastSeenVersion === version) return

        localStorage.setItem("lastSeenAppVersion", version)

        const items = CHANGELOG_BY_VERSION[version]
        if (!items?.length) return

        setChangelogVersion(version)
        setChangelogItems(items)
        setIsChangelogOpen(true)
      } catch (error) {
        console.warn("Failed to show changelog:", error)
      }
    }

    async function showDevChangelog() {
      const version = await getVersion()
      setChangelogVersion(version)
      setChangelogItems(
        CHANGELOG_BY_VERSION[version] ?? [t("updates.noChangelogFound")],
      )
      setIsChangelogOpen(true)
    }
    showChangelogForNewVersion()
    window.addEventListener("showDevChangelog", showDevChangelog)
    return () => {
      window.removeEventListener("showDevChangelog", showDevChangelog)
    }
  }, [])

  useEffect(() => {
    async function checkGameFolder() {
      if (warnedRef.current) return
      const savedPath = localStorage.getItem("gameFolder")
      if (!savedPath) {
        warnedRef.current = true
        await dialog({
          titleKey: "dialogs.gameFolderRequiredTitle",
          messageKey: "dialogs.gameFolderRequiredMessage",
          kind: "warning",
        })
        setActivePage("settings")
        return
      }

      try {
        const result = await invoke<{ valid: boolean }>("check_game_folder", {
          path: savedPath,
        })
        if (!result.valid) {
          warnedRef.current = true
          await dialog({
            titleKey: "dialogs.invalidGameFolderTitle",
            messageKey: "dialogs.invalidGameFolderMessage",
            kind: "warning",
          })

          setActivePage("settings")
        }
      } catch {
        warnedRef.current = true
        await dialog({
          titleKey: "dialogs.folderValidationFailedTitle",
          messageKey: "dialogs.folderValidationFailedMessage",
          kind: "error",
        })

        setActivePage("settings")
      }
    }

    checkGameFolder()
    function onGameFolderChanged() {
      warnedRef.current = false
    }
    window.addEventListener("gameFolderChanged", onGameFolderChanged)
    return () => {
      window.removeEventListener("gameFolderChanged", onGameFolderChanged)
    }
  }, [])

  return (
    <div dir={dir} data-dir={dir} className="font-ui">
      
      <AppLayout
        onOpenHome={toggleHome}
        onOpenSettings={toggleSettings}
        onOpenGameBanana={toggleGameBanana}
        isHomeOpen={isHomeOpen}
        isSettingsOpen={isSettingsOpen}
        isGameBananaOpen={isGameBananaOpen}
      >
        {activePage === "settings" ? (
          <Settings />
        ) : activePage === "gamebanana" ? (
          <GameBanana />
        ) : (
          <Home onOpenGameBanana={() => setActivePage("gamebanana")} />
        )}
      </AppLayout>

      {availableUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <h2 className="font-subtitle text-lg font-bold text-pink-500">{t("updates.newVersionAvailable")}
              <span className="text-xs text-zinc-400"> v{availableUpdate.version}</span>
            </h2>

            {updateStatus && (
              <div className="mt-4 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">
                {updateStatus}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setAvailableUpdate(null)}
                disabled={isInstallingUpdate}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("updates.later")}
              </button>

              <button
                onClick={installUpdate}
                disabled={isInstallingUpdate}
                className="rounded-lg bg-pink-700 px-4 py-2 text-sm text-white hover:bg-pink-600 disabled:opacity-50"
              >
                {isInstallingUpdate ? t("updates.installing") : t("updates.installUpdate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isChangelogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="flex max-h-[calc(100vh-10rem)] w-max max-w-180 flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <h2 className="font-subtitle text-lg font-bold text-pink-500 text-center">
              <span>{t("updates.whatsNew")}</span>
              {" "}
              <span className="text-xs text-zinc-400">{t("updates.in")}</span>
              {" "}
              <bdi dir="ltr">NTEMM</bdi>
              {" "}
              <bdi dir="ltr" className="text-xs text-zinc-400">
                v{changelogVersion}
              </bdi>
            </h2>

            <div className="mt-4 min-h-0 overflow-y-auto pe-2">
              <ul dir="ltr" className="list-disc space-y-2 ps-5 text-sm text-zinc-300">
                {changelogItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIsChangelogOpen(false)}
                className="rounded-lg bg-pink-700 px-4 py-2 text-sm text-white hover:bg-pink-600"
              >
                {t("updates.gotIt")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}