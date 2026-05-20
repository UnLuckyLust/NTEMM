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

export default function Home() {
  const { state, actions } = useModManager()

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-2 overflow-hidden p-6">
      <LauncherBar
        canApplyChanges={actions.hasPendingChanges()}
        onApplyChanges={actions.applyModChanges}
        loaderInstalled={state.loaderCheck?.valid ?? false}
        onToggleLoaderFiles={actions.toggleLoaderFiles}
        onLaunchGame={actions.launchGame}
      />

      <DropZone isDragging={state.isDragging} isImporting={state.isImporting} />

      <HudScaleCard />
      
      <AnticensorCard loaderInstalled={state.loaderCheck?.valid ?? false} />

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