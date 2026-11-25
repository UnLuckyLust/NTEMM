import { invoke } from "@tauri-apps/api/core"
import { useEffect, useState } from "react"
import type { EngineIniCheck } from "@/types/engineIni"
import { HudScaleCardProps } from "@/interfaces/app"

import { useI18n } from "@/i18n"
export function HudScaleCard({ gamePath }: HudScaleCardProps) {
  const { t } = useI18n()
  const [engineIniPath, setEngineIniPath] = useState("")
  const [engineIniCheck, setEngineIniCheck] = useState<EngineIniCheck | null>(null)
  const [uiScale, setUiScale] = useState(1.0)
  const [hasLoadedEngineIni, setHasLoadedEngineIni] = useState(false)

  useEffect(() => {
    refreshEngineIni()
  }, [gamePath])

  useEffect(() => {
    if (!hasLoadedEngineIni || !engineIniCheck?.valid || !gamePath.trim()) return

    const timeout = window.setTimeout(() => {
      applyUiScale(uiScale)
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [uiScale, hasLoadedEngineIni, engineIniCheck?.valid, gamePath])

  async function refreshEngineIni() {
    setHasLoadedEngineIni(false)

    if (!gamePath.trim()) {
      setEngineIniPath("")
      setEngineIniCheck({
        valid: false,
        path: "",
        applicationScale: null,
        messageKey: "mods.hudScale.gameFolderNotDetected",
      })
      setHasLoadedEngineIni(true)
      return
    }

    try {
      const result = await invoke<EngineIniCheck>("detect_engine_ini_for_game", {
        gamePath,
      })

      setEngineIniPath(result.path)
      setEngineIniCheck(result)

      if (result.valid && typeof result.applicationScale === "number") {
        setUiScale(result.applicationScale)
      }

      setHasLoadedEngineIni(true)
    } catch (error) {
      console.error(error)

      setEngineIniPath("")
      setEngineIniCheck({
        valid: false,
        path: "",
        applicationScale: null,
        messageKey: "mods.hudScale.detectFailed",
      })

      setHasLoadedEngineIni(true)
    }
  }

  async function applyUiScale(scale: number) {
    if (!engineIniCheck?.valid || !gamePath.trim()) return

    try {
      const result = await invoke<EngineIniCheck>("set_ui_scale", {
        gamePath,
        scale,
      })

      setEngineIniPath(result.path)
      setEngineIniCheck(result)
    } catch (error) {
      console.error(error)

      setEngineIniCheck((current) => ({
        valid: false,
        path: current?.path ?? engineIniPath,
        applicationScale: current?.applicationScale ?? null,
        messageKey: "mods.hudScale.saveFailed",
      }))
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="font-subtitle text-sm font-semibold text-zinc-200">{t("mods.hudScale.title")}</div>
          <div className="text-xs text-zinc-500">
            {t("mods.hudScale.description")}
          </div>
        </div>

        <div
          className={`rounded-lg border px-3 py-2 text-xs font-semibold min-w-max ${
            engineIniCheck?.valid
              ? "border-green-700 bg-green-950/40 text-green-200"
              : "border-red-700 bg-red-950/40 text-red-200"
          }`}
        >
          {engineIniCheck?.messageKey
            ? t(engineIniCheck.messageKey)
            : t("mods.hudScale.checkingEngineIni")}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <input
          title={t("mods.hudScale.uiScaleTitle")}
          type="range"
          min="0.25"
          max="1.5"
          step="0.05"
          value={uiScale}
          disabled={!engineIniCheck?.valid}
          onChange={(e) => setUiScale(Number(e.target.value))}
          className="flex-1 accent-pink-600 disabled:opacity-40"
        />

        <div className="w-16 text-end text-sm font-semibold text-zinc-300">
          {uiScale.toFixed(2)}
        </div>
      </div>
    </section>
  )
}