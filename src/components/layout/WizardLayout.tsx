import { useState } from "react";
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TroubleshootPanel } from "@/components/layout/TroubleshootPanel";
import { StepNav } from "@/components/wizard/StepNav";
import { cn } from "@/lib/utils";

interface WizardLayoutProps {
  children: React.ReactNode;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function WizardLayout({
  children,
  isDark,
  onToggleTheme,
}: WizardLayoutProps) {
  const [troubleshootOpen, setTroubleshootOpen] = useState(false);

  return (
    <div className="flex h-svh bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <StepNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
          <p className="text-sm text-muted-foreground md:hidden">VibeStart</p>
          <div className="ml-auto">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={isDark ? "切换到明亮模式" : "切换到暗黑模式"}
              onClick={onToggleTheme}
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-2xl">{children}</div>
          </main>

          <aside
            className={cn(
              "hidden shrink-0 border-l border-border bg-muted/30 transition-[width] duration-200 lg:block",
              troubleshootOpen ? "w-64" : "w-10",
            )}
          >
            <div className="flex h-full flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="m-1 shrink-0"
                aria-label={
                  troubleshootOpen ? "收起故障排查面板" : "展开故障排查面板"
                }
                onClick={() => setTroubleshootOpen((v) => !v)}
              >
                {troubleshootOpen ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </Button>
              {troubleshootOpen && (
                <div className="flex min-h-0 flex-1 flex-col px-3 pb-4">
                  <TroubleshootPanel />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
