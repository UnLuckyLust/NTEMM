import { convertFileSrc } from "@tauri-apps/api/core"

import { useI18n } from "@/i18n"
export function ModIconButton({
  iconPath,
  onChange,
  onClear,
}: {
  iconPath?: string | null
  onChange: () => void
  onClear?: () => void
}) {
  const { t } = useI18n()
  const src = iconPath ? `${convertFileSrc(iconPath)}?v=${Date.now()}` : null

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <button
        type="button"
        onClick={onChange}
        className="h-14 w-14 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 hover:border-zinc-500"
        title={t("mods.modCard.changeIcon")}
      >
        {src ? (
          <img src={src} className="h-full w-full object-cover" alt="" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
            ICO
          </div>
        )}
      </button>

      {iconPath && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-red-300"
        >
          {t("common.clear")}
        </button>
      )}
    </div>
  )
}