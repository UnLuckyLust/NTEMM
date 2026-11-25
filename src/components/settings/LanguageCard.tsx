import AppIcon from "@/components/ui/AppIcon"
import { availableLanguages, useI18n } from "@/i18n"
import { Icons } from "@/lib/icons"

export function LanguageCard() {
  const { language, setLanguage, t } = useI18n()

  return (
    <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400 border border-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-subtitle font-semibold">{t("settings.language")}</div>
          <div className="text-sm text-zinc-500">{t("settings.languageDescription")}</div>
        </div>

        <div className="relative">
          <select
            title={t("settings.selectLanguage")}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="min-w-42 appearance-none rounded-lg border border-zinc-800 bg-zinc-800 py-2 ps-3 pe-8 text-sm text-zinc-300 outline-none focus:border-pink-500"
          >
            {availableLanguages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.nativeName}
              </option>
            ))}
          </select>

          <AppIcon
            icon={Icons.chevronDown}
            className="pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
          />
        </div>
      </div>
    </section>
  )
}
