import { WelcomeStep } from "@/components/wizard/steps/WelcomeStep";
import { HealthCheckStep } from "@/components/wizard/steps/HealthCheckStep";
import { InstallToolsStep } from "@/components/wizard/steps/InstallToolsStep";
import { PickIdeStep } from "@/components/wizard/steps/PickIdeStep";
import { GithubSetupStep } from "@/components/wizard/steps/GithubSetupStep";
import { LlmApiKeyStep } from "@/components/wizard/steps/LlmApiKeyStep";
import { FirstProjectStep } from "@/components/wizard/steps/FirstProjectStep";
import { DeployStep } from "@/components/wizard/steps/DeployStep";
import { CompleteStep } from "@/components/wizard/steps/CompleteStep";

import type { WizardStepId } from "@/lib/steps";

const STEP_COMPONENTS: Record<WizardStepId, React.ComponentType> = {
  welcome: WelcomeStep,
  "health-check": HealthCheckStep,
  "install-tools": InstallToolsStep,
  "pick-ide": PickIdeStep,
  "github-setup": GithubSetupStep,
  "llm-api-key": LlmApiKeyStep,
  "first-project": FirstProjectStep,
  deploy: DeployStep,
  complete: CompleteStep,
};

export function WizardStepRenderer({ stepId }: { stepId: WizardStepId }) {
  const Component = STEP_COMPONENTS[stepId];
  return <Component />;
}
