type TechTreeModalScene = Phaser.Scene & {
  techTreeModal?: { isAlive?: () => boolean; destroy?: () => void } | null;
  _techTreeModalPromise?: Promise<unknown> | null;
};

export function hasPlanningUsableTechTreeModal(scene: TechTreeModalScene): boolean {
    if (!scene.techTreeModal) return false;
    if (typeof scene.techTreeModal.isAlive === "function") {
      return scene.techTreeModal.isAlive();
    }
    return true;
}

export function destroyPlanningTechTreeModal(scene: TechTreeModalScene): void {
    scene.techTreeModal?.destroy?.();
    scene.techTreeModal = null;
    scene._techTreeModalPromise = null;
}
