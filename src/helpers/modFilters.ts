import type { ImportedMod, ModCategory } from "@/types/modManager"

export function suggestModName(paths: string[]) {
  if (paths.length === 0) return ""

  const first = paths[0]
  const fileName = first.split(/[\\/]/).pop() ?? "Imported Mod"

  return fileName.replace(/\.(zip|rar|7z|pak|ucas|utoc|asi|ini|dll)$/i, "")
}

export function isPakMod(mod: ImportedMod) {
  return mod.files.some((file) => file.toLowerCase().endsWith(".pak"))
}

export function isAsiMod(mod: ImportedMod) {
  return mod.files.some((file) => file.toLowerCase().endsWith(".asi"))
}

export function getCategorizedPakNames(categories: ModCategory[]) {
  return new Set(categories.flatMap((category) => category.modNames))
}

export function getPakModsWithoutCategory(mods: ImportedMod[], categories: ModCategory[]) {
  const categorizedPakNames = getCategorizedPakNames(categories)

  return mods.filter(
    (mod) => isPakMod(mod) && !categorizedPakNames.has(mod.name),
  )
}
