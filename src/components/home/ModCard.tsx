import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ImportedMod, ModUiStatus } from "@/types/modManager"
import { convertFileSrc } from "@tauri-apps/api/core"
import AppIcon from "../ui/AppIcon"
import { Icons } from "@/lib/icons"
import { useI18n } from "@/i18n"

function getStatusClassName(status: ModUiStatus) {
  if (status === "Enabled") return "bg-green-950/60 text-green-300"
  if (status === "Disabled") return "bg-zinc-800 text-zinc-400"
  if (status === "Pending Enable") return "bg-pink-950/70 text-pink-300"
  return "bg-orange-950/70 text-orange-300"
}

const getFilesListClassName = (expanded: boolean) =>
  [
    "flex flex-wrap gap-1 overflow-y-auto overflow-x-hidden pe-1",
    expanded ? "max-h-19" : "max-h-6",
  ].join(" ")

export function ModCard(props: {
  mod: ImportedMod
  draggable?: boolean
  onPointerDragStart?: () => void
  onPointerDragEnter?: () => void
  onPointerDragEnd?: () => void
  isDraggingThis?: boolean
  selectedMods: string[]
  toggleModSelection: (name: string) => void
  getModStatus: (name: string) => ModUiStatus
  removeImportedMod: (name: string) => void
  renameImportedMod?: (oldName: string, newName: string) => Promise<string | null>
  getModRenameError?: (oldName: string, newName: string) => string
  changePakModIcon?: (modName: string) => void
  clearPakModIconForMod?: (modName: string) => void
}) {
  const { t } = useI18n()

  const {
    mod,
    draggable = false,
    selectedMods,
    toggleModSelection,
    getModStatus,
    removeImportedMod,
    renameImportedMod,
    getModRenameError,
    changePakModIcon,
    clearPakModIconForMod,
    onPointerDragStart,
    onPointerDragEnter,
    onPointerDragEnd,
    isDraggingThis,
  } = props

  const [expanded, setExpanded] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(mod.name)
  const [renameError, setRenameError] = useState("")
  const [openPreviewIndex, setOpenPreviewIndex] = useState<number | null>(null)
  const filesListRef = useRef<HTMLDivElement | null>(null)
  const [filesListOverflows, setFilesListOverflows] = useState(false)

  const status = getModStatus(mod.name)
  const meta = mod.metadata
  const displayName = meta?.name || mod.name
  const previewImages = mod.previewImagePaths ?? []

  const hasTags = Boolean(meta?.tags && meta.tags.length > 0)
  const hasLinks = Boolean(meta?.modLink || meta?.supportLink)
  const hasDescription = Boolean(meta?.description)
  const hasPreviewImages = previewImages.length > 0

  const topSummaryType: "tags" | "links" | "description" | "files" =
    hasTags ? "tags" : hasLinks ? "links" : hasDescription ? "description" : "files"

  const canExpand =
    hasPreviewImages ||
    filesListOverflows ||
    Boolean(mod.metadataError) ||
    (topSummaryType !== "tags" && hasTags) ||
    (topSummaryType !== "links" && hasLinks) ||
    (topSummaryType !== "description" && hasDescription) ||
    topSummaryType !== "files"

  const openPreviewPath =
    openPreviewIndex === null ? null : previewImages[openPreviewIndex]

  const openPreview = (index: number) => {
    setOpenPreviewIndex(index)
  }

  const closePreview = () => {
    setOpenPreviewIndex(null)
  }

  const showPrevPreview = () => {
    if (!hasPreviewImages) return
    setOpenPreviewIndex((index) =>
      index === null ? 0 : (index - 1 + previewImages.length) % previewImages.length
    )
  }

  const showNextPreview = () => {
    if (!hasPreviewImages) return
    setOpenPreviewIndex((index) =>
      index === null ? 0 : (index + 1) % previewImages.length
    )
  }

  useEffect(() => {
    setRenameValue(mod.name)
    setRenameError("")
    setIsRenaming(false)
  }, [mod.name])

  const cancelRename = () => {
    setRenameValue(mod.name)
    setRenameError("")
    setIsRenaming(false)
  }

  const commitRename = async () => {
    if (!isRenaming) return

    const nextName = renameValue.trim()

    if (nextName === mod.name) {
      cancelRename()
      return
    }

    const error = getModRenameError?.(mod.name, nextName) ?? ""

    if (error) {
      setRenameError(error)
      return
    }

    const renamedName = await renameImportedMod?.(mod.name, nextName)

    if (!renamedName) {
      setRenameValue(mod.name)
      return
    }

    setRenameValue(renamedName)
    setRenameError("")
    setIsRenaming(false)
  }

  useLayoutEffect(() => {
    const element = filesListRef.current
    if (!element) {
      setFilesListOverflows(false)
      return
    }

    const checkOverflow = () => {
      const previousMaxHeight = element.style.maxHeight

      element.style.maxHeight = "1.5rem"
      const overflowsCollapsed = element.scrollHeight > element.clientHeight + 1

      element.style.maxHeight = previousMaxHeight

      setFilesListOverflows(overflowsCollapsed)
    }

    checkOverflow()

    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [mod.files, topSummaryType])

  return (
    <div
      onPointerDown={(e) => {
        if (!draggable) return
        const target = e.target as HTMLElement
        if (target.closest("button, input, a")) return
        if (target.classList.contains('notDraggable')) return
        e.preventDefault()
        onPointerDragStart?.()
      }}
      onPointerEnter={() => {
        if (!draggable) return
        onPointerDragEnter?.()
      }}
      onPointerUp={() => {
        if (!draggable) return
        onPointerDragEnd?.()
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
              title={mod.iconPath ? t("mods.modCard.changeIconOrClear") : t("mods.modCard.changeIcon")}
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

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2 mt-px">
                <div className="flex gap-2 items-center notDraggable cursor-pointer"
                onClick={() => toggleModSelection(mod.name)}>
                  <input
                    title={t("mods.modCard.toggle")}
                    type="checkbox"
                    checked={selectedMods.includes(mod.name)}
                    onChange={(e) => e.preventDefault}
                  />

                    {isRenaming ? (
                      <div
                        className="font-subtitle notDraggable flex min-w-0 flex-col"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          title={t("mods.modCard.renameMod")}
                          value={renameValue}
                          onChange={(e) => {
                            setRenameValue(e.target.value)
                            setRenameError(getModRenameError?.(mod.name, e.target.value) ?? "")
                          }}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur()
                            }

                            if (e.key === "Escape") {
                              cancelRename()
                            }
                          }}
                          className="min-w-40 rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-sm font-semibold text-zinc-100 outline-none focus:border-pink-500"
                        />

                        {renameError && (
                          <div className="mt-1 text-xs text-red-400">
                            {renameError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="font-subtitle truncate font-semibold text-zinc-100 notDraggable">
                        {displayName}
                      </div>
                    )}
                </div>

                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${getStatusClassName(status)}`}>
                  {t(`mods.status.${status}`)}
                </span>

                {meta?.version && (
                  <span className="shrink-0 text-xs text-zinc-400">
                    v{meta.version}
                  </span>
                )}

                {meta?.author && (
                  <span className="truncate text-xs text-zinc-400">
                    {t("mods.byAuthor", { author: meta.author })}
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-2">
                {topSummaryType === "tags" && meta?.tags && meta.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
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

                {topSummaryType === "links" && hasLinks && (
                  <div className="flex gap-3 text-xs notDraggable">
                    {meta?.modLink && (
                      <a
                        href={meta.modLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pink-300 hover:underline"
                      >
                        {t("mods.modCard.modPage")}
                      </a>
                    )}

                    {meta?.supportLink && (
                      <a
                        href={meta.supportLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pink-300 hover:underline"
                      >
                        {t("mods.modCard.authorSupport")}
                      </a>
                    )}
                  </div>
                )}

                {topSummaryType === "description" && meta?.description && (
                  <div className="text-sm text-zinc-300">
                    {meta.description}
                  </div>
                )}

                {topSummaryType === "files" && (
                  <div ref={filesListRef} className={getFilesListClassName(expanded)}>
                    {mod.files.map((file) => (
                      <span
                        key={file}
                        title={file}
                        className="max-w-full truncate rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-300"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center">
              {hasPreviewImages && (
                <button
                  type="button"
                  onClick={() => openPreview(0)}
                  className="rounded-lg text-sm p-1 text-zinc-500 hover:text-zinc-100"
                  title={t("mods.modCard.showPreviewImages")}
                >
                  <AppIcon icon={Icons.images} />
                </button>
              )}

              {canExpand && (
                <button
                  title={t("mods.expandCollapse")}
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="rounded-lg text-sm p-1 text-zinc-500 hover:text-zinc-100"
                >
                  <AppIcon icon={expanded ? Icons.expand : Icons.collapse} />
                </button>
              )}

              {renameImportedMod && (
                <button
                  type="button"
                  title={t("mods.modCard.renameMod")}
                  onClick={() => {
                    setRenameValue(mod.name)
                    setRenameError("")
                    setIsRenaming(true)
                  }}
                  className="rounded-lg text-sm p-1 text-zinc-500 hover:text-zinc-100"
                >
                  <AppIcon icon={Icons.edit} />
                </button>
              )}

              <button
                type="button"
                title={t("mods.modCard.deleteMod")}
                onClick={() => removeImportedMod(mod.name)}
                className="rounded-lg text-sm p-1 text-red-800 hover:text-red-500"
              >
                <AppIcon icon={Icons.delete} />
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-2 min-w-0 space-y-2 overflow-hidden">
              {topSummaryType !== "description" && meta?.description && (
                <div className="text-sm text-zinc-300">
                  {meta.description}
                </div>
              )}

              {topSummaryType !== "links" && hasLinks && (
                <div className="flex gap-3 text-xs notDraggable">
                  {meta?.modLink && (
                    <a
                      href={meta.modLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-300 hover:underline"
                    >
                      {t("mods.modCard.modPage")}
                    </a>
                  )}

                  {meta?.supportLink && (
                    <a
                      href={meta.supportLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-300 hover:underline"
                    >
                      {t("mods.modCard.authorSupport")}
                    </a>
                  )}
                </div>
              )}

              {topSummaryType !== "files" && (
                <div className={getFilesListClassName(true)}>
                  {mod.files.map((file) => (
                    <span
                      key={file}
                      title={file}
                      className="max-w-full truncate rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-300"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              )}

              {previewImages.length > 0 && (
                <div className="notDraggable flex max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-1">
                  {previewImages.map((imagePath, index) => (
                    <button
                      key={imagePath}
                      type="button"
                      onClick={() => openPreview(index)}
                      className="h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 hover:border-pink-500"
                      title={t("mods.modCard.openPreview")}
                    >
                      <img
                        src={convertFileSrc(imagePath)}
                        className="h-full w-full object-cover"
                        alt={t("mods.modCard.modPreviewAlt")}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}

              {mod.metadataError && (
                <div className="rounded border border-orange-800 bg-orange-950/30 px-2 py-1 text-xs text-orange-300">
                  {mod.metadataError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {openPreviewPath && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 notDraggable cursor-default"
          onClick={closePreview}
        >
          <div
            className="flex max-h-[70vh] max-w-[70vw] flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.stopPropagation()
              if (previewImages.length <= 1) return

              if (e.deltaY > 0) {
                showNextPreview()
              } else if (e.deltaY < 0) {
                showPrevPreview()
              }
            }}
          >
            <img
              src={convertFileSrc(openPreviewPath)}
              className="notDraggable max-h-[70vh] max-w-[70vw] rounded-xl border border-zinc-800 object-contain"
              alt={t("mods.modCard.modPreviewAlt")}
            />

            <div className="flex gap-2 absolute bottom-60 left-1/2 -translate-x-1/2">
              <button
                type="button"
                className="notDraggable rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800"
                onClick={(e) => {
                  e.stopPropagation()
                  closePreview()
                }}
              >
                {t("common.close")}
              </button>

              <button
                type="button"
                className="notDraggable text-lg text-zinc-200 hover:text-pink-500"
                onClick={(e) => {
                  e.stopPropagation()
                  showPrevPreview()
                }}
                title={t("mods.modCard.previousPreview")}
              >
                <AppIcon icon={"caret-left"}/>
              </button>

              {previewImages.length > 1 && openPreviewIndex !== null && (
                <div className="notDraggable rounded-lg border border-zinc-700 bg-zinc-950/90 px-3 py-1.5 text-xs text-zinc-300">
                  <span className="text-pink-500">{openPreviewIndex + 1}</span> / {previewImages.length}
                </div>
              )}

              <button
                type="button"
                className="notDraggable text-lg text-zinc-200 hover:text-pink-500"
                onClick={(e) => {
                  e.stopPropagation()
                  showNextPreview()
                }}
                title={t("mods.modCard.nextPreview")}
              >
                <AppIcon icon={"caret-right"}/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}