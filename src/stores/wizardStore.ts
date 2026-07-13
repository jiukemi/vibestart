import { create } from "zustand";
import { persist } from "zustand/middleware";

import { getGoalDefaults } from "@/lib/build-goals";
import { bridgeOptionForProvider, needsCodexBridge } from "@/lib/codex-bridge";
import type { DeployRecord } from "@/lib/deploy-records";
import { normalizeDeployShareUrl } from "@/lib/deploy-records";
import { WIZARD_STEPS } from "@/lib/steps";
import {
  getNextVisibleStepIndex,
  getPrevVisibleStepIndex,
  migrateWizardStepIndex,
  migrateWizardStepIndexV9,
} from "@/lib/wizard-flow";
import { wizardStepIndex } from "@/lib/wizard-index";

export type GitProvider = "github" | "skip";

/** 用户想做的产品类型 */
export type BuildGoal = "website" | "miniprogram" | "app" | "explore";
export type AppStack = "hybrid" | "native";

/** express = 极速轨（默认）；full = 完整 9 步含 IDE / Git */
export type WizardTrack = "express" | "full";

/** fresh = 从零向导；deploy-only = 已有项目，直接部署 */
export type UserIntent = "fresh" | "deploy-only";

export interface WizardSelections {
  userIntent: UserIntent;
  wizardTrack: WizardTrack;
  buildGoal: BuildGoal | null;
  appStack: AppStack | null;
  primaryIde: string | null;
  llmProvider: string | null;
  packId: string | null;
  gitProvider: GitProvider | null;
  deployTarget: string | null;
  projectDir: string | null;
  githubUsername: string | null;
  githubRepoName: string | null;
  edgeoneApiToken: string | null;
  cloudflareApiToken: string | null;
  cloudflareAccountId: string | null;
  vercelUsername: string | null;
  deployUrl: string | null;
  llmSyncTargets: string[];
  backendAssistEnabled: boolean;
  backendProviderId: string | null;
  /** Codex + 国产 LLM 时的桥接模式 */
  codexBridgeMode: import("@/lib/codex-bridge").CodexBridgeMode | null;
}

interface WizardState {
  currentStep: number;
  completedSteps: number[];
  appPhase: "wizard" | "home";
  selections: WizardSelections;
  deployHistory: DeployRecord[];
  setCurrentStep: (step: number) => void;
  completeStep: (step: number) => void;
  goNext: () => void;
  goPrev: () => void;
  setSelection: <K extends keyof WizardSelections>(
    key: K,
    value: WizardSelections[K],
  ) => void;
  addDeployRecord: (record: DeployRecord) => void;
  removeDeployRecord: (id: string) => void;
  updateDeployRecord: (id: string, patch: Partial<Pick<DeployRecord, "url" | "altUrls" | "log" | "success">>) => void;
  /** 切换向导轨；完整轨且尚未确认方向时清空 buildGoal，避免沿用迁移默认 explore */
  setWizardTrack: (track: WizardTrack) => void;
  enterHome: () => void;
  /** 进入工作台，不标记向导已完成（可随时从向导顶栏进入） */
  openHome: () => void;
  openWizard: (stepIndex?: number) => void;
  resetForNewProject: () => void;
  /** 切换开发方向：重置环境/模板/部署等下游进度，返回是否实际变更 */
  switchBuildGoal: (
    goal: BuildGoal,
    appStack: AppStack | null,
    options?: { navigateToSetup?: boolean },
  ) => boolean;
}

const defaultSelections: WizardSelections = {
  userIntent: "fresh",
  wizardTrack: "express",
  buildGoal: null,
  appStack: null,
  primaryIde: "cursor",
  llmProvider: null,
  packId: null,
  gitProvider: "skip",
  deployTarget: "edgeone-pages",
  projectDir: null,
  githubUsername: null,
  githubRepoName: "my-vibe-project",
  edgeoneApiToken: null,
  cloudflareApiToken: null,
  cloudflareAccountId: null,
  vercelUsername: null,
  deployUrl: null,
  llmSyncTargets: [],
  backendAssistEnabled: false,
  backendProviderId: null,
  codexBridgeMode: null,
};

function mergeSelections(
  partial?: Partial<WizardSelections>,
): WizardSelections {
  return {
    ...defaultSelections,
    ...partial,
    llmSyncTargets: partial?.llmSyncTargets ?? [],
    userIntent: partial?.userIntent ?? defaultSelections.userIntent,
    wizardTrack: partial?.wizardTrack ?? defaultSelections.wizardTrack,
    backendAssistEnabled:
      partial?.backendAssistEnabled ?? defaultSelections.backendAssistEnabled,
    backendProviderId:
      partial?.backendProviderId ?? defaultSelections.backendProviderId,
    codexBridgeMode:
      partial?.codexBridgeMode ?? defaultSelections.codexBridgeMode,
    gitProvider: partial?.gitProvider ?? defaultSelections.gitProvider,
    buildGoal: partial?.buildGoal ?? defaultSelections.buildGoal,
    appStack: partial?.appStack ?? defaultSelections.appStack,
    primaryIde: partial?.primaryIde ?? defaultSelections.primaryIde,
    deployTarget: partial?.deployTarget ?? defaultSelections.deployTarget,
  };
}

function clampStep(step: number | undefined): number {
  const index = step ?? 0;
  return Math.max(0, Math.min(index, WIZARD_STEPS.length - 1));
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      completedSteps: [],
      appPhase: "wizard",
      selections: { ...defaultSelections },
      deployHistory: [],

      setCurrentStep: (step) => {
        set({ currentStep: clampStep(step) });
      },

      completeStep: (step) => {
        set((state) => ({
          completedSteps: state.completedSteps.includes(step)
            ? state.completedSteps
            : [...state.completedSteps, step],
        }));
      },

      goNext: () => {
        const { currentStep, selections } = get();
        const next = getNextVisibleStepIndex(currentStep, selections);
        if (next !== currentStep) {
          set({ currentStep: next });
        }
      },

      goPrev: () => {
        const { currentStep, selections } = get();
        const prev = getPrevVisibleStepIndex(currentStep, selections);
        if (prev !== currentStep) {
          set({ currentStep: prev });
        }
      },

      setSelection: (key, value) => {
        set((state) => ({
          selections: mergeSelections({
            ...state.selections,
            [key]: value,
          }),
        }));
      },

      addDeployRecord: (record) => {
        set((state) => ({
          deployHistory: [record, ...state.deployHistory].slice(0, 50),
        }));
      },

      removeDeployRecord: (id) => {
        set((state) => ({
          deployHistory: state.deployHistory.filter((r) => r.id !== id),
        }));
      },

      updateDeployRecord: (id, patch) => {
        set((state) => ({
          deployHistory: state.deployHistory.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...patch,
                  url:
                    patch.url !== undefined
                      ? normalizeDeployShareUrl(patch.url)
                      : r.url,
                  altUrls:
                    patch.altUrls !== undefined
                      ? patch.altUrls
                          .map((u) => normalizeDeployShareUrl(u))
                          .filter((u): u is string => Boolean(u))
                      : r.altUrls,
                }
              : r,
          ),
        }));
      },

      setWizardTrack: (track) => {
        set((state) => {
          const chooseIdx = wizardStepIndex("choose-goal");
          const goalNotLocked = !state.completedSteps.includes(chooseIdx);
          return {
            selections: mergeSelections({
              ...state.selections,
              wizardTrack: track,
              ...(track === "full" && goalNotLocked
                ? { buildGoal: null, appStack: null }
                : {}),
            }),
          };
        });
      },

      enterHome: () => {
        const completeIndex = WIZARD_STEPS.length - 1;
        set((state) => ({
          appPhase: "home",
          completedSteps: state.completedSteps.includes(completeIndex)
            ? state.completedSteps
            : [...state.completedSteps, completeIndex],
        }));
      },

      openHome: () => {
        set({ appPhase: "home" });
      },

      openWizard: (stepIndex) => {
        set((state) => ({
          appPhase: "wizard",
          currentStep: clampStep(stepIndex ?? state.currentStep),
        }));
      },

      resetForNewProject: () => {
        set({
          appPhase: "wizard",
          currentStep: wizardStepIndex("first-project"),
          selections: {
            ...get().selections,
            packId: null,
            deployTarget: "vercel",
            projectDir: null,
            deployUrl: null,
          },
        });
      },

      switchBuildGoal: (goal, appStack, options) => {
        const state = get();
        const prev = state.selections;
        const changed =
          prev.buildGoal !== goal || prev.appStack !== appStack;

        const defaults = getGoalDefaults(goal, appStack);
        // 小程序/App 强制完整轨；网页方向保留欢迎页已选的轨（完整轨可选 IDE/Git）
        const wizardTrack: WizardTrack =
          goal === "miniprogram" || goal === "app" ? "full" : prev.wizardTrack;

        const chooseIdx = wizardStepIndex("choose-goal");
        const setupIdx = wizardStepIndex("setup-env");
        const hadDownstreamProgress = state.completedSteps.some(
          (i) => i > chooseIdx,
        );
        const navigateToSetup =
          options?.navigateToSetup ?? (changed && hadDownstreamProgress);

        set({
          appPhase: "wizard",
          currentStep: changed
            ? navigateToSetup
              ? setupIdx
              : Math.min(state.currentStep, chooseIdx)
            : state.currentStep,
          completedSteps: changed
            ? state.completedSteps.filter((i) => i <= chooseIdx)
            : state.completedSteps,
          selections: mergeSelections({
            ...prev,
            buildGoal: goal,
            appStack,
            wizardTrack,
            deployTarget: defaults.deployTarget,
            gitProvider: defaults.gitProvider,
            ...(changed
              ? {
                  packId: null,
                  deployUrl: null,
                  backendAssistEnabled: false,
                  backendProviderId: null,
                }
              : {}),
            primaryIde: prev.primaryIde ?? "cursor",
          }),
        });

        return changed;
      },
    }),
    {
      name: "vibestart-wizard",
      version: 15,
      migrate: (persistedState, fromVersion) => {
        const state = persistedState as Partial<WizardState>;
        const maxStep = WIZARD_STEPS.length - 1;

        if (fromVersion < 14) {
          state.deployHistory = [];
        }

        if (fromVersion < 3) {
          if (typeof state.currentStep === "number" && state.currentStep >= 1) {
            state.currentStep += 1;
          }
          if (Array.isArray(state.completedSteps)) {
            state.completedSteps = state.completedSteps.map((i) =>
              i >= 1 ? i + 1 : i,
            );
          }
        }

        if (fromVersion < 4 && state.selections) {
          if (!state.selections.buildGoal) {
            state.selections.buildGoal = "explore";
          }
          const goal = state.selections.buildGoal;
          const stack = state.selections.appStack ?? null;
          if (goal) {
            const defaults = getGoalDefaults(goal, stack);
            state.selections.deployTarget = defaults.deployTarget;
            state.selections.gitProvider = defaults.gitProvider;
          }
        }

        if (fromVersion < 5 && state.selections) {
          if (state.selections.backendAssistEnabled === undefined) {
            state.selections.backendAssistEnabled = false;
          }
          if (state.selections.backendProviderId === undefined) {
            state.selections.backendProviderId = null;
          }
        }

        if (fromVersion < 6) {
          if (typeof state.currentStep === "number") {
            state.currentStep = migrateWizardStepIndex(state.currentStep);
          }
          if (Array.isArray(state.completedSteps)) {
            state.completedSteps = [
              ...new Set(
                state.completedSteps.map((i) => migrateWizardStepIndex(i)),
              ),
            ];
          }
          if (state.selections) {
            if (!state.selections.wizardTrack) {
              const goal = state.selections.buildGoal;
              state.selections.wizardTrack =
                goal === "miniprogram" || goal === "app" ? "full" : "express";
            }
            if (!state.selections.primaryIde) {
              state.selections.primaryIde = "cursor";
            }
          }
        }

        if (fromVersion < 8 && state.selections) {
          const llmStepIdx = wizardStepIndex("llm-api-key");
          const completed = state.completedSteps ?? [];
          if (!completed.includes(llmStepIdx)) {
            state.selections.llmProvider = null;
          }
        }

        if (fromVersion < 15 && state.selections) {
          const sel = state.selections as unknown as Record<string, unknown>;
          if (sel.cloudflareAccountId === undefined) {
            sel.cloudflareAccountId = null;
          }
        }

        if (fromVersion < 13 && state.selections) {
          const sel = state.selections as unknown as Record<string, unknown>;
          if (sel.vercelUsername === undefined) {
            sel.vercelUsername = null;
          }
        }

        if (fromVersion < 12 && state.selections) {
          const sel = state.selections as unknown as Record<string, unknown>;
          if (sel.deployTarget === "jihulab-pages") {
            sel.deployTarget = "edgeone-pages";
          }
          if (sel.gitProvider === "jihulab") {
            sel.gitProvider = "skip";
          }
          if (sel.edgeoneApiToken === undefined) {
            sel.edgeoneApiToken = null;
          }
          if (sel.cloudflareApiToken === undefined) {
            sel.cloudflareApiToken = null;
          }
          delete sel.jihulabUsername;
        }

        if (fromVersion < 11 && state.selections) {
          const sel = state.selections as unknown as Record<string, unknown>;
          if (sel.gitProvider === "gitee") {
            sel.gitProvider = "jihulab";
          }
          if (sel.deployTarget === "gitee-pages") {
            sel.deployTarget = "jihulab-pages";
          }
          if (typeof sel.giteeUsername === "string" && !sel.jihulabUsername) {
            sel.jihulabUsername = sel.giteeUsername;
          }
        }

        if (fromVersion < 10 && state.selections) {
          if (!state.selections.userIntent) {
            state.selections.userIntent = "fresh";
          }
        }

        if (fromVersion < 9) {
          if (typeof state.currentStep === "number") {
            state.currentStep = migrateWizardStepIndexV9(state.currentStep);
          }
          if (Array.isArray(state.completedSteps)) {
            state.completedSteps = [
              ...new Set(
                state.completedSteps.map((i) => migrateWizardStepIndexV9(i)),
              ),
            ];
          }
        }

        if (fromVersion < 7 && state.selections) {
          if (state.selections.codexBridgeMode === undefined) {
            const ide = state.selections.primaryIde;
            const llm = state.selections.llmProvider;
            state.selections.codexBridgeMode = needsCodexBridge(ide, llm)
              ? bridgeOptionForProvider(llm)
              : null;
          }
        }

        if (typeof state.currentStep === "number") {
          state.currentStep = Math.max(0, Math.min(state.currentStep, maxStep));
        }
        if (Array.isArray(state.completedSteps)) {
          state.completedSteps = [
            ...new Set(
              state.completedSteps
                .filter((i) => i >= 0 && i <= maxStep)
                .map((i) => Math.min(i, maxStep)),
            ),
          ];
        }

        return state as WizardState;
      },
      partialize: (state) => ({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        appPhase: state.appPhase,
        selections: state.selections,
        deployHistory: state.deployHistory,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<WizardState> | undefined;
        if (!saved) return current;
        return {
          ...current,
          ...saved,
          currentStep: clampStep(saved.currentStep),
          completedSteps: saved.completedSteps ?? current.completedSteps,
          appPhase: saved.appPhase ?? current.appPhase,
          deployHistory: saved.deployHistory ?? current.deployHistory,
          selections: mergeSelections(saved.selections),
        };
      },
    },
  ),
);

export function applyBuildGoal(
  _setSelection: WizardState["setSelection"],
  goal: BuildGoal,
  appStack: AppStack | null,
) {
  useWizardStore.getState().switchBuildGoal(goal, appStack);
}
