import AppIcon from "@/components/ui/AppIcon"
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
  return (
  <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3">
    <div>
      <div className="text-lg font-bold text-pink-500">
        GameBanana Mods
      </div>
      <div className="text-sm text-zinc-500">
        Browse Neverness to Everness mods from GameBanana
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
          className={`mr-2 text-[13px] ${isRefreshing ? "fa-spin" : ""}`}
        />
        {isRefreshing ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  </div>
  )
}