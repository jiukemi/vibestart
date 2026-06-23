import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizardStore } from "@/stores/wizardStore";
import { WIZARD_STEPS } from "@/lib/steps";
import { cn } from "@/lib/utils";

const step = WIZARD_STEPS[3];

const IDE_OPTIONS = [
  {
    id: "cursor",
    name: "Cursor",
    description: "AI 原生 IDE，推荐默认选择",
    default: true,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic 命令行 AI 编程助手",
  },
  {
    id: "codex",
    name: "Codex",
    description: "OpenAI 代码生成工具",
  },
  {
    id: "tongyi",
    name: "通义灵码",
    description: "阿里云 AI 编程助手",
  },
  {
    id: "other",
    name: "其他",
    description: "使用其他 IDE 或编辑器",
  },
] as const;

export function PickIdeStep() {
  const primaryIde = useWizardStore((s) => s.selections.primaryIde);
  const setSelection = useWizardStore((s) => s.setSelection);
  const selected = primaryIde ?? "cursor";

  return (
    <StepShell
      title={step.title}
      description={step.description}
      nextDisabled={!selected}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {IDE_OPTIONS.map((ide) => {
          const isSelected = selected === ide.id;
          return (
            <button
              key={ide.id}
              type="button"
              onClick={() => setSelection("primaryIde", ide.id)}
              className="text-left"
            >
              <Card
                size="sm"
                className={cn(
                  "h-full cursor-pointer transition-colors hover:bg-muted/50",
                  isSelected && "ring-2 ring-primary",
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {ide.name}
                    {"default" in ide && ide.default && (
                      <span className="text-xs font-normal text-muted-foreground">
                        默认
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{ide.description}</CardDescription>
                </CardHeader>
              </Card>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
