import type { GameVersion, LoaderProxyConfig, LoaderProxyEntry } from "@/types/modManager"

export const LOADER_PROXY_CONFIG_KEY = "loaderProxyConfig"
export const KNOWN_LOADER_PROXY_NAMES_KEY = "knownLoaderProxyNames"

export const MAX_CUSTOM_LOADER_PROXY_NAMES: Record<GameVersion, number> = {
  global: 8,
  tw: 8,
  cn: 7,
}
export const DEFAULT_LOADER_PROXY_NAMES: Record<GameVersion, string[]> = {
  global: ["version.dll"],
  cn: ["dsound.dll", "dinput8.dll"],
  tw: ["version.dll"],
}

const GAME_VERSIONS: GameVersion[] = ["global", "cn", "tw"]

function normalizeDllName(name: string) {
  return name.trim().replace(/^[/\\]+/, "")
}

export function isValidLoaderProxyName(name: string) {
  const normalized = normalizeDllName(name)

  return (
    normalized.length > 0 &&
    normalized.toLowerCase().endsWith(".dll") &&
    !normalized.includes("/") &&
    !normalized.includes("\\")
  )
}

export function createDefaultLoaderProxyConfig(): LoaderProxyConfig {
  return {
    global: DEFAULT_LOADER_PROXY_NAMES.global.map((name) => ({
      name,
      custom: false,
      enabled: true,
    })),
    cn: DEFAULT_LOADER_PROXY_NAMES.cn.map((name) => ({
      name,
      custom: false,
      enabled: true,
    })),
    tw: DEFAULT_LOADER_PROXY_NAMES.tw.map((name) => ({
      name,
      custom: false,
      enabled: true,
    })),
  }
}

export function sanitizeLoaderProxyConfig(value: unknown): LoaderProxyConfig {
  const defaults = createDefaultLoaderProxyConfig()

  if (!value || typeof value !== "object") {
    return defaults
  }

  const raw = value as Partial<Record<GameVersion, unknown>>

  for (const version of GAME_VERSIONS) {
    const entries = Array.isArray(raw[version]) ? raw[version] : []
    const seen = new Set<string>()
    const nextEntries: LoaderProxyEntry[] = []

    for (const defaultEntry of defaults[version]) {
      const savedEntry = entries.find((entry) => {
        if (!entry || typeof entry !== "object") return false

        const name = normalizeDllName(String((entry as LoaderProxyEntry).name ?? ""))
        return name.toLowerCase() === defaultEntry.name.toLowerCase()
      }) as Partial<LoaderProxyEntry> | undefined

      nextEntries.push({
        ...defaultEntry,
        enabled: typeof savedEntry?.enabled === "boolean" ? savedEntry.enabled : true,
      })

      seen.add(defaultEntry.name.toLowerCase())
    }

    const customEntries = entries
      .filter((entry): entry is Partial<LoaderProxyEntry> => Boolean(entry) && typeof entry === "object")
      .map((entry) => ({
        name: normalizeDllName(String(entry.name ?? "")),
        custom: true,
        enabled: Boolean(entry.enabled),
      }))
      .filter((entry) => {
        const key = entry.name.toLowerCase()

        if (!isValidLoaderProxyName(entry.name)) return false
        if (seen.has(key)) return false

        seen.add(key)
        return true
      })
      .slice(0, MAX_CUSTOM_LOADER_PROXY_NAMES[version])

    defaults[version] = [...nextEntries, ...customEntries]
  }

  return defaults
}

export function readLoaderProxyConfig() {
  try {
    return sanitizeLoaderProxyConfig(
      JSON.parse(localStorage.getItem(LOADER_PROXY_CONFIG_KEY) ?? "{}"),
    )
  } catch {
    localStorage.removeItem(LOADER_PROXY_CONFIG_KEY)
    return createDefaultLoaderProxyConfig()
  }
}

export function writeLoaderProxyConfig(config: LoaderProxyConfig) {
  const sanitized = sanitizeLoaderProxyConfig(config)

  localStorage.setItem(LOADER_PROXY_CONFIG_KEY, JSON.stringify(sanitized))
  return sanitized
}

export function getEnabledLoaderProxyNames(config: LoaderProxyConfig, version: GameVersion) {
  return config[version]
    .filter((entry) => entry.enabled)
    .map((entry) => normalizeDllName(entry.name))
}

export function getConfigLoaderProxyNames(config: LoaderProxyConfig) {
  return GAME_VERSIONS.flatMap((version) =>
    config[version].map((entry) => normalizeDllName(entry.name)),
  )
}

export function readKnownLoaderProxyNames() {
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWN_LOADER_PROXY_NAMES_KEY) ?? "[]")

    if (!Array.isArray(raw)) {
      return []
    }

    return raw
      .map((name) => normalizeDllName(String(name)))
      .filter(isValidLoaderProxyName)
  } catch {
    localStorage.removeItem(KNOWN_LOADER_PROXY_NAMES_KEY)
    return []
  }
}

export function rememberKnownLoaderProxyNames(names: string[]) {
  const allNames = [
    ...Object.values(DEFAULT_LOADER_PROXY_NAMES).flat(),
    ...readKnownLoaderProxyNames(),
    ...names,
  ]

  const seen = new Set<string>()
  const normalized = allNames
    .map(normalizeDllName)
    .filter(isValidLoaderProxyName)
    .filter((name) => {
      const key = name.toLowerCase()
      if (seen.has(key)) return false

      seen.add(key)
      return true
    })

  localStorage.setItem(KNOWN_LOADER_PROXY_NAMES_KEY, JSON.stringify(normalized))
  return normalized
}

export function getKnownLoaderProxyNames(config = readLoaderProxyConfig()) {
  return rememberKnownLoaderProxyNames(getConfigLoaderProxyNames(config))
}

export function getLoaderProxyConfigError(config: LoaderProxyConfig) {
  for (const version of GAME_VERSIONS) {
    const seen = new Set<string>()
    const customCount = config[version].filter((entry) => entry.custom).length

    const maxCustomNames = MAX_CUSTOM_LOADER_PROXY_NAMES[version]

    if (customCount > maxCustomNames) {
      return `${version.toUpperCase()} can only have up to ${maxCustomNames} custom loader names`
    }

    for (const entry of config[version]) {
      const name = normalizeDllName(entry.name)
      const key = name.toLowerCase()

      if (!isValidLoaderProxyName(name)) {
        return `${version.toUpperCase()} has an invalid loader name`
      }

      if (seen.has(key)) {
        return `${version.toUpperCase()} has a duplicated loader name: ${name}`
      }

      seen.add(key)
    }
  }

  return ""
}