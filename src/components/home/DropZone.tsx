import AppIcon from "../ui/AppIcon"
import { Icons } from "@/lib/icons"

export function DropZone({
  isDragging,
  isImporting,
  isRunningAsAdmin,
  onOpenImportFilePicker,
  onOpenImportFolderPicker,
}: {
  isDragging: boolean
  isImporting: boolean
  isRunningAsAdmin: boolean
  onOpenImportFilePicker: () => void
  onOpenImportFolderPicker: () => void
}) {
  return (
    <div
      className={`w-full max-w-400 flex min-h-max flex-col items-center justify-center overflow-hidden rounded-2xl border-3 border-dotted px-6 py-4 text-center transition ${
        isDragging ? "border-pink-400 bg-pink-900" : "border-zinc-600 bg-zinc-900"
      } ${isImporting ? "opacity-70" : ""}`}
    >
      <div className={`text-xl font-bold leading-tight ${!isRunningAsAdmin && "mb-3"}`}>
        {isImporting ? "Importing..." : (!isRunningAsAdmin && "Drop Mods Here to Import")}
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="flex rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            onClick={onOpenImportFilePicker}
            disabled={isImporting}
            className="rounded-lg px-2 py-1 text-sm font-semibold g-zinc-800 text-zinc-400 hover:bg-zinc-700 w-32"
          >
            <AppIcon icon={Icons.file} /> Import Files
          </button>
        </div>

        <div className="flex rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            onClick={onOpenImportFolderPicker}
            disabled={isImporting}
            className="rounded-lg px-2 py-1 text-sm font-semibold g-zinc-800 text-zinc-400 hover:bg-zinc-700 w-32"
          >
            <AppIcon icon={Icons.folder} /> Import Folder
          </button>
        </div>
      </div>

      <div className="mt-2 flex max-w-xl flex-wrap justify-center gap-x-3 gap-y-1 text-xs leading-tight text-zinc-500">
        <span>
          <span className="font-semibold text-zinc-400">Archives:</span> ZIP, 7Z, RAR
        </span>
        ·
        <span>
          <span className="font-semibold text-zinc-400">ASI:</span> ASI + optional INI
        </span>
        ·
        <span>
          <span className="font-semibold text-zinc-400">PAK:</span> PAK + UCAS + UTOC
        </span>
      </div>

      {isRunningAsAdmin && (
        <div className="mt-1 max-w-xl text-xs font-medium leading-tight text-yellow-300/80">
          Admin mode: drag & drop may not work, Use import buttons instead
        </div>
      )}
    </div>
  )
}