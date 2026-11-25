import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { useI18n } from "@/i18n"
import { GameFolderCheck, GameVersion, LoaderFilesCheck, SavedGameInstalls } from "@/types/modManager"

interface SavedInstallEntry {
  version: GameVersion
  path: string
}

interface GameFolderCardProps {
  gamePath: string
  gameCheck: GameFolderCheck | null
  loaderCheck: LoaderFilesCheck | null
  savedGameInstalls: SavedGameInstalls
  savedInstallEntries: SavedInstallEntry[]
  selectedSavedVersion: GameVersion | ""
  savedSelectOpen: boolean
  gameVersionLabels: Record<GameVersion, string>
  isDetectingGameFolders: boolean
  onGamePathChange: (path: string) => void
  onCheckTypedPath: () => void
  onBrowseFolder: () => void
  onAutoDetectGameFolders: () => void
  onResetSavedGameFolder: () => void
  onSelectSavedInstall: (version: GameVersion) => void
  onRemoveSelectedSavedInstall: () => void
  onSavedSelectOpenChange: (open: boolean | ((open: boolean) => boolean)) => void
}

export function GameFolderCard({
  gamePath,
  gameCheck,
  loaderCheck,
  savedGameInstalls,
  savedInstallEntries,
  selectedSavedVersion,
  savedSelectOpen,
  gameVersionLabels,
  isDetectingGameFolders,
  onAutoDetectGameFolders,
  onGamePathChange,
  onCheckTypedPath,
  onBrowseFolder,
  onResetSavedGameFolder,
  onSelectSavedInstall,
  onRemoveSelectedSavedInstall,
  onSavedSelectOpenChange,
}: GameFolderCardProps) {
  const { t } = useI18n()

  return (
    <section className="space-y-3 bg-zinc-900 p-4 w-full max-w-400 border border-zinc-800 rounded-xl">
      <label className="font-subtitle font-semibold" htmlFor="game-folder">
        {t("settings.gameFolder")}
      </label>

      <div className="flex gap-2 mt-1">
        <input
          id="game-folder"
          value={gamePath}
          onChange={(e) => onGamePathChange(e.target.value)}
          onBlur={onCheckTypedPath}
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-800 px-3 py-2 text-sm text-zinc-500 outline-none focus:border-pink-500"
          placeholder={t("settings.gameFolderPlaceholder")}
        />

<div className="flex rounded-lg bg-zinc-800 p-1">
  <button
    onClick={onBrowseFolder}
    disabled={isDetectingGameFolders}
    className="rounded-lg px-4 text-sm font-semibold text-zinc-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {t("common.browse")}
  </button>

  <button
    onClick={onAutoDetectGameFolders}
    disabled={isDetectingGameFolders}
    className="rounded-lg border-s border-zinc-700 px-4 text-sm font-semibold text-zinc-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {isDetectingGameFolders
      ? t("settings.detectingGameFolders")
      : t("settings.autoDetectGameFolders")}
  </button>
</div>

        {savedInstallEntries.length > 1 && (
          <div className="flex gap-2 border border-pink-700/60 rounded-lg p-1">
            <div className="relative">
              <select
                title={t("settings.selectSavedGamePath")}
                value={selectedSavedVersion}
                onMouseDown={() => onSavedSelectOpenChange((open) => !open)}
                onFocus={() => onSavedSelectOpenChange(true)}
                onBlur={() => onSavedSelectOpenChange(false)}
                onChange={(e) => {
                  onSelectSavedInstall(e.target.value as GameVersion)
                  onSavedSelectOpenChange(false)
                }}
                className="w-13 appearance-none rounded-lg bg-zinc-800 py-1 pe-4 text-center text-sm text-zinc-400 outline-none"
              >
                {savedInstallEntries.map(({ version }) => (
                  <option key={version} value={version}>
                    {gameVersionLabels[version]}
                  </option>
                ))}
              </select>

              <AppIcon
                icon={savedSelectOpen ? Icons.chevronUp : Icons.chevronDown}
                className="pointer-events-none absolute inset-e-1.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
              />
            </div>

            <button
              type="button"
              title={t("settings.removeSavedGamePath")}
              onClick={onRemoveSelectedSavedInstall}
              disabled={!selectedSavedVersion || !savedGameInstalls[selectedSavedVersion]}
              className="rounded-lg text-md text-zinc-500 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AppIcon icon={Icons.delete} />
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onResetSavedGameFolder}
          className="rounded-lg border border-pink-800 bg-pink-950/40 px-3 py-2 text-sm text-pink-300 hover:bg-pink-900/40 min-w-max"
        >
          {t("settings.resetGameFolder")}
        </button>

        <div className="flex gap-2 w-full justify-end content-end">
          {gameCheck && (
            <div
              className={`flex items-center rounded-lg border px-3 py-2 text-sm ${
                gameCheck.valid
                  ? "border-green-700 bg-green-950/30 text-green-200"
                  : "border-red-700 bg-red-950/30 text-red-200"
              }`}
            >
              <div className="font-semibold">
                {t(gameCheck.messageKey)} {gameCheck.valid && `(${gameCheck.gameVersion.toUpperCase()})`}
              </div>
            </div>
          )}

          {loaderCheck && (
            <div
              className={`flex flex-col justify-center rounded-lg border px-3 py-2 text-sm ${
                loaderCheck.valid
                  ? "border-green-700 bg-green-950/30 text-green-200"
                  : "border-yellow-700 bg-yellow-950/30 text-yellow-200"
              }`}
            >
              <div className="font-semibold">{t(loaderCheck.messageKey)}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
