import type { ModUiStatus } from "@/types/modManager"

import { useI18n } from "@/i18n"

function getStatusClassName(status: ModUiStatus) {
  if (status === "Enabled") return "bg-green-950/60 text-green-300"
  if (status === "Disabled") return "bg-zinc-800 text-zinc-400"
  if (status === "Pending Enable") return "bg-pink-950/70 text-pink-300"

  return "bg-orange-950/70 text-orange-300"
}

export function UIDCard({
  hideUidSelected,
  hideUidStatus,
  onToggleHideUid,
}: {
  hideUidSelected: boolean
  hideUidStatus: ModUiStatus
  onToggleHideUid: () => void
}) {
  const { t } = useI18n()

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-subtitle flex min-w-0 items-center overflow-hidden whitespace-nowrap text-sm font-semibold text-zinc-200">
            <span className="shrink-0">{t("mods.uiMods.title")}</span>

            {(hideUidStatus === "Pending Enable" ||
              hideUidStatus === "Pending Disable") && (
              <span
                className={`font-ui ms-2 shrink-0 rounded-full px-2 py-0.5 text-xs ${getStatusClassName(
                  hideUidStatus,
                )}`}
              >
                {t(`mods.status.${hideUidStatus}`)}
              </span>
            )}

            <span className="ms-2 min-w-0 overflow-hidden text-ellipsis text-xs text-zinc-500">
              {t("mods.byAuthor", { author: "RokkuDayo" })}
            </span>
          </div>

          <div className="truncate text-xs text-zinc-500">
            {t("mods.uiMods.description")}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-lg bg-zinc-800 p-1">
          <button
            onClick={onToggleHideUid}
            title={t("mods.uiMods.toggleUidTitle")}
            className={`rounded-lg px-4 py-1 text-sm font-semibold ${
              hideUidSelected
                ? "bg-pink-700 text-white hover:bg-pink-600"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {hideUidSelected
              ? t("mods.status.Enabled")
              : t("mods.status.Disabled")}
          </button>
        </div>
      </div>
    </section>
  )
}