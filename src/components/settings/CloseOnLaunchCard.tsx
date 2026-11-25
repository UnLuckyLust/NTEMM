import { useI18n } from "@/i18n"

interface CloseOnLaunchCardProps {
  closeOnLaunch: boolean
  onCloseOnLaunchChange: (value: boolean) => void
}

export function CloseOnLaunchCard({ closeOnLaunch, onCloseOnLaunchChange }: CloseOnLaunchCardProps) {
  const { t } = useI18n()

  return (
    <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400 border border-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-subtitle font-semibold">{t("settings.closeOnLaunch")}</div>
          <div className="text-sm text-zinc-500">{t("settings.closeOnLaunchDescription")}</div>
        </div>

        <div className={`flex rounded-lg bg-zinc-800 p-1 ${closeOnLaunch ? "bg-pink-700 text-white" : "bg-zinc-800"}`}>
          <button
            onClick={() => onCloseOnLaunchChange(!closeOnLaunch)}
            className={`rounded-lg px-4 py-1 text-sm font-semibold ${
              closeOnLaunch
                ? "bg-pink-700 text-white hover:bg-pink-600"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {closeOnLaunch ? t("common.on") : t("common.off")}
          </button>
        </div>
      </div>
    </section>
  )
}
