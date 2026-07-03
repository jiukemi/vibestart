import { ChooseGoalStep } from "@/components/wizard/steps/ChooseGoalStep";
import { WelcomeStep } from "@/components/wizard/steps/WelcomeStep";
import { SetupEnvStep } from "@/components/wizard/steps/SetupEnvStep";
import { PickIdeStep } from "@/components/wizard/steps/PickIdeStep";
import { GitHostingStep } from "@/components/wizard/steps/GitHostingStep";
import { LlmApiKeyStep } from "@/components/wizard/steps/LlmApiKeyStep";
import { FirstProjectStep } from "@/components/wizard/steps/FirstProjectStep";
import { DeployStep } from "@/components/wizard/steps/DeployStep";
import { CompleteStep } from "@/components/wizard/steps/CompleteStep";

import type { WizardStepId } from "@/lib/steps";

const STEP_COMPONENTS: Record<WizardStepId, React.ComponentType> = {
  welcome: WelcomeStep,
  "choose-goal": ChooseGoalStep,
  "setup-env": SetupEnvStep,
  "pick-ide": PickIdeStep,
  "git-hosting": GitHostingStep,
  "llm-api-key": LlmApiKeyStep,
  "first-project": FirstProjectStep,
  deploy: DeployStep,
  complete: CompleteStep,
};

export function WizardStepRenderer({ stepId }: { stepId: WizardStepId }) {
  const Component = STEP_COMPONENTS[stepId];
  if (!Component) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        无法加载步骤「{stepId}」，请从左侧导航回到「欢迎」重新开始。
      </div>
    );
  }
  return <Component />;
}
