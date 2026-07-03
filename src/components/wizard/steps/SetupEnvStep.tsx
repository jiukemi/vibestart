import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Zap } from "lucide-react";

import { GoalPathPanel } from "@/components/goal/GoalPathPanel";
import { GoalSwitcherDialog } from "@/components/goal/GoalSwitcherDialog";
import { Badge } from "@/components/ui/badge";
import { InstallProgressPanel } from "@/components/shared/InstallProgressPanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExpressIdePanel, isPrimaryIdeReady } from "@/components/wizard/ExpressIdePanel";
import { CodexBridgePanel } from "@/components/codex/CodexBridgePanel";
import { ToolsInstallDirPicker } from "@/components/tools/ToolsInstallDirPicker";
import { StepShell } from "@/components/wizard/StepShell";
import { getGoalLabel, getGoalTools } from "@/lib/build-goals";
import { needsCodexBridge } from "@/lib/codex-bridge";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { useInstallProgress } from "@/hooks/useInstallProgress";
import { getStepMeta } from "@/lib/wizard-index";
import type { CommandResult, OsInfo, ToolStatus } from "@/lib/tauri-types";
import { isExpressTrack } from "@/lib/wizard-flow";
import { useLoadingStore } from "@/stores/loadingStore";
import { useWizardStore } from "@/stores/wizardStore";

const step = getStepMeta("setup-env");

function isToolReady(status: ToolStatus | undefined, manualOnly?: boolean) {
  if (!status?.installed) return false;
  if (manualOnly) return true;
  return status.meets_minimum;
}

function statusEmoji(tool: ToolStatus): string {
  if (!tool.installed) return "❌";
  if (!tool.meets_minimum) return "⚠️";
  return "✅";
}

export function SetupEnvStep() {
  const buildGoal = useWizardStore((s) => s.selections.buildGoal);
  const appStack = useWizardStore((s) => s.selections.appStack);
  const wizardTrack = useWizardStore((s) => s.selections.wizardTrack);
  const primaryIde = useWizardStore((s) => s.selections.primaryIde);
  const llmProvider = useWizardStore((s) => s.selections.llmProvider);
  const startLoading = useLoadingStore((s) => s.start);
  const stopLoading = useLoadingStore((s) => s.stop);
  const { run: runOs, data: osInfo } = useTauriCommand<OsInfo>();
  const { run: runScan, loading: scanLoading, data: scanData } =
    useTauriCommand<ToolStatus[]>();
  const installCommand = useTauriCommand<CommandResult>();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [installLog, setInstallLog] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [goalSwitchOpen, setGoalSwitchOpen] = useState(false);
  const installBusy = installCommand.loading || batchRunning;
  const { progress, streamLog } = useInstallProgress(installBusy);
  const mergedInstallLog = [streamLog, installLog].filter(Boolean).join("\n\n");

  const goalTools = useMemo(
    () => getGoalTools(buildGoal, appStack),
    [buildGoal, appStack],
  );

  const goalToolIds = useMemo(
    () => new Set(goalTools.map((t) => t.id)),
    [goalTools],
  );

  const filteredScan = useMemo(
    () => scanData?.filter((t) => goalToolIds.has(t.name)) ?? [],
    [scanData, goalToolIds],
  );

  const rescan = useCallback(async () => {
    startLoading("正在扫描开发环境…");
    try {
      await runScan("scan_environment");
    } finally {
      stopLoading();
    }
  }, [runScan, startLoading, stopLoading]);

  useEffect(() => {
    void (async () => {
      startLoading("正在扫描开发环境…");
      try {
        await runOs("get_os_info");
        await runScan("scan_environment");
      } finally {
        stopLoading();
      }
    })();
  }, [runOs, runScan, startLoading, stopLoading]);

  const toolMap = useMemo(
    () => new Map(scanData?.map((tool) => [tool.name, tool]) ?? []),
    [scanData],
  );

  const installTool = useCallback(
    async (toolId: string) => {
      setActiveTool(toolId);
      setInstallLog(null);
      startLoading(`正在安装 ${toolId}…`);
      try {
        const result = await installCommand.run("install_tool", { tool: toolId });
        if (result) setInstallLog(result.log);
        await rescan();
      } finally {
        stopLoading();
      }
    },
    [installCommand, rescan, startLoading, stopLoading],
  );

  const installAllMissing = useCallback(async () => {
    setBatchRunning(true);
    setInstallLog(null);
    try {
      for (const tool of goalTools) {
        const status = toolMap.get(tool.id);
        if (isToolReady(status, tool.manualOnly)) continue;
        setActiveTool(tool.id);
        startLoading(`正在安装 ${tool.label}…`);
        try {
          const result = await installCommand.run("install_tool", { tool: tool.id });
          if (result) setInstallLog(result.log);
          await runScan("scan_environment");
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "安装失败，请查看日志或手动安装。";
          setInstallLog(message);
          break;
        } finally {
          stopLoading();
        }
      }
    } finally {
      setBatchRunning(false);
      setActiveTool(null);
    }
  }, [goalTools, installCommand, runScan, startLoading, stopLoading, toolMap]);

  const missingRequired = goalTools.filter(
    (t) => t.required && !isToolReady(toolMap.get(t.id), t.manualOnly),
  );
  const missingAny = goalTools.filter(
    (t) => !isToolReady(toolMap.get(t.id), t.manualOnly),
  );

  const expressMode = isExpressTrack(wizardTrack);
  const ideReady = isPrimaryIdeReady(primaryIde, scanData ?? undefined);
  const canProceed =
    missingRequired.length === 0 && (!expressMode || ideReady);

  const installIde = useCallback(
    async (installToolId: string) => {
      setActiveTool(installToolId);
      setInstallLog(null);
      startLoading(`正在安装 ${installToolId}…`);
      try {
        const result = await installCommand.run("install_tool", {
          tool: installToolId,
        });
        if (result) setInstallLog(result.log);
        await rescan();
      } finally {
        stopLoading();
        setActiveTool(null);
      }
    },
    [installCommand, rescan, startLoading, stopLoading],
  );

  return (
    <StepShell
      title={step.title}
      description={step.description}
      nextDisabled={!canProceed}
      nextLabel={
        isExpressTrack(wizardTrack) ? "下一步：配置 API Key" : "下一步"
      }
    >
      <GoalPathPanel
        buildGoal={buildGoal}
        appStack={appStack}
        compact
        onSwitch={() => setGoalSwitchOpen(true)}
      />

      <ToolsInstallDirPicker onSaved={() => void rescan()} />

      {scanLoading && !scanData && (
        <p className="text-sm text-muted-foreground">正在扫描开发环境…</p>
      )}

      {filteredScan.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filteredScan.map((tool) => (
            <Badge key={tool.name} variant="secondary" className="gap-1 capitalize">
              <span>{statusEmoji(tool)}</span>
              {tool.name}
            </Badge>
          ))}
        </div>
      )}

      {expressMode && (
        <ExpressIdePanel
          scanData={scanData ?? undefined}
          scanLoading={scanLoading}
          onInstall={installIde}
          installBusy={
            installCommand.loading &&
            activeTool !== null &&
            !goalTools.some((t) => t.id === activeTool)
          }
        />
      )}

      {needsCodexBridge(primaryIde, llmProvider) && (
        <CodexBridgePanel llmProvider={llmProvider} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>一键安装 · {getGoalLabel(buildGoal, appStack)}</CardTitle>
          <CardDescription>
            根据你的方向安装必要环境。无需打开终端，点击下方按钮即可。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {missingAny.length > 0 && (
            <Button
              type="button"
              disabled={installCommand.loading || batchRunning || scanLoading}
              onClick={() => void installAllMissing()}
            >
              <Zap className="size-4" />
              {batchRunning ? "正在安装…" : "一键安装全部缺失项"}
            </Button>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {goalTools.map((tool) => {
              const status = toolMap.get(tool.id);
              const ready = isToolReady(status, tool.manualOnly);
              const installing =
                activeTool === tool.id &&
                (installCommand.loading || batchRunning);

              return (
                <div
                  key={tool.id}
                  className="rounded-lg border border-border bg-card p-4 dark:bg-card/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {tool.label}
                        {tool.required && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            必需
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tool.description}
                      </p>
                      <p className="mt-2 text-xs">
                        {ready ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ✅ 已就绪
                            {status?.version ? ` · ${status.version}` : ""}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            ⚠️{" "}
                            {tool.manualOnly ? "需安装/打开下载页" : "未安装或版本过低"}
                          </span>
                        )}
                      </p>
                    </div>
                    {!ready && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={installCommand.loading || batchRunning}
                        onClick={() => void installTool(tool.id)}
                      >
                        {installing ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <Download className="size-4" />
                        )}
                        {installing
                          ? "处理中"
                          : tool.manualOnly
                            ? "打开下载"
                            : "一键安装"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {(installBusy || mergedInstallLog || installCommand.error) && (
            <InstallProgressPanel
              loading={installBusy}
              progress={progress}
              log={mergedInstallLog || installCommand.error}
            />
          )}

          {installCommand.error && !installLog && !streamLog && (
            <p className="text-sm text-destructive">{installCommand.error}</p>
          )}
        </CardContent>
      </Card>

      {osInfo && (
        <p className="text-xs text-muted-foreground">
          当前系统：{osInfo.platform} · 使用{" "}
          {osInfo.platform === "macos" ? "Homebrew" : "winget / npm"} 自动安装
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void rescan()}
          disabled={scanLoading}
        >
          {scanLoading ? "扫描中…" : "重新扫描"}
        </Button>
        {canProceed && scanData && (
          <span className="text-sm text-muted-foreground">
            ✅ 环境与编辑器已就绪，可进入下一步
          </span>
        )}
        {!canProceed && missingRequired.length === 0 && expressMode && !ideReady && scanData && (
          <span className="text-sm text-amber-600 dark:text-amber-400">
            请先安装所选 AI 编辑器
          </span>
        )}
      </div>
      <GoalSwitcherDialog
        open={goalSwitchOpen}
        onOpenChange={setGoalSwitchOpen}
      />
    </StepShell>
  );
}
