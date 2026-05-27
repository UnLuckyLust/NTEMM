import { useEffect, useState } from "react"
import Titlebar from "@/components/Titlebar"
import Footer from "@/components/Footer"
import backgroundVideo from "@/assets/background.mp4"
import { AppLayoutProps } from "@/interfaces/app"

export default function AppLayout({
  children,
  onOpenSettings,
  onOpenGameBanana,
  isSettingsOpen,
  isGameBananaOpen,
}: AppLayoutProps) {
  const [backgroundMode, setBackgroundMode] = useState(
    localStorage.getItem("backgroundMode") ?? "animated",
  )

  useEffect(() => {
    function syncBackgroundMode() {
      setBackgroundMode(localStorage.getItem("backgroundMode") ?? "animated")
    }

    window.addEventListener("backgroundModeChanged", syncBackgroundMode)
    return () =>
      window.removeEventListener("backgroundModeChanged", syncBackgroundMode)
  }, [])

  return (
    <div className="app-layout flex h-screen flex-col overflow-hidden bg-zinc-950 text-white">
      {backgroundMode === "animated" ? (
        <video
          className="app-background-video"
          src={backgroundVideo}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : backgroundMode === "static" ? (
        <div className="app-background" />
      ) : null}

      <div className="app-background-overlay" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Titlebar
          onOpenSettings={onOpenSettings}
          onOpenGameBanana={onOpenGameBanana}
          isSettingsOpen={isSettingsOpen}
          isGameBananaOpen={isGameBananaOpen}
        />

        <div className="flex min-h-0 flex-1">
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>

        <Footer />
      </div>
    </div>
  )
}