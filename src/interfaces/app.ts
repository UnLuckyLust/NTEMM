import { type ReactNode } from "react"

export interface AppLayoutProps {
  children: ReactNode
  onOpenHome: () => void
  onOpenSettings: () => void
  onOpenGameBanana: () => void
  isHomeOpen: boolean
  isSettingsOpen: boolean
  isGameBananaOpen: boolean
}

export interface TitlebarProps {
  onOpenHome: () => void
  onOpenSettings: () => void
  onOpenGameBanana: () => void
  isHomeOpen: boolean
  isSettingsOpen: boolean
  isGameBananaOpen: boolean
}

export interface HomeProps {
  onOpenGameBanana: () => void
}

export interface HudScaleCardProps {
  gamePath: string
}