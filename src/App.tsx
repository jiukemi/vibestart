import { useCallback, useState } from "react";

import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HomeLayout } from "@/components/layout/HomeLayout";
import { WizardLayout } from "@/components/layout/WizardLayout";
import { WizardStepRenderer } from "@/components/wizard/WizardStepRenderer";
import { useTheme } from "@/hooks/useTheme";
import { WIZARD_STEPS } from "@/lib/steps";
import { useLoadingStore } from "@/stores/loadingStore";
import { useWizardStore } from "@/stores/wizardStore";

function App() {
  const { isDark, toggle } = useTheme();
  const appPhase = useWizardStore((s) => s.appPhase);
  const currentStep = useWizardStore((s) => s.currentStep);
  const openHome = useWizardStore((s) => s.openHome);
  const [stepRemountKey, setStepRemountKey] = useState(0);

  const safeStep = Math.max(0, Math.min(currentStep, WIZARD_STEPS.length - 1));
  const step = WIZARD_STEPS[safeStep] ?? WIZARD_STEPS[0];

  const handleRefreshStep = useCallback(() => {
    useLoadingStore.getState().reset();
    setStepRemountKey((k) => k + 1);
  }, []);

  if (appPhase === "home") {
    return (
      <HomeLayout isDark={isDark} onToggleTheme={toggle}>
        <HomeDashboard />
      </HomeLayout>
    );
  }

  return (
    <WizardLayout
      isDark={isDark}
      onToggleTheme={toggle}
      onRefreshStep={handleRefreshStep}
      onOpenHome={openHome}
    >
      <WizardStepRenderer
        key={`${step.id}-${stepRemountKey}`}
        stepId={step.id}
      />
    </WizardLayout>
  );
}

export default App;
