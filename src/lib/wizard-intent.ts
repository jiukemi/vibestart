import type { BuildGoal, GitProvider, UserIntent } from "@/stores/wizardStore";



export type { UserIntent };



export function isDeployOnlyIntent(

  userIntent: UserIntent | null | undefined,

): boolean {

  return userIntent === "deploy-only";

}



/** 已有项目部署轨：默认腾讯云网页托管（国内） */

export const DEPLOY_ONLY_DEFAULTS = {

  buildGoal: "website" as BuildGoal,

  deployTarget: "edgeone-pages",

  gitProvider: "skip" as GitProvider,

} as const;



export function applyDeployOnlyDefaults(

  setSelection: <K extends keyof import("@/stores/wizardStore").WizardSelections>(

    key: K,

    value: import("@/stores/wizardStore").WizardSelections[K],

  ) => void,

): void {

  setSelection("userIntent", "deploy-only");

  setSelection("buildGoal", DEPLOY_ONLY_DEFAULTS.buildGoal);

  setSelection("deployTarget", DEPLOY_ONLY_DEFAULTS.deployTarget);

  setSelection("gitProvider", DEPLOY_ONLY_DEFAULTS.gitProvider);

}

