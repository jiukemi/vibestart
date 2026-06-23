import { StepShell } from "@/components/wizard/StepShell";
import { WIZARD_STEPS } from "@/lib/steps";

const step = WIZARD_STEPS[6];

export function FirstProjectStep() {
  return (
    <StepShell title={step.title} description={step.description}>
      <p className="text-sm text-muted-foreground">即将推出…</p>
    </StepShell>
  );
}
