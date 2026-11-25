import type { ModUiStatus } from "@/types/modManager"

import { useI18n } from "@/i18n"
function getStatusClassName(status: ModUiStatus) {
  if (status === "Enabled") return "bg-green-950/60 text-green-300"
  if (status === "Disabled") return "bg-zinc-800 text-zinc-400"
  if (status === "Pending Enable") return "bg-pink-950/70 text-pink-300"
  return "bg-orange-950/70 text-orange-300"
}

export function AnticensorCard({
  selected,
  status,
  onToggle,
}: {
  selected: boolean
  status: ModUiStatus
  onToggle: () => void
}) {
  const { t } = useI18n()

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-subtitle text-sm font-semibold text-zinc-200">
            {t("mods.anticensor.title")}
            
            {(status === "Pending Enable" || status === "Pending Disable") && (
              <span className={`font-ui ms-2 rounded-full px-2 py-0.5 text-xs ${getStatusClassName(status)}`}>
                {t(`mods.status.${status}`)}
              </span>
            )}

            <span className="ms-2 text-xs text-zinc-500">{t("mods.byAuthor", { author: "cp0bi" })}</span>
          </div>
          <div className="text-xs text-zinc-500">
            {t("mods.anticensor.description")}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-zinc-800 p-1">
          <button
            onClick={onToggle}
            className={`rounded-lg px-4 py-1 text-sm font-semibold ${
              selected
                ? "bg-pink-700 text-white hover:bg-pink-600"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {selected ? t("mods.status.Enabled") : t("mods.status.Disabled")}
          </button>
        </div>
      </div>
    </section>
  )
}