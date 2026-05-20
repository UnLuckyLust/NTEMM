import type { ModCategory, ModInstallStatus, ModUiStatus } from "@/types/modManager"
import { getPakInstallLocationForMod } from "@/helpers/modCategories"

export function getModUiStatus(params: {
  name: string
  activeMods: string[]
  selectedMods: string[]
  modStatuses: ModInstallStatus[]
  pakCategories: ModCategory[]
  appliedPakInstallLocationByMod: Record<string, string>
}): ModUiStatus {
  const {
    name,
    activeMods,
    selectedMods,
    modStatuses,
    pakCategories,
    appliedPakInstallLocationByMod,
  } = params

  const realStatus = modStatuses.find((mod) => mod.name === name)?.status
  const isActive = activeMods.includes(name)
  const isSelected = selectedMods.includes(name)

  if (!isActive && isSelected) return "Pending Enable"
  if (isActive && !isSelected) return "Pending Disable"

  if (
    isActive &&
    getPakInstallLocationForMod(pakCategories, name) !==
      (appliedPakInstallLocationByMod[name] ?? null)
  ) {
    return "Pending Move"
  }

  if (realStatus === "needs_fix") return "Needs Fix"
  if (realStatus === "enabled") return "Enabled"

  return "Disabled"
}

export function hasPendingModChanges(params: {
  activeMods: string[]
  selectedMods: string[]
  categoryNameErrors: Record<string, string>
  pakCategories: ModCategory[]
  appliedPakInstallLocationByMod: Record<string, string>
}) {
  const {
    activeMods,
    selectedMods,
    categoryNameErrors,
    pakCategories,
    appliedPakInstallLocationByMod,
  } = params

  const hasCategoryNameError = Object.values(categoryNameErrors).some(Boolean)
  if (hasCategoryNameError) return false

  const active = [...activeMods].sort().join("|")
  const selected = [...selectedMods].sort().join("|")

  const categoryChanged = activeMods.some(
    (modName) =>
      getPakInstallLocationForMod(pakCategories, modName) !==
      appliedPakInstallLocationByMod[modName],
  )

  return active !== selected || categoryChanged
}

export function getAppliedPakInstallLocations(
  activeMods: string[],
  pakCategories: ModCategory[],
) {
  return Object.fromEntries(
    activeMods.map((modName) => [
      modName,
      getPakInstallLocationForMod(pakCategories, modName),
    ]),
  )
}
