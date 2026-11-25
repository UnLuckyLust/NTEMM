import { loaderVersions } from "@lib/config"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { useI18n } from "@/i18n"
import { MAX_CUSTOM_LOADER_PROXY_NAMES, isValidLoaderProxyName } from "@/helpers/loaderProxySettings"
import { GameFolderCheck, GameVersion, LoaderProxyConfig } from "@/types/modManager"

interface LoaderDllFilesCardProps {
  gameCheck: GameFolderCheck | null
  currentLoaderProxyVersion: GameVersion | null
  loaderProxyConfig: LoaderProxyConfig
  loaderProxyError: string
  hasLoaderProxyChanges: boolean
  isApplyingLoaderProxy: boolean
  onAddCustomLoaderProxyName: (version: GameVersion) => void
  onApplyLoaderProxyConfig: () => void
  onToggleLoaderProxyName: (version: GameVersion, index: number) => void
  onUpdateCustomLoaderProxyName: (version: GameVersion, index: number, nextName: string) => void
  onRemoveCustomLoaderProxyName: (version: GameVersion, index: number) => void
}

export function LoaderDllFilesCard({
  gameCheck,
  currentLoaderProxyVersion,
  loaderProxyConfig,
  loaderProxyError,
  hasLoaderProxyChanges,
  isApplyingLoaderProxy,
  onAddCustomLoaderProxyName,
  onApplyLoaderProxyConfig,
  onToggleLoaderProxyName,
  onUpdateCustomLoaderProxyName,
  onRemoveCustomLoaderProxyName,
}: LoaderDllFilesCardProps) {
  const { t } = useI18n()

  const customCount = currentLoaderProxyVersion
    ? loaderProxyConfig[currentLoaderProxyVersion].filter((entry) => entry.custom).length
    : 0
  const maxCustomCount = currentLoaderProxyVersion
    ? MAX_CUSTOM_LOADER_PROXY_NAMES[currentLoaderProxyVersion]
    : 0

  return (
    <section className="space-y-3 rounded-xl bg-zinc-900 p-4 w-full max-w-400 border border-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-subtitle font-semibold">{t("settings.loaderDllFiles")}</div>
          <div className="text-sm text-zinc-500">
            {t("settings.loaderDllDescription", {
              version: gameCheck?.gameVersion.toUpperCase() ?? "",
            })}
            <br />
            <span className="text-xs text-zinc-500">
              {t("settings.loaderFileVersions")} -{" "}
              <a
                href={loaderVersions.ual_link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-pink-500"
              >
                DLL v{loaderVersions.ual_dll}
              </a>
              {" // "}
              <a
                href={loaderVersions.usb_link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-pink-500"
              >
                ASI v{loaderVersions.usb_asi}
              </a>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {hasLoaderProxyChanges && !loaderProxyError && (
            <div className="rounded-lg border border-yellow-700 bg-yellow-950/30 px-3 py-1.5 text-sm text-yellow-200">
              {t("settings.loaderChangesPending")}
            </div>
          )}

          {currentLoaderProxyVersion && (
            <div className="flex rounded-lg bg-zinc-800 p-1">
              <button
                onClick={() => onAddCustomLoaderProxyName(currentLoaderProxyVersion)}
                disabled={customCount >= maxCustomCount}
                className="rounded-lg bg-zinc-800 px-4 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-600 disabled:hover:bg-zinc-800"
              >
                {customCount >= maxCustomCount ? t("settings.maxCustom") : t("settings.addCustom")}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onApplyLoaderProxyConfig}
            disabled={!hasLoaderProxyChanges || Boolean(loaderProxyError) || isApplyingLoaderProxy}
            className="rounded-lg bg-pink-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplyingLoaderProxy ? t("common.applying") : t("common.applyChanges")}
          </button>
        </div>
      </div>

      {currentLoaderProxyVersion ? (
        <div className="min-h-12 overflow-x-auto overflow-y-hidden py-2">
          <div className="flex w-max min-w-full justify-start gap-2 sm:justify-center">
            {loaderProxyConfig[currentLoaderProxyVersion].map((entry, index) => {
              const invalid = !isValidLoaderProxyName(entry.name)

              return (
                <div
                  key={`${currentLoaderProxyVersion}-${index}`}
                  className={`flex h-10 w-40 shrink-0 items-center rounded-xl border gap-1 px-1 ${
                    entry.enabled ? "border-pink-700/60" : "border-zinc-800"
                  }`}
                >
                  <button
                    title={entry.enabled ? t("settings.disableProxyDll") : t("settings.enableProxyDll")}
                    type="button"
                    onClick={() => onToggleLoaderProxyName(currentLoaderProxyVersion, index)}
                    className={`grid h-6 w-6 shrink-0 place-items-center text-md transition ${
                      entry.enabled
                        ? "text-pink-700 hover:text-pink-500"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <AppIcon icon={entry.enabled ? Icons.check : Icons.close} />
                  </button>

                  {entry.custom ? (
                    <input
                      title={t("settings.customProxyDll")}
                      value={entry.name}
                      onChange={(e) =>
                        onUpdateCustomLoaderProxyName(currentLoaderProxyVersion, index, e.target.value)
                      }
                      className={`h-7 min-w-0 flex-1 rounded-lg border bg-zinc-800 px-2 text-sm outline-none ${
                        invalid
                          ? "border-red-700 text-red-200"
                          : "border-zinc-800 text-zinc-300 focus:border-zinc-700"
                      }`}
                    />
                  ) : (
                    <div className="flex h-7 min-w-0 flex-1 items-center truncate rounded-lg bg-zinc-800 px-2 text-sm text-zinc-300">
                      {entry.name}
                    </div>
                  )}

                  {entry.custom && (
                    <button
                      title={t("settings.deleteProxyDll")}
                      type="button"
                      onClick={() => onRemoveCustomLoaderProxyName(currentLoaderProxyVersion, index)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:text-red-500"
                    >
                      <AppIcon icon={Icons.delete} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-700 bg-yellow-950/30 px-3 py-2 text-sm text-yellow-200">
          {t("settings.selectValidGameFolder")}
        </div>
      )}

      {loaderProxyError && (
        <div className="rounded-lg border border-red-700 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {loaderProxyError}
        </div>
      )}
    </section>
  )
}
