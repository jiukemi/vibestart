import { useEffect, useMemo } from "react";
import { Loader2, Play, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLaunchIde } from "@/hooks/useLaunchIde";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { CodexBridgePanel } from "@/components/codex/CodexBridgePanel";
import { needsCodexBridge } from "@/lib/codex-bridge";
import { getIdeOption, getIdeScanKey, IDE_OPTIONS } from "@/lib/ide";
import {
  selectableCardClasses,
  selectableGridButtonClassName,
} from "@/lib/selectable-card";
import type { CodexBridgeHealth, ToolStatus } from "@/lib/tauri-types";
import { wizardStepIndex } from "@/lib/wizard-index";
import { useWizardStore } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

interface WorkbenchIdeLauncherProps {
  projectDir: string | null;
}

function isIdeInstalled(
  ideId: string,
  scanData: ToolStatus[] | undefined,
): boolean {
  const scanKey = getIdeScanKey(ideId);
  if (!scanKey || !scanData) return false;
  const status = scanData.find((t) => t.name === scanKey);
  return Boolean(status?.installed && status.meets_minimum);
}

export function WorkbenchIdeLauncher({ projectDir }: WorkbenchIdeLauncherProps) {
  const primaryIde = useWizardStore((s) => s.selections.primaryIde);
  const llmProvider = useWizardStore((s) => s.selections.llmProvider);
  const wizardTrack = useWizardStore((s) => s.selections.wizardTrack);
  const setSelection = useWizardStore((s) => s.setSelection);
  const openWizard = useWizardStore((s) => s.openWizard);

  const selected = primaryIde ?? "cursor";
  const selectedOption = getIdeOption(selected);

  const { run: runScan, loading: scanLoading, data: scanData } =
    useTauriCommand<ToolStatus[]>();
  const { launchIde, launching, launchError, dialog } = useLaunchIde();
  const healthCmd = useTauriCommand<CodexBridgeHealth>();

  const showCodexBridge = needsCodexBridge(selected, llmProvider);

  useEffect(() => {
    if (showCodexBridge) {
      void healthCmd.run("check_codex_bridge_health", {});
    }
  }, [healthCmd, showCodexBridge, selected]);

  useEffect(() => {
    void runScan("scan_environment");
  }, [runScan]);

  const selectedReady = useMemo(
    () => isIdeInstalled(selected, scanData ?? undefined),
    [selected, scanData],
  );

  const installStep =
    wizardTrack === "full"
      ? wizardStepIndex("pick-ide")
      : wizardStepIndex("setup-env");

  return (
    <>
      {dialog}
      <Card className="border-primary/25 bg-primary/5 dark:bg-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">启动编辑器</CardTitle>
          <CardDescription>
            选择要用的 AI 编辑器，在项目文件夹中打开。选择会同步到「主编辑器」配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {IDE_OPTIONS.map((ide) => {
              const isSelected = selected === ide.id;
              const installed = isIdeInstalled(ide.id, scanData ?? undefined);
              const isCli = ide.id === "claude-code" || ide.id === "codex";

              return (
                <button
                  key={ide.id}
                  type="button"
                  onClick={() => setSelection("primaryIde", ide.id)}
                  className={selectableGridButtonClassName("text-left")}
                >
                  <div
                    className={cn(
                      "rounded-xl border border-border bg-card p-3 transition-colors",
                      selectableCardClasses(isSelected),
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {ide.name}
                        {"default" in ide && ide.default && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            默认
                          </span>
                        )}
                      </p>
                      {isCli && (
                        <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {ide.description}
                    </p>
                    <p className="mt-2 text-xs">
                      {scanLoading ? (
                        <span className="text-muted-foreground">检测中…</span>
                      ) : installed ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          已安装
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          未检测到
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={launching || !projectDir}
              onClick={() => void launchIde(selected, projectDir)}
            >
              {launching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              用 {selectedOption.name} 打开项目
            </Button>
            {!projectDir && (
              <p className="text-xs text-muted-foreground">
                请先在向导中选定项目文件夹
              </p>
            )}
            {projectDir && !selectedReady && !scanLoading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openWizard(installStep)}
              >
                去安装 {selectedOption.name}
              </Button>
            )}
          </div>

          {showCodexBridge && (
            <div className="space-y-2">
              <CodexBridgePanel llmProvider={llmProvider} compact />
              {!healthCmd.data?.ready && !healthCmd.loading && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  桥接未就绪时 Codex 可能无法调用国产模型，但仍可尝试启动。
                </p>
              )}
            </div>
          )}

          {launchError && (
            <p className="text-sm text-destructive">{launchError}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
