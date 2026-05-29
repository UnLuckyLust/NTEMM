import type { ModCategory } from "@/types/modManager"
import {  GameVersion, VersionedStorage } from "@/types/modManager"

const keys = {
  gameFolder: "gameFolder",
  closeOnLaunch: "closeOnLaunch",
  pakCategories: "pakCategories",
  uncategorizedPakMods: "uncategorizedPakMods",

  // Legacy global keys
  appliedPakInstallLocationByMod: "appliedPakInstallLocationByMod",
  loaderVersions: "loaderVersions",

  // New per-version keys
  appliedPakInstallLocationByModByVersion: "appliedPakInstallLocationByModByVersion",
  loaderVersionsByVersion: "loaderVersionsByVersion",

  collapsedUncategorized: "collapsedUncategorized",
  collapsedPakCategories: "collapsedPakCategories",
} as const

const gameVersions: GameVersion[] = ["global", "cn", "tw"]

function isKnownGameVersion(version: unknown): version is GameVersion {
  return gameVersions.includes(version as GameVersion)
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T
  } catch {
    return fallback
  }
}

function readVersionedJson<T>(key: string): VersionedStorage<T> {
  const raw = readJson<Record<string, T>>(key, {})
  const sanitized: VersionedStorage<T> = {}

  for (const version of gameVersions) {
    if (raw[version] !== undefined) {
      sanitized[version] = raw[version]
    }
  }

  return sanitized
}

function writeVersionedJson<T>(key: string, value: VersionedStorage<T>) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getGameFolder() {
  return localStorage.getItem(keys.gameFolder)
}

export function shouldCloseOnLaunch() {
  return localStorage.getItem(keys.closeOnLaunch) === "true"
}

export function loadStoredLoaderVersions(version?: GameVersion | null) {
  if (!isKnownGameVersion(version)) {
    return readJson<Record<string, string> | null>(keys.loaderVersions, null)
  }

  const byVersion = readVersionedJson<Record<string, string>>(keys.loaderVersionsByVersion)

  if (byVersion[version]) {
    return byVersion[version]
  }

  const legacyValue = localStorage.getItem(keys.loaderVersions)

  if (legacyValue !== null) {
    const legacyVersions = readJson<Record<string, string> | null>(keys.loaderVersions, null)

    if (legacyVersions) {
      byVersion[version] = legacyVersions
      writeVersionedJson(keys.loaderVersionsByVersion, byVersion)
      localStorage.removeItem(keys.loaderVersions)
    }

    return legacyVersions
  }

  return null
}

export function saveStoredLoaderVersions(
  versions: Record<string, string>,
  version?: GameVersion | null,
) {
  if (!isKnownGameVersion(version)) {
    localStorage.setItem(keys.loaderVersions, JSON.stringify(versions))
    return
  }

  const byVersion = readVersionedJson<Record<string, string>>(keys.loaderVersionsByVersion)
  byVersion[version] = versions
  writeVersionedJson(keys.loaderVersionsByVersion, byVersion)
}

export function removeStoredLoaderVersions(version?: GameVersion | null) {
  if (!isKnownGameVersion(version)) {
    localStorage.removeItem(keys.loaderVersions)
    return
  }

  const byVersion = readVersionedJson<Record<string, string>>(keys.loaderVersionsByVersion)
  delete byVersion[version]
  writeVersionedJson(keys.loaderVersionsByVersion, byVersion)
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

export function loadAppliedPakInstallLocationByMod(version?: GameVersion | null) {
  if (!isKnownGameVersion(version)) {
    return readJson<Record<string, string>>(keys.appliedPakInstallLocationByMod, {})
  }

  const byVersion = readVersionedJson<Record<string, string>>(
    keys.appliedPakInstallLocationByModByVersion,
  )

  if (byVersion[version]) {
    return byVersion[version]
  }

  const legacyValue = localStorage.getItem(keys.appliedPakInstallLocationByMod)

  if (legacyValue !== null) {
    const legacyLocations = readJson<Record<string, string>>(
      keys.appliedPakInstallLocationByMod,
      {},
    )

    byVersion[version] = legacyLocations
    writeVersionedJson(keys.appliedPakInstallLocationByModByVersion, byVersion)
    localStorage.removeItem(keys.appliedPakInstallLocationByMod)

    return legacyLocations
  }

  return {}
}

export function saveAppliedPakInstallLocationByMod(
  locations: Record<string, string>,
  version?: GameVersion | null,
) {
  if (!isKnownGameVersion(version)) {
    localStorage.setItem(keys.appliedPakInstallLocationByMod, JSON.stringify(locations))
    return
  }

  const byVersion = readVersionedJson<Record<string, string>>(
    keys.appliedPakInstallLocationByModByVersion,
  )

  byVersion[version] = locations
  writeVersionedJson(keys.appliedPakInstallLocationByModByVersion, byVersion)
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
