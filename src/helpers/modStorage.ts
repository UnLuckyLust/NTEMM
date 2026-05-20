import type { ModCategory } from "@/types/modManager"

const keys = {
  gameFolder: "gameFolder",
  closeOnLaunch: "closeOnLaunch",
  pakCategories: "pakCategories",
  uncategorizedPakMods: "uncategorizedPakMods",
  appliedPakInstallLocationByMod: "appliedPakInstallLocationByMod",
  collapsedUncategorized: "collapsedUncategorized",
  collapsedPakCategories: "collapsedPakCategories",
} as const

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T
  } catch {
    return fallback
  }
}

export function getGameFolder() {
  return localStorage.getItem(keys.gameFolder)
}

export function shouldCloseOnLaunch() {
  return localStorage.getItem(keys.closeOnLaunch) === "true"
}

export function loadPakCategories() {
  return readJson<ModCategory[]>(keys.pakCategories, [])
}

export function savePakCategories(categories: ModCategory[]) {
  localStorage.setItem(keys.pakCategories, JSON.stringify(categories))
}

export function loadUncategorizedPakMods() {
  return readJson<string[]>(keys.uncategorizedPakMods, [])
}

export function saveUncategorizedPakMods(modNames: string[]) {
  localStorage.setItem(keys.uncategorizedPakMods, JSON.stringify(modNames))
}

export function loadAppliedPakInstallLocationByMod() {
  return readJson<Record<string, string>>(keys.appliedPakInstallLocationByMod, {})
}

export function saveAppliedPakInstallLocationByMod(locations: Record<string, string>) {
  localStorage.setItem(keys.appliedPakInstallLocationByMod, JSON.stringify(locations))
}

export function loadCollapsedUncategorized() {
  return localStorage.getItem(keys.collapsedUncategorized) === "true"
}

export function saveCollapsedUncategorized(isCollapsed: boolean) {
  localStorage.setItem(keys.collapsedUncategorized, String(isCollapsed))
}

export function loadCollapsedPakCategories() {
  return readJson<Record<string, boolean>>(keys.collapsedPakCategories, {})
}

export function saveCollapsedPakCategories(categories: Record<string, boolean>) {
  localStorage.setItem(keys.collapsedPakCategories, JSON.stringify(categories))
}
