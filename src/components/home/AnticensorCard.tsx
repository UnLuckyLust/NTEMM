import type { ModUiStatus } from "@/types/modManager"

function getStatusClassName(status: ModUiStatus) {
  if (status === "Enabled") return "bg-green-950/60 text-green-300"
  if (status === "Disabled") return "bg-zinc-800 text-zinc-400"
  if (status === "Pending Enable") return "bg-pink-950/70 text-pink-300"
  return "bg-orange-950/70 text-orange-300"
}

export function AnticensorCard({
  selected,
  status,
  onToggle,
}: {
  selected: boolean
  status: ModUiStatus
  onToggle: () => void
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-200">
            Anticensor
            
            {(status === "Pending Enable" || status === "Pending Disable") && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${getStatusClassName(status)}`}>
                {status}
              </span>
            )}

            <span className="ml-2 text-xs text-zinc-500">by cp0bi</span>
          </div>
          <div className="text-xs text-zinc-500">
            Removes transparency effect on nearby characters
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-zinc-800 p-1">
          <button
            onClick={onToggle}
            className={`rounded-lg px-4 py-1 text-sm font-semibold ${
              selected
                ? "bg-pink-700 text-white hover:bg-pink-600"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {selected ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>
    </section>
  )
}