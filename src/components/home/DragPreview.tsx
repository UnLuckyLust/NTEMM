export function DragPreview({ modName }: { modName: string | null }) {
  if (!modName) return null

  return (
    <div
      id="drag-preview"
      className="pointer-events-none fixed z-9999 hidden -translate-x-1/2 -translate-y-1/2 rounded-lg border border-pink-500 bg-zinc-950 px-4 py-2 text-sm font-semibold text-pink-200 shadow-2xl"
    >
      {modName}
    </div>
  )
}
