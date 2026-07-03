import { WIZARD_STEPS, type WizardStepId } from "@/lib/steps";
import { isDeployOnlyIntent } from "@/lib/wizard-intent";
import type { BuildGoal, WizardSelections, WizardTrack } from "@/stores/wizardStore";

export type { WizardTrack };

export type WizardFlowSelections = Pick<
  WizardSelections,
  "wizardTrack" | "buildGoal" | "userIntent"
>;

/** 静态网页方向：极速轨可走 Vercel 部署 */
export function isStaticWebGoal(goal: BuildGoal | null): boolean {
  return !goal || goal === "explore" || goal === "website";
}

export function isExpressTrack(track: WizardTrack | null | undefined): boolean {
  return (track ?? "express") === "express";
}

export function isStepVisible(
  stepId: WizardStepId,
  selections: WizardFlowSelections,
): boolean {
  if (isDeployOnlyIntent(selections.userIntent)) {
    switch (stepId) {
      case "choose-goal":
      case "setup-env":
      case "pick-ide":
      case "llm-api-key":
      case "git-hosting":
        return false;
      default:
        return true;
    }
  }

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
  selections: WizardFlowSelections,
): number[] {
  return WIZARD_STEPS.map((_, i) => i).filter((i) =>
    isStepVisible(WIZARD_STEPS[i].id, selections),
  );
}

export function getVisibleSteps(selections: WizardFlowSelections) {
  return WIZARD_STEPS.filter((step) => isStepVisible(step.id, selections));
}

export function getNextVisibleStepIndex(
  current: number,
  selections: WizardFlowSelections,
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
  selections: WizardFlowSelections,
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
  selections: WizardFlowSelections,
): boolean {
  return getNextVisibleStepIndex(current, selections) === current;
}

export function visibleStepCount(selections: WizardFlowSelections): number {
  return getVisibleStepIndices(selections).length;
}

export function expressStepCount(
  selections: Pick<WizardFlowSelections, "buildGoal" | "userIntent">,
): number {
  if (isDeployOnlyIntent(selections.userIntent)) {
    return visibleStepCount({
      userIntent: "deploy-only",
      wizardTrack: "express",
      buildGoal: "website",
    });
  }
  return getVisibleStepIndices({
    wizardTrack: "express",
    buildGoal: selections.buildGoal,
    userIntent: "fresh",
  }).length;
}

/** v6 前旧 10 步索引 → 新 9 步索引 */
export function migrateWizardStepIndex(oldIndex: number): number {
  if (oldIndex <= 1) return oldIndex;
  if (oldIndex === 2 || oldIndex === 3) return 2;
  if (oldIndex >= 4) return oldIndex - 1;
  return oldIndex;
}

/** v9：LLM API Key 与 Git 托管对调（原 4=git、5=llm → 新 4=llm、5=git） */
export function migrateWizardStepIndexV9(oldIndex: number): number {
  if (oldIndex === 4) return 5;
  if (oldIndex === 5) return 4;
  return oldIndex;
}
