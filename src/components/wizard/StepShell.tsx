import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/stores/wizardStore";
import { WIZARD_STEPS } from "@/lib/steps";

interface StepShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onNext?: () => void | Promise<void>;
  nextDisabled?: boolean;
  nextLabel?: string;
  hidePrev?: boolean;
  hideNext?: boolean;
}

export function StepShell({
  title,
  description,
  children,
  onNext,
  nextDisabled = false,
  nextLabel = "下一步",
  hidePrev = false,
  hideNext = false,
}: StepShellProps) {
  const currentStep = useWizardStore((s) => s.currentStep);
  const goPrev = useWizardStore((s) => s.goPrev);
  const goNext = useWizardStore((s) => s.goNext);
  const completeStep = useWizardStore((s) => s.completeStep);

  const handleNext = async () => {
    if (onNext) {
      await onNext();
    }
    completeStep(currentStep);
    goNext();
  };

  const isLast = currentStep >= WIZARD_STEPS.length - 1;

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6 space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">{children}</div>

      <footer className="mt-6 flex items-center justify-between border-t border-border pt-4">
        {!hidePrev && currentStep > 0 ? (
          <Button type="button" variant="outline" onClick={goPrev}>
            上一步
          </Button>
        ) : (
          <span />
        )}
        {!hideNext && !isLast && (
          <Button
            type="button"
            onClick={handleNext}
            disabled={nextDisabled}
          >
            {nextLabel}
          </Button>
        )}
      </footer>
    </div>
  );
}
