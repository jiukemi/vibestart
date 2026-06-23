import { WizardLayout } from "@/components/layout/WizardLayout";
import { WizardStepRenderer } from "@/components/wizard/WizardStepRenderer";
import { useTheme } from "@/hooks/useTheme";
import { WIZARD_STEPS } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizardStore";

function App() {
  const { isDark, toggle } = useTheme();
  const currentStep = useWizardStore((s) => s.currentStep);
  const step = WIZARD_STEPS[currentStep];

  return (
    <WizardLayout isDark={isDark} onToggleTheme={toggle}>
      <WizardStepRenderer stepId={step.id} />
    </WizardLayout>
  );
}

export default App;
