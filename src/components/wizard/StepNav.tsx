import { Check, Circle, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getVisibleStepIndices } from "@/lib/wizard-flow";
import { WIZARD_STEPS } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizardStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function StepNav() {
  const currentStep = useWizardStore((s) => s.currentStep);
  const completedSteps = useWizardStore((s) => s.completedSteps);
  const selections = useWizardStore((s) => s.selections);
  const setCurrentStep = useWizardStore((s) => s.setCurrentStep);
  const enterHome = useWizardStore((s) => s.enterHome);
  const completeIndex = WIZARD_STEPS.length - 1;
  const canReturnHome = completedSteps.includes(completeIndex);

  const visibleIndices = getVisibleStepIndices(selections);
  const isExpress = selections.wizardTrack === "express";

  return (
    <nav className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-sidebar-foreground">
            VibeStart
          </h1>
          <Badge variant="secondary" className="text-[10px]">
            {isExpress ? "极速轨" : "完整轨"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isExpress
            ? `约 ${visibleIndices.length} 步 · 今晚做出可分享网页`
            : "完整向导 · IDE / Git / 部署"}
        </p>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <ol className="space-y-1">
          {visibleIndices.map((index, visIdx) => {
            const step = WIZARD_STEPS[index];
            const isActive = index === currentStep;
            const isCompleted = completedSteps.includes(index);
            const prevVisible = visibleIndices[visIdx - 1];
            const isAccessible =
              index <= currentStep ||
              (prevVisible !== undefined &&
                completedSteps.includes(prevVisible)) ||
              index === visibleIndices[0];

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

        {isExpress && (
          <p className="mt-4 px-3 text-xs text-muted-foreground">
            IDE、Git 等步骤已隐藏。编辑器在「准备环境」中确认；更多选项可在工作台补开。
          </p>
        )}
      </ScrollArea>

      {canReturnHome && (
        <div className="border-t border-sidebar-border p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={enterHome}
          >
            <LayoutDashboard className="size-4" />
            返回工作台
          </Button>
        </div>
      )}
    </nav>
  );
}