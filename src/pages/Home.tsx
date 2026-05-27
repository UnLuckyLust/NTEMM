import { useEffect, useState } from "react"
import { CategoryDialog } from "@/components/home/CategoryDialog"
import { DragPreview } from "@/components/home/DragPreview"
import { DropZone } from "@/components/home/DropZone"
import { ImportDialog } from "@/components/home/ImportDialog"
import { LastImportToast } from "@/components/home/LastImportToast"
import { LauncherBar } from "@/components/home/LauncherBar"
import { ModsSection } from "@/components/home/ModsSection"
import { useModManager } from "@/hooks/useModManager"
import { HudScaleCard } from "@/components/home/HudScaleCard"
import { AnticensorCard } from "@/components/home/AnticensorCard"
import { UiModsCard } from "@/components/home/UiModsCard"
import { HomeProps } from "@/interfaces/app"

export default function Home({ /* onOpenGameBanana */ }: HomeProps) {
  const { state, actions } = useModManager()
  const [gamePath, setGamePath] = useState(() => localStorage.getItem("gameFolder") ?? "")

  useEffect(() => {
    function refreshGamePath() {
      setGamePath(localStorage.getItem("gameFolder") ?? "")
    }

    window.addEventListener("gameFolderChanged", refreshGamePath)

    return () => {
      window.removeEventListener("gameFolderChanged", refreshGamePath)
    }
  }, [])
  
  return (
    <div className="relative flex h-full min-h-0 w-full items-center flex-col gap-2 overflow-hidden p-6">
      <LauncherBar
        canApplyChanges={actions.hasPendingChanges()}
        onApplyChanges={actions.applyModChanges}
        loaderInstalled={state.loaderCheck?.valid ?? false}
        onToggleLoaderFiles={actions.toggleLoaderFiles}
        onCleanGameMods={actions.cleanGameMods}
        onLaunchGame={actions.launchGame}
      />

      <DropZone
        isDragging={state.isDragging}
        isImporting={state.isImporting}
        isRunningAsAdmin={state.isRunningAsAdmin}
        onOpenImportFilePicker={actions.openImportFilePicker}
        onOpenImportFolderPicker={actions.openImportFolderPicker}
      />

      <div className="flex gap-2 overflow-hidden w-full h-full max-w-400">
        <div className="flex flex-col gap-2 min-w-110">
          <HudScaleCard gamePath={gamePath} />
          <AnticensorCard
            selected={state.anticensorSelected}
            status={actions.getBundledModStatus(
              state.anticensorInstalled,
              state.anticensorSelected,
            )}
            onToggle={() => actions.setAnticensorSelected((value) => !value)}
          />
          <UiModsCard
            hideUidSelected={state.hideUidSelected}
            // hidePingSelected={state.hidePingSelected}
            hideUidStatus={actions.getBundledModStatus(
              state.hideUidInstalled,
              state.hideUidSelected,
            )}
            // hidePingStatus={actions.getBundledModStatus(
            //   state.hidePingInstalled,
            //   state.hidePingSelected,
            // )}
            onToggleHideUid={() => actions.setHideUidSelected((value) => !value)}
            // onToggleHidePing={() => actions.setHidePingSelected((value) => !value)}
          />
        </div>

        <div className="flex flex-col w-full overflow-auto">
          <ModsSection
            modsView={state.modsView}
            visibleMods={state.visibleMods}
            pakModsWithoutCategory={state.pakModsWithoutCategory}
            allPakMods={state.visibleMods}
            pakCategories={state.pakCategories}
            selectedMods={state.selectedMods}
            draggedPakModName={state.draggedPakModName}
            categoryNameErrors={state.categoryNameErrors}
            collapsedUncategorized={state.collapsedUncategorized}
            collapsedPakCategories={state.collapsedPakCategories}
            onModsViewChange={actions.setModsView}
            onAddCategoryClick={() => actions.setShowCategoryDialog(true)}
            onRefresh={actions.refreshDetectedState}
            onBeginPakDrag={actions.beginInternalPakDrag}
            toggleModSelection={actions.toggleModSelection}
            getModStatus={actions.getModStatus}
            removeImportedMod={actions.removeImportedMod}
            updatePakCategoryName={actions.updatePakCategoryName}
            revertPakCategoryName={actions.revertPakCategoryName}
            movePakCategory={actions.movePakCategory}
            deletePakCategory={actions.deletePakCategory}
            toggleUncategorizedCollapsed={actions.toggleUncategorizedCollapsed}
            togglePakCategoryCollapsed={actions.togglePakCategoryCollapsed}
            changePakModIcon={actions.changePakModIcon}
            clearPakModIconForMod={actions.clearPakModIconForMod}
          />
        </div>
      </div>

      <CategoryDialog
        isOpen={state.showCategoryDialog}
        categoryName={state.newCategoryName}
        error={state.categoryDialogError}
        onCategoryNameChange={actions.setNewCategoryName}
        onClearError={() => actions.setCategoryDialogError("")}
        onConfirm={actions.addPakCategory}
        onClose={actions.closeCategoryDialog}
      />

      <ImportDialog
        isOpen={Boolean(state.pendingPaths)}
        modName={state.modName}
        isImporting={state.isImporting}
        onModNameChange={actions.setModName}
        onConfirm={actions.confirmImport}
        onClose={actions.closeImportDialog}
      />

      <LastImportToast lastImport={state.lastImport} showLastImport={state.showLastImport} />
      <DragPreview modName={state.draggedPakModName} />
    </div>
  )
}