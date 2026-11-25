import AppIcon from "@/components/ui/AppIcon"
import { useI18n } from "@/i18n"
import { Icons } from "@/lib/icons"

interface GameBananaHeaderProps {
  cacheText: string
  isLoading: boolean
  isRefreshing: boolean
  onRefresh: () => void
}

export default function GameBananaHeader({
  cacheText,
  isLoading,
  isRefreshing,
  onRefresh,
}: GameBananaHeaderProps) {
  const { t } = useI18n()

  return (
  <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3">
    <div>
      <div className="text-lg font-bold text-pink-500">
        {t("gamebanana.title")}
      </div>
      <div className="text-sm text-zinc-500">
        {t("gamebanana.description")}
      </div>
    </div>

    <div className="flex items-center gap-3">
      <div className="text-xs text-zinc-500">{cacheText}</div>

      <button
        onClick={onRefresh}
        disabled={isLoading || isRefreshing}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <AppIcon
          icon={Icons.refresh}
          className={`me-2 text-[13px] ${isRefreshing ? "fa-spin" : ""}`}
        />
        {isRefreshing ? t("gamebanana.refreshing") : t("gamebanana.refresh")}
      </button>
    </div>
  </div>
  )
}
