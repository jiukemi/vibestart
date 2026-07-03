import {
  Compass,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Package,
  Rocket,
  Settings2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { wizardStepIndex } from "@/lib/wizard-index";
import { useWizardStore } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

const QUICK_LINKS = [
  {
    id: "choose-goal",
    label: "开发方向",
    icon: Compass,
    step: wizardStepIndex("choose-goal"),
  },
  {
    id: "setup-env",
    label: "准备环境",
    icon: Package,
    step: wizardStepIndex("setup-env"),
  },
  {
    id: "first-project",
    label: "项目与模板",
    icon: Sparkles,
    step: wizardStepIndex("first-project"),
  },
  {
    id: "llm-api-key",
    label: "LLM API Key",
    icon: KeyRound,
    step: wizardStepIndex("llm-api-key"),
  },
  {
    id: "pick-ide",
    label: "编辑器",
    icon: Settings2,
    step: wizardStepIndex("pick-ide"),
  },
  {
    id: "deploy",
    label: "部署上线",
    icon: Rocket,
    step: wizardStepIndex("deploy"),
  },
] as const;

export function HomeNav() {
  const projectDir = useWizardStore((s) => s.selections.projectDir);
  const openWizard = useWizardStore((s) => s.openWizard);

  return (
    <nav className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-5">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-sidebar-foreground">
          <LayoutDashboard className="size-5 text-primary" />
          VibeStart
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">工作台</p>
      </div>

      {projectDir && (
        <div className="border-b border-sidebar-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">当前项目</p>
          <p
            className="mt-1 truncate text-xs text-sidebar-foreground"
            title={projectDir}
          >
            {projectDir}
          </p>
        </div>
      )}

      <ScrollArea className="flex-1 px-2 py-3">
        <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">
          快捷设置
        </p>
        <ul className="space-y-1">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.id}>
                <button
                  type="button"
                  onClick={() => openWizard(link.step)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  {link.label}
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={() => openWizard(wizardStepIndex("welcome"))}
        >
          <FolderKanban className="size-4" />
          打开完整向导
        </Button>
      </div>
    </nav>
  );
}
