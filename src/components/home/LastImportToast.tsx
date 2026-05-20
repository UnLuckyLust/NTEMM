import type { ImportResult } from "@/types/modManager"

export function LastImportToast({
  lastImport,
  showLastImport,
}: {
  lastImport: ImportResult | null
  showLastImport: boolean
}) {
  if (!lastImport) return null

  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-12 z-40 w-full max-w-md -translate-x-1/2 rounded-xl border border-pink-700/60 bg-pink-950/90 p-4 text-sm text-green-100 shadow-2xl transition-all duration-500 ${
        showLastImport ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      <div className="font-semibold">Imported: {lastImport.mod_name}</div>
      <div className="mt-1 text-green-200/80">Files copied: {lastImport.copied_files.length}</div>
    </div>
  )
}
