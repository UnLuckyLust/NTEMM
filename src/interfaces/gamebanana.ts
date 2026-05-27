import type { ModDetails } from "@/types/gamebanana"
import type { Mod } from "@/types/gamebanana"

export interface DetailsPanelProps {
  mod: ModDetails
  isLoading: boolean
  error: string
  onClose: () => void
}

export interface ModCardProps {
  mod: Mod
  onOpenDetails: (mod: Mod) => void
}