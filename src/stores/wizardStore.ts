import { create } from "zustand";
import { persist } from "zustand/middleware";

import { WIZARD_STEPS } from "@/lib/steps";

export interface WizardSelections {
  primaryIde: string | null;
  llmProvider: string | null;
  packId: string | null;
  deployTarget: string | null;
  projectDir: string | null;
  githubUsername: string | null;
}

interface WizardState {
  currentStep: number;
  completedSteps: number[];
  selections: WizardSelections;
  setCurrentStep: (step: number) => void;
  completeStep: (step: number) => void;
  goNext: () => void;
  goPrev: () => void;
  setSelection: <K extends keyof WizardSelections>(
    key: K,
    value: WizardSelections[K],
  ) => void;
}

const defaultSelections: WizardSelections = {
  primaryIde: null,
  llmProvider: "deepseek",
  packId: null,
  deployTarget: null,
  projectDir: null,
  githubUsername: null,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      completedSteps: [],
      selections: { ...defaultSelections },

      setCurrentStep: (step) => {
        const clamped = Math.max(0, Math.min(step, WIZARD_STEPS.length - 1));
        set({ currentStep: clamped });
      },

      completeStep: (step) => {
        set((state) => ({
          completedSteps: state.completedSteps.includes(step)
            ? state.completedSteps
            : [...state.completedSteps, step],
        }));
      },

      goNext: () => {
        const { currentStep } = get();
        if (currentStep < WIZARD_STEPS.length - 1) {
          set({ currentStep: currentStep + 1 });
        }
      },

      goPrev: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      setSelection: (key, value) => {
        set((state) => ({
          selections: { ...state.selections, [key]: value },
        }));
      },
    }),
    {
      name: "vibestart-wizard",
      partialize: (state) => ({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        selections: state.selections,
      }),
    },
  ),
);
