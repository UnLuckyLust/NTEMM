import { useState } from "react"
import type { ImportedMod, ModUiStatus } from "@/types/modManager"
import { convertFileSrc } from "@tauri-apps/api/core"

function getStatusClassName(status: ModUiStatus) {
  if (status === "Enabled") return "bg-green-950/60 text-green-300"
  if (status === "Disabled") return "bg-zinc-800 text-zinc-400"
  if (status === "Pending Enable") return "bg-pink-950/70 text-pink-300"
  return "bg-orange-950/70 text-orange-300"
}

export function ModCard(props: {
  mod: ImportedMod
  draggable?: boolean
  onPointerDragStart?: () => void
  isDraggingThis?: boolean
  selectedMods: string[]
  toggleModSelection: (name: string) => void
  getModStatus: (name: string) => ModUiStatus
  removeImportedMod: (name: string) => void
  changePakModIcon?: (modName: string) => void
  clearPakModIconForMod?: (modName: string) => void
}) {
  const {
    mod,
    draggable = false,
    selectedMods,
    toggleModSelection,
    getModStatus,
    removeImportedMod,
    changePakModIcon,
    clearPakModIconForMod,
    onPointerDragStart,
    isDraggingThis,
  } = props

  const [expanded, setExpanded] = useState(false)

  const status = getModStatus(mod.name)
  const meta = mod.metadata
  const displayName = meta?.name || mod.name

  const hasExtraMetadata =
    Boolean(meta?.description) ||
    Boolean(meta?.modLink) ||
    Boolean(meta?.supportLink) ||
    Boolean(meta?.tags) ||
    Boolean(mod.metadataError)

  const canExpand = hasExtraMetadata
  const showDetails = expanded || !canExpand

  return (
    <div
      onPointerDown={(e) => {
        if (!draggable) return
        const target = e.target as HTMLElement
        if (target.closest("button, input, a")) return
        e.preventDefault()
        onPointerDragStart?.()
      }}
      className={`min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDraggingThis ? "border-pink-500 bg-pink-950/30 opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        {changePakModIcon && (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => changePakModIcon(mod.name)}
              onContextMenu={(e) => {
                e.preventDefault()
                clearPakModIconForMod?.(mod.name)
              }}
              className="h-14 w-14 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 hover:border-pink-500"
              title={mod.iconPath ? "Click to change icon, right-click to clear" : "Change mod icon"}
            >
              {mod.iconPath ? (
                <img
                  src={`${convertFileSrc(mod.iconPath)}?v=${Date.now()}`}
                  className="h-full w-full object-cover"
                  alt=""
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                  ICO
                </div>
              )}
            </button>
          </div>
        )}

        <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  title="toggle"
                  type="checkbox"
                  checked={selectedMods.includes(mod.name)}
                  onChange={() => toggleModSelection(mod.name)}
                />

                <div className="truncate font-semibold text-zinc-100">
                  {displayName}
                </div>

                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${getStatusClassName(status)}`}>
                  {status}
                </span>

                {meta?.version && (
                  <span className="shrink-0 text-xs text-zinc-400">
                    v{meta.version}
                  </span>
                )}

                {meta?.author && (
                  <span className="truncate text-xs text-zinc-400">
                    by {meta.author}
                  </span>
                )}
              </div>

              {meta?.tags && meta.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {meta.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-pink-500/30 bg-pink-950/30 px-2 py-0.5 text-xs text-pink-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canExpand && (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  {expanded ? "Collapse" : "Expand"}
                </button>
              )}

              <button
                onClick={() => removeImportedMod(mod.name)}
                className="rounded-lg px-2 py-1 text-xs border border-red-800 bg-red-950/40 text-red-300 hover:bg-red-900/40"
              >
                Delete
              </button>
            </div>
          </div>

          {showDetails && (
            <div className="mt-3 space-y-3">
              {meta?.description && (
                <div className="text-sm text-zinc-300">
                  {meta.description}
                </div>
              )}

              {(meta?.modLink || meta?.supportLink) && (
                <div className="flex gap-3 text-xs">
                  {meta.modLink && (
                    <a
                      href={meta.modLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-300 hover:underline"
                    >
                      Mod Page
                    </a>
                  )}

                  {meta.supportLink && (
                    <a
                      href={meta.supportLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-300 hover:underline"
                    >
                      Author Support
                    </a>
                  )}
                </div>
              )}

              <div>
                {/* <div className="mb-1 text-xs text-zinc-500">
                  {mod.files.length} files
                </div> */}

                <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto overflow-x-hidden pr-1">
                  {mod.files.map((file) => (
                    <span
                      key={file}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-300"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>

              {mod.metadataError && (
                <div className="rounded border border-orange-800 bg-orange-950/30 px-2 py-1 text-xs text-orange-300">
                  {mod.metadataError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}