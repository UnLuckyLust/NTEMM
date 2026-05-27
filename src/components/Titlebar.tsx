import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect, useState, useRef } from "react"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import logo from "@/assets/icon.png"
import { TitlebarProps } from "@/interfaces/app"

const appWindow = getCurrentWindow()

function useOneShotAnimation(duration = 600) {
  const [active, setActive] = useState(false)
  const runIdRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)

  function trigger() {
    runIdRef.current += 1
    const runId = runIdRef.current

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setActive(false)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (runId !== runIdRef.current) return

        setActive(true)

        timeoutRef.current = window.setTimeout(() => {
          if (runId !== runIdRef.current) return
          setActive(false)
          timeoutRef.current = null
        }, duration)
      })
    })
  }

  function stop() {
    runIdRef.current += 1

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setActive(false)
  }

  return [active, trigger, stop] as const
}

export default function Titlebar({ onOpenSettings, isSettingsOpen /*, onOpenGameBanana, isGameBananaOpen */ }: TitlebarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [animateMin, triggerMin, stopMin] = useOneShotAnimation(800)
  const [animateMax, triggerMax, stopMax] = useOneShotAnimation(800)
  const [animateClose, triggerClose, stopClose] = useOneShotAnimation(500)
  const [animateSettings, triggerSettings, stopSettings] = useOneShotAnimation(1000)
  // const [animateGB, triggerGB, stopGB] = useOneShotAnimation(800)

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized)

    const unlistenPromise = appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized())
    })

    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  async function toggleMaximize() {
    if (isMaximized) {
      await appWindow.unmaximize()
      setIsMaximized(false)
    } else {
      await appWindow.maximize()
      setIsMaximized(true)
    }
  }

  const iconBtn =
    "flex h-full w-8 items-center justify-center " +
    "bg-transparent border-0 p-0 text-zinc-500 transition-colors duration-150"

  const iconVariants = {
    red: "hover:text-red-400 active:text-red-300",
    yellow: "hover:text-amber-400 active:text-amber-300",
    blue: "hover:text-blue-400 active:text-blue-300",
  }

  return (
    <div className="flex h-11 items-center justify-between border-b border-pink-900 bg-zinc-950 select-none text-zinc-100">
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center px-1"
      >
        <div
          data-tauri-drag-region
          className="flex min-w-0 flex-1 items-center gap-1 pr-4"
        >
          <div className="mx-1 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
            <img
              src={logo}
              alt="NTEMM"
              className="h-full w-full object-cover pointer-events-none"
              draggable={false}
            />
          </div>

          <div data-tauri-drag-region className="truncate text-md font-bold font-title">
            NTE Mod Manager
          </div>
        </div>
      </div>

      <div className="flex h-full items-center px-2">
        {/* <button
          type="button"
          aria-label={isGameBananaOpen ? "Close GameBanana" : "GameBanana"}
          title={isGameBananaOpen ? "Close GameBanana" : "GameBanana"}
          onMouseEnter={triggerGB}
          onMouseLeave={stopGB}
          onClick={onOpenGameBanana}
          className={`${iconBtn} ${
            isGameBananaOpen ? iconVariants.yellow : iconVariants.yellow
          }`}
        >
          <AppIcon
            icon={Icons.puzzle}
            className={`text-[15px] ${animateGB ? "fa-beat" : ""}`}
          />
        </button> */}

        <button
          type="button"
          aria-label={isSettingsOpen ? "Close Settings" : "Settings"}
          title={isSettingsOpen ? "Close Settings" : "Settings"}
          onMouseEnter={triggerSettings}
          onMouseLeave={stopSettings}
          onClick={onOpenSettings}
          className={`${iconBtn} ${
            isSettingsOpen ? iconVariants.red : iconVariants.blue
          }`}
        >
          <AppIcon
            icon={Icons.settings}
            className={`text-[15px] ${animateSettings ? "fa-spin" : ""}`}
          />
        </button>

        <button
          type="button"
          aria-label="Minimize"
          title="Minimize"
          onMouseEnter={triggerMin}
          onMouseLeave={stopMin}
          onClick={() => appWindow.minimize()}
          className={`${iconBtn} ${iconVariants.blue}`}
        >
          <AppIcon icon={Icons.minimize} className={`text-[15px] ${animateMin ? "fa-fade" : ""}`} />
        </button>

        <button
          type="button"
          aria-label={isMaximized ? "Restore" : "Maximize"}
          title={isMaximized ? "Restore" : "Maximize"}
          onMouseEnter={triggerMax}
          onMouseLeave={stopMax}
          onClick={toggleMaximize}
          className={`${iconBtn} ${iconVariants.blue}`}
        >
          <AppIcon
            icon={isMaximized ? Icons.restore : Icons.maximize}
            className={`text-[15px] ${animateMax ? "fa-beat" : ""}`}
          />
        </button>

        <button
          type="button"
          aria-label="Close"
          title="Close"
          onMouseEnter={triggerClose}
          onMouseLeave={stopClose}
          onClick={() => appWindow.close()}
          className={`${iconBtn} ${iconVariants.red}`}
        >
          <AppIcon icon={Icons.close} className={`text-[15px] ${animateClose ? "fa-shake" : ""}`} />
        </button>
      </div>
    </div>
  )
}