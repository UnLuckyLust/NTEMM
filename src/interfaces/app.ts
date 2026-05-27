import { type ReactNode } from "react"

export interface AppLayoutProps {
  children: ReactNode
  onOpenSettings: () => void
  onOpenGameBanana: () => void
  isSettingsOpen: boolean
  isGameBananaOpen: boolean
}

export interface TitlebarProps {
  onOpenSettings: () => void
  onOpenGameBanana: () => void
  isSettingsOpen: boolean
  isGameBananaOpen: boolean
}

export interface HomeProps {
  onOpenGameBanana: () => void
}

export interface SettingsProps {
  onBackHome: () => void
}

export interface GameBananaProps {
  onBackHome: () => void
}

export interface HudScaleCardProps {
  gamePath: string
}