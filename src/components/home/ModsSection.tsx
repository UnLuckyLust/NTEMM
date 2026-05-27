import type { ReactNode } from "react"
import type { ImportedMod } from "@/types/modManager"
import { ModCard } from "@/components/home/ModCard"
import AppIcon from "@/components/ui/AppIcon"
import { Icons } from "@/lib/icons"
import { ModsSectionProps } from "@/types/modManager"

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
  toggleModSelection,
  getModStatus,
  removeImportedMod,
  updatePakCategoryName,
  revertPakCategoryName,
  movePakCategory,
  deletePakCategory,
  toggleUncategorizedCollapsed,
  togglePakCategoryCollapsed,
  changePakModIcon,
  clearPakModIconForMod,
}: ModsSectionProps) {
  return (
    <section className="flex min-h-0 h-full flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ViewButton active={modsView === "pak"} onClick={() => onModsViewChange("pak")}>
            PAK Mods
          </ViewButton>

          <ViewButton active={modsView === "asi"} onClick={() => onModsViewChange("asi")}>
            ASI Mods
          </ViewButton>
        </div>

        <div className="flex">
          {modsView === "pak" && (
            <button
              title="Add mods category"
              onClick={onAddCategoryClick}
              className="text-sm p-1 text-zinc-400 hover:text-pink-600"
            >
              <AppIcon icon={Icons.layerGroup} />
            </button>
          )}

          <button
            title="Refresh mods data"
            onClick={onRefresh}
            className="text-sm p-1 text-zinc-400 hover:text-pink-600"
          >
            <AppIcon icon={Icons.refresh} />
          </button>
        </div>
      </div>

      {modsView === "pak" ? (
        <PakModsList
          pakModsWithoutCategory={pakModsWithoutCategory}
          pakCategories={pakCategories}
          allPakMods={visibleMods}
          selectedMods={selectedMods}
          draggedPakModName={draggedPakModName}
          categoryNameErrors={categoryNameErrors}
          collapsedUncategorized={collapsedUncategorized}
          collapsedPakCategories={collapsedPakCategories}
          onBeginPakDrag={onBeginPakDrag}
          toggleModSelection={toggleModSelection}
          getModStatus={getModStatus}
          removeImportedMod={removeImportedMod}
          updatePakCategoryName={updatePakCategoryName}
          revertPakCategoryName={revertPakCategoryName}
          movePakCategory={movePakCategory}
          deletePakCategory={deletePakCategory}
          toggleUncategorizedCollapsed={toggleUncategorizedCollapsed}
          togglePakCategoryCollapsed={togglePakCategoryCollapsed}
          changePakModIcon={changePakModIcon}
          clearPakModIconForMod={clearPakModIconForMod}
        />
      ) : visibleMods.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-500">
          No imported ASI mods yet
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
          {visibleMods.map((mod) => (
            <ModCard
              key={mod.name}
              mod={mod}
              selectedMods={selectedMods}
              toggleModSelection={toggleModSelection}
              getModStatus={getModStatus}
              removeImportedMod={removeImportedMod}
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
  onBeginPakDrag,
  toggleModSelection,
  getModStatus,
  removeImportedMod,
  updatePakCategoryName,
  revertPakCategoryName,
  movePakCategory,
  deletePakCategory,
  toggleUncategorizedCollapsed,
  togglePakCategoryCollapsed,
  changePakModIcon,
  clearPakModIconForMod,
}: Omit<ModsSectionProps, "modsView" | "visibleMods" | "onModsViewChange" | "onAddCategoryClick" | "onRefresh">) {

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
      return enabledCount === 1 ? "1 mod Enabled" : "1 mod Disabled"
    }

    if (enabledCount === 0) {
      return `All ${totalCount} mods Disabled`
    }

    if (enabledCount === totalCount) {
      return `All ${totalCount} mods Enabled`
    }

    return `${enabledCount} of ${totalCount} mods Enabled`
  }
  
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
      <div
        data-pak-category-id="uncategorized"
        className={`rounded-xl border border-dashed border-zinc-700 p-3 flex flex-col ${
          pakModsWithoutCategory.length > 0 ? "gap-2" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-400 p-1">
            Uncategorized
          </div>

          {pakModsWithoutCategory.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                title="Expand/Collapse"
                onClick={toggleUncategorizedCollapsed}
                className="flex rounded-lg text-xl text-zinc-300 hover:text-pink-500"
              >
                <div className="text-xs text-zinc-300">
                  {getCategoryEnabledText(pakModsWithoutCategory)}
                </div>

                <AppIcon
                  icon={collapsedUncategorized ? Icons.anglesDown : Icons.anglesUp}
                  className="pl-1 text-[16px]"
                />
              </button>

              <button
                onClick={() => toggleCategoryMods(pakModsWithoutCategory)}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {pakModsWithoutCategory.every((mod) => selectedMods.includes(mod.name))
                  ? "Deselect All"
                  : "Select All"}
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
                draggable
                onPointerDragStart={() => onBeginPakDrag(mod.name)}
                isDraggingThis={draggedPakModName === mod.name}
                selectedMods={selectedMods}
                toggleModSelection={toggleModSelection}
                getModStatus={getModStatus}
                removeImportedMod={removeImportedMod}
                changePakModIcon={changePakModIcon}
                clearPakModIconForMod={clearPakModIconForMod}
              />
            ))}
          </div>
        )}
      </div>

      {pakCategories.map((category, index) => {
      const categoryMods = category.modNames
        .map((name) => allPakMods.find((mod) => mod.name === name))
        .filter((mod): mod is ImportedMod => Boolean(mod))
      return (
        <div
          key={category.id}
          data-pak-category-id={category.id}
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
                title="Category Name"
                value={category.name}
                onChange={(e) => updatePakCategoryName(category.id, e.target.value)}
                onBlur={() => {
                  if (categoryNameErrors[category.id]) revertPakCategoryName(category.id)
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
                    title="Expand/Collapse"
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
                      className="pl-1 text-[16px]"
                    />
                  </button>

                  <button
                    onClick={() => toggleCategoryMods(categoryMods)}
                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    {categoryMods.every((mod) => selectedMods.includes(mod.name))
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </>
              )}

              <button
                onClick={() => deletePakCategory(category.id)}
                className="rounded-lg px-2 py-1 text-xs border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Remove Category
              </button>
            </div>
          </div>

          {!collapsedPakCategories[category.id] && (
            <div className="space-y-2">
              {category.modNames
                .map((name) => allPakMods.find((mod) => mod.name === name))
                .filter(Boolean)
                .map((mod) => {
                  if (!mod) return null

                  return (
                    <ModCard
                      key={mod.name}
                      mod={mod}
                      draggable
                      onPointerDragStart={() => onBeginPakDrag(mod.name)}
                      isDraggingThis={draggedPakModName === mod.name}
                      selectedMods={selectedMods}
                      toggleModSelection={toggleModSelection}
                      getModStatus={getModStatus}
                      removeImportedMod={removeImportedMod}
                      changePakModIcon={changePakModIcon}
                      clearPakModIconForMod={clearPakModIconForMod}
                    />
                  )
                })}
            </div>
          )}
        </div>
      )})}
    </div>
  )
}
