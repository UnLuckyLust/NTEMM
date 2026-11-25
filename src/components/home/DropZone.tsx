import AppIcon from "../ui/AppIcon"
import { Icons } from "@/lib/icons"

import { useI18n } from "@/i18n"
export function DropZone({
  isDragging,
  isImporting,
  isReadingImport,
  isRunningAsAdmin,
  onOpenImportFilePicker,
  onOpenImportFolderPicker,
}: {
  isDragging: boolean
  isImporting: boolean
  isReadingImport: boolean
  isRunningAsAdmin: boolean
  onOpenImportFilePicker: () => void
  onOpenImportFolderPicker: () => void
}) {
  const { t } = useI18n()

  return (
    <div
      className={`w-full max-w-400 flex min-h-max flex-col items-center justify-center overflow-hidden rounded-2xl border-3 border-dotted px-6 py-4 text-center transition ${
        isDragging ? "border-pink-400 bg-pink-900" : "border-zinc-600 bg-zinc-900"
      } ${isImporting || isReadingImport ? "opacity-70 pointer-events-none" : ""}`}
    >
      <div className={`font-subtitle text-xl font-bold leading-tight ${!isRunningAsAdmin && "mb-3"}`}>
        {isReadingImport
          ? t("mods.dropZone.readingFiles")
          : isImporting
            ? t("common.importing")
            : (!isRunningAsAdmin && t("mods.dropZone.dropModsHere"))
        }
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="flex rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            onClick={onOpenImportFilePicker}
            disabled={isImporting || isReadingImport}
            className="rounded-lg px-2 py-1 text-sm font-semibold g-zinc-800 text-zinc-400 hover:bg-zinc-700 w-32"
          >
            <AppIcon icon={Icons.file} /> {t("mods.dropZone.importFiles")}
          </button>
        </div>

        <div className="flex rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            onClick={onOpenImportFolderPicker}
            disabled={isImporting || isReadingImport}
            className="rounded-lg px-2 py-1 text-sm font-semibold g-zinc-800 text-zinc-400 hover:bg-zinc-700 w-32"
          >
            <AppIcon icon={Icons.folder} /> {t("mods.dropZone.importFolder")}
          </button>
        </div>
      </div>

      <div className="mt-2 flex max-w-xl flex-wrap justify-center gap-x-3 gap-y-1 text-xs leading-tight text-zinc-500">
        <span>
          <span className="font-semibold text-zinc-400">{t("mods.dropZone.archives")}</span>{" "}
          <bdi dir="ltr">ZIP, 7Z, RAR</bdi>
        </span>
        ·
        <span>
          <span className="font-semibold text-zinc-400">{t("mods.dropZone.asi")}</span>{" "}
          <bdi dir="ltr">ASI + INI</bdi>
        </span>
        ·
        <span>
          <span className="font-semibold text-zinc-400">{t("mods.dropZone.pak")}</span>{" "}
          <bdi dir="ltr">PAK + UCAS + UTOC</bdi>
        </span>
      </div>

      {isRunningAsAdmin && (
        <div className="mt-1 max-w-xl text-xs font-medium leading-tight text-yellow-300/80">
          {t("mods.dropZone.adminModeWarning")}
        </div>
      )}
    </div>
  )
}