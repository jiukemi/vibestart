import { StepShell } from "@/components/wizard/StepShell";
import { WIZARD_STEPS } from "@/lib/steps";

const step = WIZARD_STEPS[8];

export function CompleteStep() {
  return (
    <StepShell
      title={step.title}
      description={step.description}
      hideNext
    >
      <p className="text-sm text-muted-foreground">
        🎉 恭喜完成向导！你可以随时从左侧导航回顾各步骤。
      </p>
    </StepShell>
  );
}
