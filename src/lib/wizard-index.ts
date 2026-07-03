import { WIZARD_STEPS, type WizardStep, type WizardStepId } from "@/lib/steps";

export function wizardStepIndex(id: WizardStepId): number {
  const index = WIZARD_STEPS.findIndex((s) => s.id === id);
  return index >= 0 ? index : 0;
}

export function getStepMeta(id: WizardStepId): WizardStep {
  return WIZARD_STEPS.find((s) => s.id === id) ?? WIZARD_STEPS[0];
}
