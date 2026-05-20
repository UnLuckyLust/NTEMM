import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"

export function LauncherBar({
  canApplyChanges,
  loaderInstalled,
  onApplyChanges,
  onToggleLoaderFiles,
  onLaunchGame,
}: {
  canApplyChanges: boolean
  loaderInstalled: boolean
  onApplyChanges: () => void
  onToggleLoaderFiles: () => void
  onLaunchGame: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-zinc-200">Mod Manager</div>
        <div className="text-xs text-zinc-500">
          Apply pending mod changes and launch NTE from the selected game folder
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onApplyChanges}
          disabled={!canApplyChanges}
          className="rounded-lg border border-pink-700 bg-pink-950/40 px-5 py-2 text-sm font-semibold text-pink-200 transition hover:bg-pink-900/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply Changes
        </button>

        <button
          onClick={onToggleLoaderFiles}
          className={`rounded-lg border px-5 py-2 text-sm font-semibold transition ${
            loaderInstalled
              ? "border-green-700 bg-green-950/40 text-green-200 hover:bg-green-900/40"
              : "border-yellow-700 bg-yellow-950/40 text-yellow-200 hover:bg-yellow-900/40"
          }`}
        >
          {loaderInstalled ? "Uninstall Loader" : "Install Loader"}
        </button>

        <button
          onClick={onLaunchGame}
          className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
        >
          <AppIcon icon={Icons.play} className="text-[15px]" />
          Launch Game
        </button>
      </div>
    </div>
  )
}
