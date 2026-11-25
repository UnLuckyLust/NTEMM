import { useMemo, useRef, useState, type ReactNode } from "react"
import { ModCard } from "@/components/home/ModCard"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { useI18n } from "@/i18n"
import type {
  ImportedMod,
  ModsSectionProps,
  ModSortMode,
  ModUiStatus,
} from "@/types/modManager"

const modSortOptions: { value: ModSortMode; labelKey: string }[] = [
  { value: "manual", labelKey: "mods.sort.manual" },
  { value: "nameAsc", labelKey: "mods.sort.nameAsc" },
  { value: "nameDesc", labelKey: "mods.sort.nameDesc" },
  { value: "enabledFirst", labelKey: "mods.sort.enabledFirst" },
  { value: "disabledFirst", labelKey: "mods.sort.disabledFirst" },
  { value: "authorAsc", labelKey: "mods.sort.authorAsc" },
  { value: "fileCountDesc", labelKey: "mods.sort.fileCountDesc" },
]

const enabledFirstRank: Record<ModUiStatus, number> = {
  Enabled: 0,
  "Pending Disable": 1,
  "Pending Enable": 2,
  "Needs Fix": 3,
  Disabled: 4,
  "Pending Move": 5,
}

const disabledFirstRank: Record<ModUiStatus, number> = {
  Disabled: 0,
  "Needs Fix": 1,
  "Pending Enable": 2,
  "Pending Disable": 3,
  Enabled: 4,
  "Pending Move": 5,
}

function getModDisplayName(mod: ImportedMod) {
  return mod.metadata?.name || mod.name
}

function getModSearchFields(mod: ImportedMod) {
  const meta = mod.metadata

  return [
    mod.name,
    ...mod.files,
    meta?.name,
    meta?.version,
    meta?.author,
    ...(meta?.tags ?? []),
  ]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    )
    .map((value) => value.toLowerCase())
}

function doesModMatchSearch(mod: ImportedMod, searchQuery: string) {
  const searchTerms = searchQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (searchTerms.length === 0) return true

  const searchFields = getModSearchFields(mod)

  return searchTerms.every((term) =>
    searchFields.some((field) => field.includes(term)),
  )
}

function sortMods(
  mods: ImportedMod[],
  sortMode: ModSortMode,
  getModStatus: (name: string) => ModUiStatus,
) {
  if (sortMode === "manual") return mods

  return [...mods]
    .map((mod, index) => ({ mod, index }))
    .sort((a, b) => {
      const nameA = getModDisplayName(a.mod).toLowerCase()
      const nameB = getModDisplayName(b.mod).toLowerCase()

      let result = 0

      if (sortMode === "nameAsc") {
        result = nameA.localeCompare(nameB)
      }

      if (sortMode === "nameDesc") {
        result = nameB.localeCompare(nameA)
      }

      if (sortMode === "enabledFirst") {
        result =
          enabledFirstRank[getModStatus(a.mod.name)] -
          enabledFirstRank[getModStatus(b.mod.name)]
      }

      if (sortMode === "disabledFirst") {
        result =
          disabledFirstRank[getModStatus(a.mod.name)] -
          disabledFirstRank[getModStatus(b.mod.name)]
      }

      if (sortMode === "authorAsc") {
        result = (a.mod.metadata?.author ?? "")
          .toLowerCase()
          .localeCompare((b.mod.metadata?.author ?? "").toLowerCase())
      }

      if (sortMode === "fileCountDesc") {
        result = b.mod.files.length - a.mod.files.length
      }

      return result || nameA.localeCompare(nameB) || a.index - b.index
    })
    .map(({ mod }) => mod)
}

export function ModsSection({
  modsView,
  visibleMods,
  pakModsWithoutCategory,
  pakCategories,
  selectedMods,
  draggedPakModName,
  categoryNameErrors,
  collapsedUncategorized,
  collapsedPakCategories,
  onModsViewChange,
  onAddCategoryClick,
  onRefresh,
  onBeginPakDrag,
  onMovePakModDragOver,
  onEndPakDrag,
  toggleModSelection,
  getModStatus,
  removeImportedMod,
  renameImportedMod,
  getModRenameError,
  updatePakCategoryName,
  revertPakCategoryName,
  movePakCategory,
  deletePakCategory,
  toggleUncategorizedCollapsed,
  togglePakCategoryCollapsed,
  changePakModIcon,
  clearPakModIconForMod,
}: ModsSectionProps) {
  const { t } = useI18n()
  const [modSearchQuery, setModSearchQuery] = useState("")
  const [modSortMode, setModSortMode] = useState<ModSortMode>("manual")
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [isSearchHovered, setIsSearchHovered] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isSortHovered, setIsSortHovered] = useState(false)
  const [isSortFocused, setIsSortFocused] = useState(false)
  const isSortOpen = isSortHovered || isSortFocused

  const isSearchOpen =
    (isSearchHovered || isSearchFocused || modSearchQuery.length > 0) &&
    !isSortOpen

  const normalizedSearchQuery = modSearchQuery.trim().toLowerCase()
  const isManualOrder = modSortMode === "manual"
  const selectedSortLabelKey = modSortOptions.find(
    (option) => option.value === modSortMode,
  )?.labelKey

  const filteredVisibleMods = useMemo(() => {
    const matchingMods = visibleMods.filter((mod) =>
      doesModMatchSearch(mod, normalizedSearchQuery),
    )

    return sortMods(matchingMods, modSortMode, getModStatus)
  }, [visibleMods, normalizedSearchQuery, modSortMode, getModStatus])

  const filteredPakModsWithoutCategory = useMemo(() => {
    const matchingMods = pakModsWithoutCategory.filter((mod) =>
      doesModMatchSearch(mod, normalizedSearchQuery),
    )

    return sortMods(matchingMods, modSortMode, getModStatus)
  }, [pakModsWithoutCategory, normalizedSearchQuery, modSortMode, getModStatus])

  const hasVisibleMods = filteredVisibleMods.length > 0

  return (
    <section className="flex min-h-0 h-full flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-subtitle flex items-center gap-2">
          <ViewButton
            active={modsView === "pak"}
            onClick={() => onModsViewChange("pak")}
          >
            {t("mods.views.pak")}
          </ViewButton>

          <ViewButton
            active={modsView === "asi"}
            onClick={() => onModsViewChange("asi")}
          >
            {t("mods.views.asi")}
          </ViewButton>
        </div>

        <div className="flex items-center">
          <div
            onMouseEnter={() => setIsSearchHovered(true)}
            onMouseLeave={() => setIsSearchHovered(false)}
            className={`relative flex h-8 items-center overflow-hidden rounded-lg transition-all duration-200 ${
              isSearchOpen ? "w-35" : "w-7"
            }`}
          >
            <AppIcon
              icon={Icons.search}
              className={`pointer-events-none absolute text-sm transition-all duration-200 ${
                isSearchOpen
                  ? "inset-s-2.5 text-pink-500"
                  : "left-1/2 -translate-x-1/2 text-zinc-500"
              }`}
            />

            <input
              ref={searchInputRef}
              value={modSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setModSearchQuery(e.target.value)}
              placeholder={t("mods.searchPlaceholder")}
              className={`border border-zinc-800 rounded-lg h-full w-full bg-transparent ps-8 pe-6 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 transition-opacity duration-150 ${
                isSearchOpen ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />

            {modSearchQuery && isSearchOpen && (
              <button
                type="button"
                title={t("mods.clearSearch")}
                onClick={() => setModSearchQuery("")}
                className="absolute inset-e-2 text-xs text-zinc-500 hover:text-pink-500"
              >
                <AppIcon icon={Icons.close} />
              </button>
            )}
          </div>

          <div
            onMouseEnter={() => {
              setIsSortHovered(true)
              searchInputRef.current?.blur()
            }}
            onMouseLeave={() => setIsSortHovered(false)}
            className={`group relative flex h-8 items-center overflow-hidden rounded-lg transition-all duration-200 ${
              isSortOpen ? "w-27" : "w-7"
            }`}
          >
            <AppIcon
              icon={Icons.sort}
              className={`pointer-events-none absolute text-sm transition-all duration-200 ${
                isSortOpen
                  ? "inset-s-2.5 text-pink-500"
                  : "left-1/2 -translate-x-1/2 text-zinc-500"
              }`}
            />

            <span
              className={`font-subtitle pointer-events-none absolute inset-s-8 inset-e-2 truncate text-sm text-zinc-300 transition-opacity duration-150 ${
                isSortOpen ? "opacity-100" : "opacity-0"
              }`}
            >
              {selectedSortLabelKey ? t(selectedSortLabelKey) : ""}
            </span>

            <select
              title={t("mods.sort.title")}
              value={modSortMode}
              onFocus={() => setIsSortFocused(true)}
              onBlur={() => setIsSortFocused(false)}
              onChange={(e) => {
                setModSortMode(e.target.value as ModSortMode)

                requestAnimationFrame(() => {
                  e.currentTarget.blur()
                  setIsSortFocused(false)
                  setIsSortHovered(false)
                })
              }}
              className={`h-full w-full cursor-pointer appearance-none rounded-lg border border-zinc-800 px-2 text-sm text-transparent outline-none transition-opacity duration-150 ${
                isSortOpen ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {modSortOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-zinc-900 text-zinc-300"
                >
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {modsView === "pak" && (
            <button
              title={t("mods.addCategory")}
              onClick={onAddCategoryClick}
              className="text-sm p-1 text-zinc-500 hover:text-pink-500"
            >
              <AppIcon icon={Icons.layerGroup} />
            </button>
          )}

          <button
            title={t("mods.refreshData")}
            onClick={onRefresh}
            className="text-sm p-1 text-zinc-500 hover:text-pink-500"
          >
            <AppIcon icon={Icons.refresh} />
          </button>
        </div>
      </div>

      {modsView === "pak" ? (
        <PakModsList
          pakModsWithoutCategory={filteredPakModsWithoutCategory}
          pakCategories={pakCategories}
          allPakMods={filteredVisibleMods}
          selectedMods={selectedMods}
          draggedPakModName={draggedPakModName}
          categoryNameErrors={categoryNameErrors}
          collapsedUncategorized={collapsedUncategorized}
          collapsedPakCategories={collapsedPakCategories}
          modSortMode={modSortMode}
          allowManualDrag={isManualOrder}
          onBeginPakDrag={onBeginPakDrag}
          onMovePakModDragOver={onMovePakModDragOver}
          onEndPakDrag={onEndPakDrag}
          toggleModSelection={toggleModSelection}
          getModStatus={getModStatus}
          removeImportedMod={removeImportedMod}
          renameImportedMod={renameImportedMod}
          getModRenameError={getModRenameError}
          updatePakCategoryName={updatePakCategoryName}
          revertPakCategoryName={revertPakCategoryName}
          movePakCategory={movePakCategory}
          deletePakCategory={deletePakCategory}
          toggleUncategorizedCollapsed={toggleUncategorizedCollapsed}
          togglePakCategoryCollapsed={togglePakCategoryCollapsed}
          changePakModIcon={changePakModIcon}
          clearPakModIconForMod={clearPakModIconForMod}
          t={t}
        />
      ) : !hasVisibleMods ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-500">
          {modSearchQuery
            ? t("mods.empty.noAsiSearchResults")
            : t("mods.empty.noAsiMods")}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pe-1">
          {filteredVisibleMods.map((mod) => (
            <ModCard
              key={mod.name}
              mod={mod}
              selectedMods={selectedMods}
              toggleModSelection={toggleModSelection}
              getModStatus={getModStatus}
              removeImportedMod={removeImportedMod}
              renameImportedMod={renameImportedMod}
              getModRenameError={getModRenameError}
              clearPakModIconForMod={clearPakModIconForMod}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40 ${
        active
          ? "border border-pink-700 bg-pink-700 text-white"
          : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  )
}

function PakModsList({
  pakModsWithoutCategory,
  pakCategories,
  allPakMods,
  selectedMods,
  draggedPakModName,
  categoryNameErrors,
  collapsedUncategorized,
  collapsedPakCategories,
  modSortMode,
  allowManualDrag,
  onBeginPakDrag,
  onMovePakModDragOver,
  onEndPakDrag,
  toggleModSelection,
  getModStatus,
  removeImportedMod,
  renameImportedMod,
  getModRenameError,
  updatePakCategoryName,
  revertPakCategoryName,
  movePakCategory,
  deletePakCategory,
  toggleUncategorizedCollapsed,
  togglePakCategoryCollapsed,
  changePakModIcon,
  clearPakModIconForMod,
  t,
}: Omit<
  ModsSectionProps,
  | "modsView"
  | "visibleMods"
  | "onModsViewChange"
  | "onAddCategoryClick"
  | "onRefresh"
> & {
  modSortMode: ModSortMode
  allowManualDrag: boolean
  t: ReturnType<typeof useI18n>["t"]
}) {
  function toggleCategoryMods(mods: ImportedMod[]) {
    const modNames = mods.map((mod) => mod.name)
    const allSelected = modNames.every((name) => selectedMods.includes(name))

    modNames.forEach((name) => {
      const isSelected = selectedMods.includes(name)

      if (allSelected && isSelected) {
        toggleModSelection(name)
      }

      if (!allSelected && !isSelected) {
        toggleModSelection(name)
      }
    })
  }

  function getCategoryEnabledCount(mods: ImportedMod[]) {
    return mods.filter((mod) => {
      const status = getModStatus(mod.name)

      return status === "Enabled" || status === "Pending Disable"
    }).length
  }

  function getCategoryEnabledText(mods: ImportedMod[]) {
    const enabledCount = getCategoryEnabledCount(mods)
    const totalCount = mods.length

    if (totalCount === 1) {
      return enabledCount === 1
        ? t("mods.category.enabledSingle")
        : t("mods.category.disabledSingle")
    }

    if (enabledCount === 0) {
      return t("mods.category.allDisabled", { count: totalCount })
    }

    if (enabledCount === totalCount) {
      return t("mods.category.allEnabled", { count: totalCount })
    }

    return t("mods.category.enabledCount", { enabled: enabledCount, total: totalCount })
  }

  return (
    <div
      data-pak-mods-scroll
      className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pe-1"
    >
      <div
        data-pak-category-id="uncategorized"
        onPointerEnter={() => onMovePakModDragOver("uncategorized", null)}
        className={`rounded-xl border border-dashed border-zinc-700 p-3 flex flex-col ${
          pakModsWithoutCategory.length > 0 ? "gap-2" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-400 p-1">
            {t("mods.category.uncategorized")}
          </div>

          {pakModsWithoutCategory.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                title={t("mods.expandCollapse")}
                onClick={toggleUncategorizedCollapsed}
                className="flex rounded-lg text-xl text-zinc-300 hover:text-pink-500"
              >
                <div className="text-xs text-zinc-300">
                  {getCategoryEnabledText(pakModsWithoutCategory)}
                </div>

                <AppIcon
                  icon={
                    collapsedUncategorized ? Icons.anglesDown : Icons.anglesUp
                  }
                  className="ps-1 text-[16px]"
                />
              </button>

              <button
                onClick={() => toggleCategoryMods(pakModsWithoutCategory)}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {pakModsWithoutCategory.every((mod) =>
                  selectedMods.includes(mod.name),
                )
                  ? t("mods.deselectAll")
                  : t("mods.selectAll")}
              </button>
            </div>
          )}
        </div>

        {!collapsedUncategorized && (
          <div className="space-y-2">
            {pakModsWithoutCategory.map((mod) => (
              <ModCard
                key={mod.name}
                mod={mod}
                draggable={allowManualDrag}
                onPointerDragStart={() => onBeginPakDrag(mod.name)}
                onPointerDragEnter={() =>
                  onMovePakModDragOver("uncategorized", mod.name)
                }
                onPointerDragEnd={onEndPakDrag}
                isDraggingThis={draggedPakModName === mod.name}
                selectedMods={selectedMods}
                toggleModSelection={toggleModSelection}
                getModStatus={getModStatus}
                removeImportedMod={removeImportedMod}
                renameImportedMod={renameImportedMod}
                getModRenameError={getModRenameError}
                changePakModIcon={changePakModIcon}
                clearPakModIconForMod={clearPakModIconForMod}
              />
            ))}
          </div>
        )}
      </div>

      {pakCategories.map((category, index) => {
        const categoryMods = sortMods(
          category.modNames
            .map((name) => allPakMods.find((mod) => mod.name === name))
            .filter((mod): mod is ImportedMod => Boolean(mod)),
          modSortMode,
          getModStatus,
        )
        return (
          <div
            key={category.id}
            data-pak-category-id={category.id}
            onPointerEnter={() => onMovePakModDragOver(category.id, null)}
            className={`rounded-xl border border-zinc-700 p-3 flex flex-col ${
              categoryMods.length > 0 ? "gap-2" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center justify-between">
                <div className="flex">
                  <button
                    onClick={() => movePakCategory(category.id, "up")}
                    disabled={index === 0}
                    className="rounded py-1 px-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑
                  </button>

                  <button
                    onClick={() => movePakCategory(category.id, "down")}
                    disabled={index === pakCategories.length - 1}
                    className="rounded py-1 px-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>

                <input
                  title={t("mods.categoryDialog.nameTitle")}
                  value={category.name}
                  onChange={(e) =>
                    updatePakCategoryName(category.id, e.target.value)
                  }
                  onBlur={() => {
                    if (categoryNameErrors[category.id])
                      revertPakCategoryName(category.id)
                  }}
                  className="w-full max-w-36 rounded px-2 py-1 text-sm font-semibold text-zinc-200 outline-none border border-zinc-900 focus:border-pink-500"
                />

                {categoryNameErrors[category.id] && (
                  <div className="text-xs text-red-400 shrink-0 h-full">
                    {categoryNameErrors[category.id]}
                  </div>
                )}
              </div>

              <div className="flex gap-1">
                {categoryMods.length > 0 && (
                  <>
                    <button
                      title={t("mods.expandCollapse")}
                      onClick={() => togglePakCategoryCollapsed(category.id)}
                      className="mt-1 flex rounded-lg text-xl text-zinc-300 hover:text-pink-500"
                    >
                      <div className="text-xs text-zinc-300">
                        {getCategoryEnabledText(categoryMods)}
                      </div>

                      <AppIcon
                        icon={
                          collapsedPakCategories[category.id]
                            ? Icons.anglesDown
                            : Icons.anglesUp
                        }
                        className="ps-1 text-[16px]"
                      />
                    </button>

                    <button
                      onClick={() => toggleCategoryMods(categoryMods)}
                      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      {categoryMods.every((mod) =>
                        selectedMods.includes(mod.name),
                      )
                        ? t("mods.deselectAll")
                        : t("mods.selectAll")}
                    </button>
                  </>
                )}

                <button
                  onClick={() => deletePakCategory(category.id)}
                  className="rounded-lg px-2 py-1 text-xs border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  {t("mods.category.remove")}
                </button>
              </div>
            </div>

            {!collapsedPakCategories[category.id] && (
              <div className="space-y-2">
                {categoryMods.map((mod) => {
                  return (
                    <ModCard
                      key={mod.name}
                      mod={mod}
                      draggable={allowManualDrag}
                      onPointerDragStart={() => onBeginPakDrag(mod.name)}
                      onPointerDragEnter={() =>
                        onMovePakModDragOver(category.id, mod.name)
                      }
                      onPointerDragEnd={onEndPakDrag}
                      isDraggingThis={draggedPakModName === mod.name}
                      selectedMods={selectedMods}
                      toggleModSelection={toggleModSelection}
                      getModStatus={getModStatus}
                      removeImportedMod={removeImportedMod}
                      renameImportedMod={renameImportedMod}
                      getModRenameError={getModRenameError}
                      changePakModIcon={changePakModIcon}
                      clearPakModIconForMod={clearPakModIconForMod}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}