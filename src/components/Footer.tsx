import { useEffect, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { openUrl } from "@tauri-apps/plugin-opener"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"

export default function Footer() {
  const [appVersion, setAppVersion] = useState("")

  useEffect(() => {
    async function loadVersion() {
      const version = await getVersion()
      setAppVersion(version)
    }

    loadVersion()
  }, [])

  return (
    <footer className="flex h-9 items-center justify-between border-t border-pink-900 bg-zinc-950 px-3 text-xs text-zinc-500">
        <div>Neverness to Everness Mod Manager • v{appVersion} • by UnLuckyLust</div>
        <div className="flex items-center gap-3">
            <button
                onClick={() =>
                openUrl("https://ko-fi.com/unluckylust")
                }
                className="text-zinc-400 transition hover:text-pink-900 text-lg"
                title="Buy me a Coffee"
            >
                <AppIcon icon={Icons.mugHot} />
            </button>

            <button
                onClick={() =>
                openUrl("https://gamebanana.com/tools/22823")
                }
                // className="text-zinc-400 transition hover:text-pink-900 text-lg"
                title="GameBanana"
            >
                <div className="social-icon-mask icon-gamebanana" />
            </button>

            <button
                onClick={() =>
                openUrl("https://github.com/UnLuckyLust/NTEMM")
                }
                className="text-zinc-400 transition hover:text-pink-900 text-lg"
                title="GitHub"
            >
                <AppIcon icon={Icons.github} />
            </button>

        </div>
    </footer>
  )
}