import type { ModUiStatus } from "@/types/modManager"

// function hasPendingChanges(
//   hideUidStatus: ModUiStatus,
//   hidePingStatus: ModUiStatus,
// ) {
//   return (
//     hideUidStatus === "Pending Enable" ||
//     hideUidStatus === "Pending Disable" ||
//     hidePingStatus === "Pending Enable" ||
//     hidePingStatus === "Pending Disable"
//   )
// }

function getStatusClassName(status: ModUiStatus) {
  if (status === "Enabled") return "bg-green-950/60 text-green-300"
  if (status === "Disabled") return "bg-zinc-800 text-zinc-400"
  if (status === "Pending Enable") return "bg-pink-950/70 text-pink-300"
  return "bg-orange-950/70 text-orange-300"
}

export function UiModsCard({
  hideUidSelected,
  hideUidStatus,
  // hidePingSelected,
  // hidePingStatus,
  onToggleHideUid,
  // onToggleHidePing,
}: {
  hideUidSelected: boolean
  hideUidStatus: ModUiStatus
  // hidePingSelected: boolean
  // hidePingStatus: ModUiStatus
  onToggleHideUid: () => void
  // onToggleHidePing: () => void
}) {
  
  // const hasPendingApply = hasPendingChanges(hideUidStatus, hidePingStatus)

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <span>UI Mods</span>

              {/* {hasPendingApply && (
                <span className="rounded-full bg-orange-950/70 px-2 py-0.5 text-xs text-orange-300">
                  Pending Apply
                </span>
              )} */}
              {(hideUidStatus === "Pending Enable" || hideUidStatus === "Pending Disable") && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusClassName(hideUidStatus)}`}>
                  {hideUidStatus}
                </span>
              )}

              <span className="text-xs text-zinc-500">by RokkuDayo</span>
            </div>

          <div className="text-xs text-zinc-500">
            Hide UID {/* and Ping */} from the game UI
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <UiModButton
            label="UID"
            title={"Toggle the display of player UID"}
            disabled={false}
            selected={hideUidSelected}
            onClick={onToggleHideUid}
          />

          {/* <UiModButton
            label="Ping"
            title={"This mod is not supported at the moment"}
            disabled={true}
            selected={hidePingSelected}
            onClick={onToggleHidePing}
          /> */}
        </div>
      </div>
    </section>
  )
}

function UiModButton({
  label,
  selected,
  onClick,
  disabled,
  title
}: {
  label: string
  selected: boolean
  onClick: () => void
  disabled: boolean
  title: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-800 p-1">
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`rounded-lg px-4 py-1 text-sm font-semibold ${
          selected
            ? "bg-pink-700 text-white hover:bg-pink-600"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:hover:bg-zinc-800/50"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        {label}
      </button>
    </div>
  )
}