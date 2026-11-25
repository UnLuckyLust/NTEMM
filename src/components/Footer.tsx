import { useEffect, useMemo, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { openUrl } from "@tauri-apps/plugin-opener"
import { invoke } from "@tauri-apps/api/core"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { useI18n } from "@/i18n"

function joinPath(...parts: string[]) {
  return parts
    .filter(Boolean)
    .join("\\")
    .replace(/[\\/]+/g, "\\")
}

async function openFolder(path: string) {
  if (!path) {
    console.warn("No folder path provided")
    return
  }

  try {
    await invoke("open_folder", { path })
  } catch (error) {
    console.error("Failed to open folder:", path, error)
  }
}

export default function Footer() {
    const { t } = useI18n()
    const [appVersion, setAppVersion] = useState("")
    const [gamePath, setGamePath] = useState(() => localStorage.getItem("gameFolder") ?? "")
    const [ntemmModsPath, setNtemmModsPath] = useState("")

    const gameModsPath = useMemo(() => {
    if (!gamePath) return ""

    return joinPath(gamePath, "Client", "WindowsNoEditor", "HT", "Content", "Paks", "~mods")
    }, [gamePath])

    useEffect(() => {
    async function loadFooterData() {
        try {
        const version = await getVersion()
        const modsPath = await invoke<string>("get_ntemm_mods_dir")

        setAppVersion(version)
        setNtemmModsPath(modsPath)
        } catch (error) {
        console.error("Failed to load footer data:", error)
        }
    }

    loadFooterData()
    }, [])

    useEffect(() => {
    function refreshGamePath() {
        setGamePath(localStorage.getItem("gameFolder") ?? "")
    }

    window.addEventListener("gameFolderChanged", refreshGamePath)

    return () => {
        window.removeEventListener("gameFolderChanged", refreshGamePath)
    }
    }, [])

  return (
    <footer className="flex h-9 items-center justify-between border-t border-pink-900 bg-zinc-950 px-3 text-xs text-zinc-500">
      <div>{t("footer.appInfo", { version: appVersion })}</div>

      <div className="flex items-center gap-3">
        <button
        onClick={() => openFolder(gameModsPath)}
        disabled={!gameModsPath}
        className="text-zinc-400 transition hover:text-pink-900 disabled:cursor-not-allowed disabled:opacity-40 text-lg"
        title={t("footer.openGameModsFolder")}
        >
        <AppIcon icon={Icons.folderOpen} />
        </button>

        <button
        onClick={() => openFolder(ntemmModsPath)}
        disabled={!ntemmModsPath}
        className="text-zinc-400 transition hover:text-pink-900 disabled:cursor-not-allowed disabled:opacity-40 text-lg"
        title={t("footer.openNtemmModsFolder")}
        >
        <AppIcon icon={Icons.boxArchive} />
        </button>

        <button
          onClick={() => openUrl("https://ko-fi.com/unluckylust")}
          className="text-zinc-400 transition hover:text-pink-900 text-lg"
          title={t("footer.buyMeACoffee")}
        >
          <AppIcon icon={Icons.mugHot} />
        </button>

        <button
          onClick={() => openUrl("https://gamebanana.com/tools/22823")}
          title={t("footer.openGameBanana")}
        >
          <div className="social-icon-mask icon-gamebanana" />
        </button>

        <button
          onClick={() => openUrl("https://github.com/UnLuckyLust/NTEMM")}
          className="text-zinc-400 transition hover:text-pink-900 text-lg"
          title={t("footer.openGitHub")}
        >
          <AppIcon icon={Icons.github} />
        </button>
      </div>
    </footer>
  )
}