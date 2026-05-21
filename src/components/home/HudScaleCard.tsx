import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { useEffect, useState } from "react"
import type { EngineIniCheck } from "@/types/engineIni"

export function HudScaleCard() {
  const [engineIniPath, setEngineIniPath] = useState("")
  const [engineIniCheck, setEngineIniCheck] = useState<EngineIniCheck | null>(null)
  const [uiScale, setUiScale] = useState(1.0)
  // const [uiScaleStatus, setUiScaleStatus] = useState("")
  const [hasLoadedEngineIni, setHasLoadedEngineIni] = useState(false)

    useEffect(() => {
        const savedEngineIniPath = localStorage.getItem("engineIniPath")

        async function loadEngineIni() {
        const result = savedEngineIniPath
            ? await invoke<EngineIniCheck>("check_engine_ini", {
                path: savedEngineIniPath,
            })
            : await invoke<EngineIniCheck>("auto_detect_engine_ini")

        setEngineIniPath(result.path)
        setEngineIniCheck(result)

        if (result.valid) {
            localStorage.setItem("engineIniPath", result.path)

            if (typeof result.applicationScale === "number") {
            setUiScale(result.applicationScale)
            }
        }

        setHasLoadedEngineIni(true)
        }

        loadEngineIni().catch((error) => {
        console.error(error)

        setEngineIniCheck({
            valid: false,
            path: savedEngineIniPath ?? "",
            applicationScale: null,
            message: "Failed to check Engine.ini",
        })

        setHasLoadedEngineIni(true)
        })
    }, [])

    useEffect(() => {
        if (!hasLoadedEngineIni || !engineIniCheck?.valid) return

        const timeout = window.setTimeout(() => {
        applyUiScale(uiScale)
        }, 400)

        return () => window.clearTimeout(timeout)
    }, [uiScale, hasLoadedEngineIni, engineIniCheck?.valid])

    async function browseEngineIni() {
        const selected = await open({
            directory: false,
            multiple: false,
            title: "Select Engine.ini",
            filters: [{ name: "Engine.ini", extensions: ["ini"] }],
        })

        if (typeof selected !== "string") return

        if (!selected.toLowerCase().endsWith("\\engine.ini")) {
            setEngineIniPath(selected)
            setEngineIniCheck({
            valid: false,
            path: selected,
            applicationScale: null,
            message: "Invalid file. Select the game's Engine.ini file only.",
            })
            return
        }

        setEngineIniPath(selected)

        const result = await invoke<EngineIniCheck>("check_engine_ini", {
            path: selected,
        })

        setEngineIniCheck(result)

        if (result.valid) {
        localStorage.setItem("engineIniPath", result.path)

        if (typeof result.applicationScale === "number") {
            setUiScale(result.applicationScale)
        }
        }
    }

    async function checkTypedEngineIniPath() {
        if (!engineIniPath.trim()) return

        const result = await invoke<EngineIniCheck>("check_engine_ini", {
        path: engineIniPath.trim(),
        })

        setEngineIniCheck(result)

        if (result.valid) {
        localStorage.setItem("engineIniPath", result.path)

        if (typeof result.applicationScale === "number") {
            setUiScale(result.applicationScale)
        }
        }
    }

    async function resetSavedEngineIni() {
    localStorage.removeItem("engineIniPath")
    // setUiScaleStatus("Checking Engine.ini...")

    try {
        const result = await invoke<EngineIniCheck>("auto_detect_engine_ini")

        setEngineIniPath(result.path)
        setEngineIniCheck(result)

        if (result.valid) {
        localStorage.setItem("engineIniPath", result.path)

        if (typeof result.applicationScale === "number") {
            setUiScale(result.applicationScale)
        }

        // setUiScaleStatus("Engine.ini auto-detected")
        } 
        // else {
        // setUiScaleStatus("Engine.ini was not auto-detected")
        // }
    } catch (error) {
        console.error(error)

        setEngineIniPath("")
        setEngineIniCheck({
        valid: false,
        path: "",
        applicationScale: null,
        message: "Failed to auto-detect Engine.ini",
        })
        // setUiScaleStatus("Failed to auto-detect Engine.ini")
    }
    }

  async function applyUiScale(scale: number) {
    if (!engineIniCheck?.valid || !engineIniPath.trim()) return

    try {
      // setUiScaleStatus("Saving HUD scale...")

      const result = await invoke<EngineIniCheck>("set_ui_scale", {
        path: engineIniPath.trim(),
        scale,
      })

      setEngineIniCheck(result)
      localStorage.setItem("engineIniPath", result.path)
      // setUiScaleStatus("HUD scale saved")
    } catch (error) {
      console.error(error)
      // setUiScaleStatus("Failed to save HUD scale")
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-200">HUD Scale</div>
          <div className="text-xs text-zinc-500">
            Edit Engine.ini to control the in-game UI scale
          </div>
        </div>

        <div
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            engineIniCheck?.valid
              ? "border-green-700 bg-green-950/40 text-green-200"
              : "border-red-700 bg-red-950/40 text-red-200"
          }`}
        >
          {engineIniCheck?.message ?? "Checking Engine.ini..."}
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={engineIniPath}
          onChange={(e) => setEngineIniPath(e.target.value)}
          onBlur={checkTypedEngineIniPath}
          className={`min-w-0 flex-1 rounded-lg border bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-pink-500 ${
            engineIniCheck?.valid === false
              ? "border-red-700 text-red-300"
              : "border-zinc-800 text-zinc-500"
          }`}
          placeholder="Select Engine.ini"
        />

          <div className="flex rounded-lg bg-zinc-800 p-1">
            <button
              onClick={browseEngineIni}
              className="rounded-lg px-4 text-sm font-semibold g-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              Browse
            </button>
          </div>


          <div className="flex rounded-lg bg-zinc-800 p-1">
            <button
              onClick={resetSavedEngineIni}
              className="rounded-lg px-4 text-sm font-semibold g-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              Reset
            </button>
          </div>
      </div>

      <div className="flex items-center gap-4">
        <input
          title="UI Scale"
          type="range"
          min="0.25"
          max="1.5"
          step="0.05"
          value={uiScale}
          disabled={!engineIniCheck?.valid}
          onChange={(e) => setUiScale(Number(e.target.value))}
          className="flex-1 accent-pink-600 disabled:opacity-40"
        />

        <div className="w-16 text-right text-sm font-semibold text-zinc-300">
          {uiScale.toFixed(2)}
        </div>
      </div>
    </section>
  )
}