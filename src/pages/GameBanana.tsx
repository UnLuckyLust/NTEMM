import { useEffect, useState } from "react"
import AppIcon from "@/components/ui/AppIcon"
import Header from "@/components/gamebanana/Header"
import ModGrid from "@/components/gamebanana/ModGrid"
import { Icons } from "@/lib/icons"
import { GameBananaProps } from "@/interfaces/app"
import { formatCacheAge } from "@/utils/gamebanana"
import DetailsPanel from "@/components/gamebanana/DetailsPanel"
import { getModDetails, getNteMods } from "@/api/gamebanana"
import type { Mod, ModDetails } from "@/types/gamebanana"

export default function GameBanana({ onBackHome }: GameBananaProps) {
  const [mods, setMods] = useState<Mod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [cached, setCached] = useState(false)
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState(0)

  const [selectedMod, setSelectedMod] = useState<ModDetails | null>(null)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState("")

  async function loadMods(forceRefresh = false) {
    try {
      setError("")

      if (forceRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      const result = await getNteMods(forceRefresh)

      setMods(result.mods)
      setCached(result.cached)
      setCacheAgeSeconds(result.cacheAgeSeconds)
    } catch (err) {
      console.error(err)
      setError("Failed to load GameBanana mods.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadMods(false)
  }, [])

  const cacheText =
    cached && cacheAgeSeconds > 0
      ? `Cached ${formatCacheAge(cacheAgeSeconds)} ago`
      : cached
        ? "Loaded from cache"
        : "Fresh data"

  async function openModDetails(mod: Mod) {
    try {
      setDetailsError("")
      setIsDetailsLoading(true)
      setSelectedMod({
        ...mod,
        fullDescription: "",
        screenshots: [],
        fileName: "",
        fileSize: 0,
        downloadUrl: null,
      })

      const details = await getModDetails(mod.id)
      setSelectedMod(details)
    } catch (err) {
      console.error(err)
      setDetailsError("Failed to load mod details.")
    } finally {
      setIsDetailsLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-2 overflow-hidden p-6">
      <div className="w-full max-w-400">
        <section className="w-max rounded-xl bg-zinc-900 p-1">
          <button
            onClick={onBackHome}
            className="rounded-lg p-2 text-sm font-semibold text-zinc-400 hover:bg-zinc-700"
          >
            <AppIcon icon={Icons.anglesLeft} className="mr-2 text-[15px]" />
            Back to Home
          </button>
        </section>
      </div>

      <section className="relative flex min-h-0 w-full max-w-400 flex-1 flex-col rounded-xl bg-zinc-900 p-4">
        <Header
          cacheText={cacheText}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onRefresh={() => loadMods(true)}
        />

        {isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">
            Loading GameBanana mods...
          </div>
        ) : error ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-red-400">
            {error}
          </div>
        ) : mods.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">
            No GameBanana mods found for NTE yet.
          </div>
        ) : (
          <ModGrid mods={mods} onOpenDetails={openModDetails} />
        )}

        {selectedMod && (
          <DetailsPanel
            mod={selectedMod}
            isLoading={isDetailsLoading}
            error={detailsError}
            onClose={() => setSelectedMod(null)}
          />
        )}

      </section>
    </div>
  )
}