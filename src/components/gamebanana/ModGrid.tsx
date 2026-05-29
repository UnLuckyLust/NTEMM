import type { Mod } from "@/types/gamebanana"
import ModCard from "./ModCard"

interface GameBananaModGridProps {
  mods: Mod[]
  onOpenDetails: (mod: Mod) => void
}

export default function GameBananaModGrid({
  mods,
  onOpenDetails,
}: GameBananaModGridProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {mods.map((mod) => (
          <ModCard
            key={mod.id}
            mod={mod}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>
    </div>
  )
}