import { invoke } from "@tauri-apps/api/core"
import { useEffect, useState } from "react"
import { getGameFolder } from "@/helpers/modStorage"

type AnticensorStatus = {
  installed: boolean
  loaderInstalled: boolean
  path: string
  message: string
}

export function AnticensorCard({ loaderInstalled }: { loaderInstalled: boolean }) {
  const [installed, setInstalled] = useState(false)
  const [status, setStatus] = useState("Checking...")
  const [isBusy, setIsBusy] = useState(false)

  async function refreshAnticensor() {
    const gameFolder = getGameFolder()

    if (!gameFolder) {
      setInstalled(false)
      setStatus("Game folder not configured")
      return
    }

    const result = await invoke<AnticensorStatus>("check_anticensor_mod", {
      path: gameFolder,
    })

    setInstalled(result.installed)
    setStatus(result.message)
  }

  useEffect(() => {
    void refreshAnticensor()
  }, [loaderInstalled])

  async function toggleAnticensor() {
    const gameFolder = getGameFolder()
    if (!gameFolder || isBusy || !loaderInstalled) return

    try {
      setIsBusy(true)

      const result = await invoke<AnticensorStatus>("set_anticensor_mod", {
        path: gameFolder,
        enabled: !installed,
      })

      setInstalled(result.installed)
      setStatus(result.message)
    } catch (error) {
      console.error(error)
      setStatus("Failed to update Anticensor")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-200">Anticensor <span className="mt-1 text-xs text-zinc-500">by cp0bi</span></div>
          <div className="text-xs text-zinc-500">
            Removes the fade/transparency effect on nearby characters
          </div>
        </div>

        <div className={`flex rounded-lg p-1 bg-zinc-800 ${
            installed
            ? "bg-pink-700 text-white"
            : "bg-zinc-800"
        }`}>
            <button
            onClick={toggleAnticensor}
            disabled={!loaderInstalled || isBusy}
            className={`rounded-lg px-4 py-1 text-sm font-semibold ${
                installed
                ? "bg-pink-700 text-white hover:bg-pink-600"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
            >
            {installed ? "Enabled" : "Disabled"}
            </button>
        </div>
      </div>
    </section>
  )
}