export function DropZone({
  isDragging,
  isImporting,
}: {
  isDragging: boolean
  isImporting: boolean
}) {
  return (
    <div
      className={`flex min-h-25 flex-col items-center justify-center rounded-2xl border-3 border-dotted p-8 text-center transition ${
        isDragging ? "border-pink-400 bg-pink-900" : "border-zinc-600 bg-zinc-900"
      }`}
    >
      <div className="text-2xl font-bold">
        {isImporting ? "Importing..." : "Drop Mod Files Here"}
      </div>

      <div className="mt-2 max-w-xl text-sm text-zinc-400">Support PAK and ASI mods</div>

      <div className="mt-1 text-xs text-zinc-500">
        PAK mods must include matching .pak, .ucas, and .utoc files.
      </div>
    </div>
  )
}
