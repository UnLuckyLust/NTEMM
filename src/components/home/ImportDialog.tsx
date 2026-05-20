export function ImportDialog({
  isOpen,
  modName,
  isImporting,
  onModNameChange,
  onConfirm,
  onClose,
}: {
  isOpen: boolean
  modName: string
  isImporting: boolean
  onModNameChange: (name: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <h2 className="text-lg font-bold">Import Mod</h2>

        <p className="mt-2 text-sm text-zinc-400">Enter a unique mod name</p>

        <input
          title="Mod Name"
          value={modName}
          onChange={(e) => onModNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm()
            if (e.key === "Escape") onClose()
          }}
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-pink-500"
          autoFocus
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={isImporting}
            className="rounded-lg bg-pink-700 px-4 py-2 text-sm text-white hover:bg-pink-600 disabled:opacity-50"
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  )
}
