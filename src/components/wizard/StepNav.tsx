import { Check, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizardStore";
import { ScrollArea } from "@/components/ui/scroll-area";

export function StepNav() {
  const currentStep = useWizardStore((s) => s.currentStep);
  const completedSteps = useWizardStore((s) => s.completedSteps);
  const setCurrentStep = useWizardStore((s) => s.setCurrentStep);

  return (
    <nav className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-sidebar-foreground">
          VibeStart
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Vibe Coding 向导</p>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <ol className="space-y-1">
          {WIZARD_STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = completedSteps.includes(index);
            const isAccessible =
              index <= currentStep ||
              completedSteps.includes(index - 1) ||
              index === 0;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!isAccessible}
                  onClick={() => isAccessible && setCurrentStep(index)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                    !isAccessible && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                      isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : isActive
                          ? "border-primary text-primary"
                          : "border-muted-foreground/40 text-muted-foreground",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-3" />
                    ) : (
                      <Circle className="size-2 fill-current" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-tight">
                      {step.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {step.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </nav>
  );
}
