import { useI18n } from "@/i18n"

type BackgroundMode = "none" | "static" | "animated"

interface AppBackgroundCardProps {
  backgroundMode: string
  onBackgroundModeChange: (mode: BackgroundMode) => void
}

export function AppBackgroundCard({ backgroundMode, onBackgroundModeChange }: AppBackgroundCardProps) {
  const { t } = useI18n()

  return (
    <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400 border border-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-subtitle font-semibold">{t("settings.appBackground")}</div>
          <div className="text-sm text-zinc-500">{t("settings.appBackgroundDescription")}</div>
        </div>

        <div className="flex rounded-lg bg-zinc-800 p-1">
          {(["none", "static", "animated"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onBackgroundModeChange(mode)}
              className={`rounded-md px-4 py-1 text-sm font-semibold capitalize ${
                backgroundMode === mode
                  ? "bg-pink-700 text-white"
                  : "text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {t(`settings.background.${mode}`)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
