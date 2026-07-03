import { WIZARD_STEPS, type WizardStepId } from "@/lib/steps";
import type { BuildGoal, WizardSelections, WizardTrack } from "@/stores/wizardStore";

export type { WizardTrack };

/** 静态网页方向：极速轨可走 Vercel 部署 */
export function isStaticWebGoal(goal: BuildGoal | null): boolean {
  return !goal || goal === "explore" || goal === "website";
}

export function isExpressTrack(track: WizardTrack | null | undefined): boolean {
  return (track ?? "express") === "express";
}

export function isStepVisible(
  stepId: WizardStepId,
  selections: Pick<WizardSelections, "wizardTrack" | "buildGoal">,
): boolean {
  const track = selections.wizardTrack ?? "express";
  const goal = selections.buildGoal;

  if (track === "full") {
    return true;
  }

  switch (stepId) {
    case "pick-ide":
    case "git-hosting":
      return false;
    case "deploy":
      return isStaticWebGoal(goal);
    default:
      return true;
  }
}

export function getVisibleStepIndices(
  selections: Pick<WizardSelections, "wizardTrack" | "buildGoal">,
): number[] {
  return WIZARD_STEPS.map((_, i) => i).filter((i) =>
    isStepVisible(WIZARD_STEPS[i].id, selections),
  );
}

export function getVisibleSteps(
  selections: Pick<WizardSelections, "wizardTrack" | "buildGoal">,
) {
  return WIZARD_STEPS.filter((step) => isStepVisible(step.id, selections));
}

export function getNextVisibleStepIndex(
  current: number,
  selections: Pick<WizardSelections, "wizardTrack" | "buildGoal">,
): number {
  for (let i = current + 1; i < WIZARD_STEPS.length; i++) {
    if (isStepVisible(WIZARD_STEPS[i].id, selections)) {
      return i;
    }
  }
  return current;
}

export function getPrevVisibleStepIndex(
  current: number,
  selections: Pick<WizardSelections, "wizardTrack" | "buildGoal">,
): number {
  for (let i = current - 1; i >= 0; i--) {
    if (isStepVisible(WIZARD_STEPS[i].id, selections)) {
      return i;
    }
  }
  return current;
}

export function isLastVisibleStep(
  current: number,
  selections: Pick<WizardSelections, "wizardTrack" | "buildGoal">,
): boolean {
  return getNextVisibleStepIndex(current, selections) === current;
}

export function expressStepCount(
  selections: Pick<WizardSelections, "buildGoal">,
): number {
  return getVisibleStepIndices({
    wizardTrack: "express",
    buildGoal: selections.buildGoal,
  }).length;
}

/** v6 前旧 10 步索引 → 新 9 步索引 */
export function migrateWizardStepIndex(oldIndex: number): number {
  if (oldIndex <= 1) return oldIndex;
  if (oldIndex === 2 || oldIndex === 3) return 2;
  if (oldIndex >= 4) return oldIndex - 1;
  return oldIndex;
}
