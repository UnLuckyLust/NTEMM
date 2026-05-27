import { openUrl } from "@tauri-apps/plugin-opener"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { DetailsPanelProps } from "@/interfaces/gamebanana"


export default function DetailsPanel({
  mod,
  isLoading,
  error,
  onClose,
}: DetailsPanelProps) {
  async function openModPage() {
    if (!mod.pageUrl) return

    try {
      await openUrl(mod.pageUrl)
    } catch (err) {
      console.error("Failed to open GameBanana mod page:", err)
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6">
      <div className="flex max-h-full w-full max-w-220 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <div className="line-clamp-1 text-lg font-bold text-zinc-100">
              {mod.name}
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              by {mod.ownerName || "Unknown"}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={openModPage}
              className="rounded-lg bg-pink-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-pink-600"
            >
              <AppIcon icon={Icons.link} className="mr-2 text-[13px]" />
              Open
            </button>

            <button
              onClick={onClose}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Loading details...
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-red-400">
              {error}
            </div>
          ) : (
            <>
              {mod.screenshots.length > 0 ? (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {mod.screenshots.slice(0, 6).map((screenshot) => (
                    <img
                      key={screenshot}
                      src={screenshot}
                      alt={mod.name}
                      className="aspect-video w-full rounded-lg object-cover"
                      draggable={false}
                      loading="lazy"
                    />
                  ))}
                </div>
              ) : mod.previewImageUrl ? (
                <img
                  src={mod.previewImageUrl}
                  alt={mod.name}
                  className="mb-4 max-h-72 w-full rounded-lg object-cover"
                  draggable={false}
                />
              ) : null}

              {(mod.fileName || mod.downloadUrl) && (
                <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <div className="text-sm font-bold text-zinc-200">
                    Main File
                  </div>

                  {mod.fileName && (
                    <div className="mt-1 text-sm text-zinc-400">
                      {mod.fileName}
                    </div>
                  )}

                  {mod.downloadUrl && (
                    <button
                      onClick={() => openUrl(mod.downloadUrl!)}
                      className="mt-3 rounded-lg bg-pink-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-pink-600"
                    >
                      <AppIcon
                        icon={Icons.download}
                        className="mr-2 text-[13px]"
                      />
                      Download
                    </button>
                  )}
                </div>
              )}

              <div className="whitespace-pre-line text-sm leading-6 text-zinc-300">
                {mod.fullDescription || "No description available."}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}