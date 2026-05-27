import { openUrl } from "@tauri-apps/plugin-opener"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { ModCardProps } from "@/interfaces/gamebanana"


export default function GameBananaModCard({ mod, onOpenDetails }: ModCardProps) {
  async function openModPage() {
    if (!mod.pageUrl) return

    try {
      await openUrl(mod.pageUrl)
    } catch (err) {
      console.error("Failed to open GameBanana mod page:", err)
    }
  }

  return (
    <article onClick={() => onOpenDetails(mod)}
    className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 transition hover:border-pink-700/60 hover:bg-zinc-950">
      <div className="aspect-2/1 w-full overflow-hidden bg-zinc-900">
        {mod.previewImageUrl ? (
          <img
            src={mod.previewImageUrl}
            alt={mod.name}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600">
            <AppIcon icon={Icons.puzzle} className="text-3xl" />
          </div>
        )}
      </div>

      <div className="flex min-h-24 flex-col p-2.5">
        <div className="line-clamp-1 text-sm font-bold text-zinc-200">
          {mod.name}
        </div>

        <div className="mt-0.5 truncate text-xs text-zinc-500">
          by {mod.ownerName || "Unknown"}
        </div>

        {mod.description && (
          <div className="mt-2 line-clamp-2 text-xs text-zinc-400">
            {mod.description}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex min-w-0 items-center gap-3 text-xs text-zinc-500">
            <span title="Likes">
              <AppIcon icon={Icons.heart} className="mr-1 text-[12px]" />
              {mod.likes}
            </span>

            <span title="Downloads">
              <AppIcon icon={Icons.download} className="mr-1 text-[12px]" />
              {mod.downloads}
            </span>
          </div>

          <button
            title="Open in GameBanana"
            onClick={(event) => {
              event.stopPropagation()
              openModPage()
            }}
            className="shrink-0 rounded-lg bg-pink-700 px-2 py-1 text-xs font-semibold text-white hover:bg-pink-600"
          >
            <AppIcon icon={Icons.link} />
          </button>
        </div>
      </div>
    </article>
  )
}