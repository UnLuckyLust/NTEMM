import { translate } from "@/i18n"
import type { CategoryMoveDirection, ModCategory } from "@/types/modManager"

export function getCategoryNameError(
  categories: ModCategory[],
  name: string,
  categoryId?: string,
) {
  const trimmed = name.trim()

  if (!trimmed) return translate("mods.categoryDialog.nameEmpty")

  const alreadyExists = categories.some(
    (category) =>
      category.id !== categoryId &&
      category.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )

  if (alreadyExists) return translate("mods.categoryDialog.nameExists")

  return ""
}

export function createPakCategory(name: string): ModCategory {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    modNames: [],
  }
}

export function renamePakCategory(
  categories: ModCategory[],
  categoryId: string,
  name: string,
) {
  return categories.map((category) =>
    category.id === categoryId ? { ...category, name } : category,
  )
}

export function movePakCategory(
  categories: ModCategory[],
  categoryId: string,
  direction: CategoryMoveDirection,
) {
  const index = categories.findIndex((category) => category.id === categoryId)
  if (index === -1) return categories

  const nextIndex = direction === "up" ? index - 1 : index + 1
  if (nextIndex < 0 || nextIndex >= categories.length) return categories

  const next = [...categories]
  const temp = next[index]
  next[index] = next[nextIndex]
  next[nextIndex] = temp

  return next
}

export function deletePakCategory(categories: ModCategory[], categoryId: string) {
  return categories.filter((category) => category.id !== categoryId)
}

export function getPakInstallLocationForMod(categories: ModCategory[], modName: string) {
  const category = categories.find((item) => item.modNames.includes(modName))
  return category ? `${category.name}/${modName}` : modName
}

export function buildPakCategoriesPayload(categories: ModCategory[]) {
  return Object.fromEntries(categories.map((category) => [category.name, category.modNames]))
}
