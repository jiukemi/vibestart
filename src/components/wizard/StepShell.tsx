import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/stores/wizardStore";
import { isLastVisibleStep } from "@/lib/wizard-flow";

interface StepShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onNext?: () => void | boolean | Promise<void | boolean>;
  nextDisabled?: boolean;
  nextLabel?: string;
  hidePrev?: boolean;
  hideNext?: boolean;
  secondaryNext?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
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
  secondaryNext,
}: StepShellProps) {
  const currentStep = useWizardStore((s) => s.currentStep);
  const selections = useWizardStore((s) => s.selections);
  const goPrev = useWizardStore((s) => s.goPrev);
  const goNext = useWizardStore((s) => s.goNext);
  const completeStep = useWizardStore((s) => s.completeStep);

  const handleNext = async () => {
    if (onNext) {
      const result = await onNext();
      if (result === false) return;
    }
    completeStep(currentStep);
    goNext();
  };

  const isLast = isLastVisibleStep(currentStep, selections);

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6 space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <div className="min-h-0 flex-1 space-y-4">{children}</div>

      <footer className="mt-6 flex items-center justify-between border-t border-border pt-4">
        {!hidePrev && currentStep > 0 ? (
          <Button type="button" variant="outline" onClick={goPrev}>
            上一步
          </Button>
        ) : (
          <span />
        )}
        {!hideNext && !isLast && (
          <div className="flex flex-wrap items-center gap-2">
            {secondaryNext && (
              <Button
                type="button"
                variant="outline"
                onClick={secondaryNext.onClick}
                disabled={secondaryNext.disabled}
              >
                {secondaryNext.label}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleNext}
              disabled={nextDisabled}
            >
              {nextLabel}
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}
