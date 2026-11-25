import { useEffect, useState } from "react"
import Header from "@/components/gamebanana/Header"
import ModGrid from "@/components/gamebanana/ModGrid"
import { formatCacheAge } from "@/utils/gamebanana"
import DetailsPanel from "@/components/gamebanana/DetailsPanel"
import { getModDetails, getNteMods } from "@/api/gamebanana"
import type { Mod, ModDetails } from "@/types/gamebanana"
import { useI18n } from "@/i18n"

export default function GameBanana() {
  const { t } = useI18n()
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
      setError(t("gamebanana.errors.loadModsFailed"))
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
      ? t("gamebanana.cache.cachedAgo", { age: formatCacheAge(cacheAgeSeconds) })
      : cached
        ? t("gamebanana.cache.loadedFromCache")
        : t("gamebanana.cache.freshData")

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
      setDetailsError(t("gamebanana.errors.loadDetailsFailed"))
    } finally {
      setIsDetailsLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-2 overflow-hidden p-6">
      <section className="relative flex min-h-0 w-full max-w-400 flex-1 flex-col rounded-xl bg-zinc-900 p-4">
        <Header
          cacheText={cacheText}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onRefresh={() => loadMods(true)}
        />

        {isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">
            {t("gamebanana.loadingMods")}
          </div>
        ) : error ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-red-400">
            {error}
          </div>
        ) : mods.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">
            {t("gamebanana.empty")}
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