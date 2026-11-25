import { useI18n } from "@/i18n"

interface AppUpdatesCardProps {
  isCheckingUpdate: boolean
  autoCheckUpdates: boolean
  onCheckForUpdates: () => void
  onAutoCheckUpdatesChange: (enabled: boolean) => void
}

export function AppUpdatesCard({ isCheckingUpdate, autoCheckUpdates, onCheckForUpdates, onAutoCheckUpdatesChange }: AppUpdatesCardProps) {
  const { t } = useI18n()

  return (
    <section className="space-y-3 bg-zinc-900 p-4 w-full max-w-400 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-subtitle font-semibold">{t("settings.appUpdates")}</div>
          <div className="text-sm text-zinc-500">{t("settings.appUpdatesDescription")}</div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={autoCheckUpdates}
              onChange={(e) => onAutoCheckUpdatesChange(e.target.checked)}
              className="accent-pink-600"
            />

            <span>{t("settings.checkUpdatesOnStartup")}</span>
          </label>
        </div>

        <div className="flex gap-2">
          <div className="flex rounded-lg bg-zinc-800 p-1">
            <button
              onClick={() => window.dispatchEvent(new Event("showDevChangelog"))}
              className="rounded-lg px-4 text-sm font-semibold text-zinc-400 hover:bg-zinc-700"
            >
              {t("settings.showChangelog")}
            </button>
          </div>

          <button
            onClick={onCheckForUpdates}
            disabled={isCheckingUpdate}
            className="rounded-lg bg-pink-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCheckingUpdate ? t("common.checking") : t("settings.checkForUpdates")}
          </button>
        </div>
      </div>
    </section>
  )
}