import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Route,
  Zap,
} from "lucide-react";

import { CommandOutput } from "@/components/shared/CommandOutput";
import { InstallProgressPanel } from "@/components/shared/InstallProgressPanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import { useOsInfo } from "@/hooks/useOsInfo";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { useInstallProgress } from "@/hooks/useInstallProgress";
import {
  listBridgeOptionsForProvider,
  type CodexBridgeMode,
} from "@/lib/codex-bridge";
import {
  codexFlowSummary,
  computeCodexFlowSteps,
  type CodexFlowAction,
  type CodexWizardPhase,
} from "@/lib/codex-flow";
import { selectableCardClasses } from "@/lib/selectable-card";
import type {
  CodexBridgeHealth,
  CommandResult,
  ToolStatus,
} from "@/lib/tauri-types";
import { useWizardStore } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

const MANUAL_LINKS = {
  ccSwitch: "https://ccswitch.io",
  ccSwitchGithub: "https://github.com/farion1231/cc-switch",
  codexBridge: "https://github.com/xiaoshaoning/codex-bridge",
} as const;

interface CodexBridgePanelProps {
  llmProvider: string | null;
  /** 向导阶段：pick-ide 仅安装；llm-api-key 启动桥接 */
  phase?: CodexWizardPhase;
  /** 父级已扫描时传入，避免重复请求 */
  toolMap?: Map<string, ToolStatus>;
  onRescan?: () => void | Promise<void>;
  /** LLM 步骤 Key 是否已验证 */
  apiKeyReady?: boolean;
  compact?: boolean;
  className?: string;
}

export function CodexBridgePanel({
  llmProvider,
  phase = "pick-ide",
  toolMap: toolMapProp,
  onRescan,
  apiKeyReady = false,
  compact = false,
  className,
}: CodexBridgePanelProps) {
  const { platform } = useOsInfo();
  const codexBridgeMode = useWizardStore((s) => s.selections.codexBridgeMode);
  const setSelection = useWizardStore((s) => s.setSelection);

  const [installLog, setInstallLog] = useState<string | null>(null);
  const [startLog, setStartLog] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const modeInitializedRef = useRef(false);

  const { run: loadConfig, data: savedConfig } =
    useTauriCommand<{
      mode: string;
      cc_switch_port: number;
      deepseek_bridge_port: number;
    }>();
  const { run: saveConfig } = useTauriCommand<void>();
  const {
    run: runHealthCheck,
    loading: healthLoading,
    data: health,
  } = useTauriCommand<CodexBridgeHealth>();
  const { run: runScan, data: scanData } = useTauriCommand<ToolStatus[]>();
  const installCmd = useTauriCommand<CommandResult>();
  const startBridgeCmd = useTauriCommand<CommandResult>();
  const openCcSwitchCmd = useTauriCommand<void>();
  const installCodexCmd = useTauriCommand<CommandResult>();
  const localizeCodexCmd = useTauriCommand<CommandResult>();

  const { open: openBrowser, openGuide } = useOpenInAppBrowser();

  const mode: CodexBridgeMode = codexBridgeMode ?? "cc-switch";

  const toolMap = useMemo(() => {
    if (toolMapProp) return toolMapProp;
    return new Map(scanData?.map((t) => [t.name, t]) ?? []);
  }, [toolMapProp, scanData]);

  const refreshHealth = useCallback(async () => {
    await runHealthCheck("check_codex_bridge_health", { mode });
  }, [runHealthCheck, mode]);

  const rescanAll = useCallback(async () => {
    if (onRescan) {
      await onRescan();
    } else {
      await runScan("scan_environment");
    }
    await refreshHealth();
  }, [onRescan, refreshHealth, runScan]);

  const persistMode = useCallback(
    async (nextMode: CodexBridgeMode) => {
      setSelection("codexBridgeMode", nextMode);
      await saveConfig("save_codex_bridge_config", { mode: nextMode });
      await runHealthCheck("check_codex_bridge_health", { mode: nextMode });
    },
    [runHealthCheck, saveConfig, setSelection],
  );

  useEffect(() => {
    void loadConfig("get_codex_bridge_config").finally(() => setConfigLoaded(true));
  }, [loadConfig]);

  useEffect(() => {
    if (!toolMapProp) {
      void runScan("scan_environment");
    }
  }, [runScan, toolMapProp]);

  /** 仅从磁盘配置初始化一次，避免用户切换后被旧 savedConfig 覆盖 */
  useEffect(() => {
    if (!configLoaded || modeInitializedRef.current) return;
    modeInitializedRef.current = true;

    const available = listBridgeOptionsForProvider(llmProvider);
    const saved = savedConfig?.mode as CodexBridgeMode | undefined;
    const savedOk = saved && available.some((o) => o.id === saved);

    if (savedOk) {
      setSelection("codexBridgeMode", saved);
    } else if (codexBridgeMode && available.some((o) => o.id === codexBridgeMode)) {
      return;
    } else if (!codexBridgeMode) {
      void persistMode("cc-switch");
    }
  }, [
    configLoaded,
    codexBridgeMode,
    llmProvider,
    persistMode,
    savedConfig?.mode,
    setSelection,
  ]);

  /** LLM 选定后，DeepSeek 默认轻量桥；用户仍可改选 CC Switch */
  useEffect(() => {
    if (!configLoaded || !llmProvider) return;
    const available = listBridgeOptionsForProvider(llmProvider);
    if (available.length === 0) return;
    const current = codexBridgeMode ?? mode;
    if (!available.some((o) => o.id === current)) {
      void persistMode(available[0]!.id);
      return;
    }
    if (
      llmProvider === "deepseek" &&
      phase === "llm-api-key" &&
      !codexBridgeMode &&
      !savedConfig?.mode
    ) {
      void persistMode("deepseek-bridge");
    }
  }, [
    configLoaded,
    codexBridgeMode,
    llmProvider,
    mode,
    persistMode,
    phase,
    savedConfig?.mode,
  ]);

  useEffect(() => {
    void refreshHealth();
  }, [mode, refreshHealth]);

  const flowSteps = useMemo(
    () =>
      computeCodexFlowSteps({
        mode,
        phase,
        toolMap,
        bridgeReady: Boolean(health?.ready),
        apiKeyReady,
        llmProvider,
      }),
    [apiKeyReady, health?.ready, llmProvider, mode, phase, toolMap],
  );

  const summary = codexFlowSummary(flowSteps);
  const activeStep = flowSteps.find((s) => s.status === "active");

  const installBridgeTool = async () => {
    setInstallLog(null);
    const tool = mode === "deepseek-bridge" ? "codex-bridge" : "cc-switch";
    const result = await installCmd.run("install_tool", { tool });
    if (result) {
      setInstallLog(result.log);
      setTimeout(() => void rescanAll(), 1500);
    } else if (installCmd.error) {
      setInstallLog(installCmd.error);
    }
  };

  const installCodexApp = async () => {
    setInstallLog(null);
    const result = await installCodexCmd.run("install_tool", { tool: "codex" });
    if (result) {
      setInstallLog(result.log);
      setTimeout(() => void rescanAll(), 1500);
    } else if (installCodexCmd.error) {
      setInstallLog(installCodexCmd.error);
    }
  };

  const localizeCodexApp = async () => {
    setInstallLog(null);
    const result = await localizeCodexCmd.run("localize_codex_app");
    if (result) {
      setInstallLog(result.log);
    } else if (localizeCodexCmd.error) {
      setInstallLog(localizeCodexCmd.error);
    }
  };

  const startBridge = async () => {
    setStartLog(null);
    const result = await startBridgeCmd.run("start_deepseek_bridge");
    if (result) {
      setStartLog(result.log);
      setTimeout(() => void refreshHealth(), 1500);
    } else if (startBridgeCmd.error) {
      setStartLog(startBridgeCmd.error);
    }
  };

  const runFlowAction = (action: CodexFlowAction) => {
    switch (action) {
      case "install-codex":
        void installCodexApp();
        break;
      case "localize-codex":
        void localizeCodexApp();
        break;
      case "install-bridge":
        void installBridgeTool();
        break;
      case "start-bridge":
        void startBridge();
        break;
      case "open-cc-switch":
        void openCcSwitchCmd.run("open_cc_switch_app");
        break;
      case "refresh-health":
        void refreshHealth();
        break;
    }
  };

  const visibleOptions = useMemo(
    () => listBridgeOptionsForProvider(llmProvider),
    [llmProvider],
  );

  const canPickMode = visibleOptions.length > 1;

  const actionBusy =
    installCmd.loading ||
    installCodexCmd.loading ||
    localizeCodexCmd.loading ||
    startBridgeCmd.loading;

  const progressActive =
    installCmd.loading || installCodexCmd.loading || localizeCodexCmd.loading;
  const { progress, streamLog } = useInstallProgress(progressActive);
  const mergedInstallLog = [streamLog, installLog].filter(Boolean).join("\n\n");

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm dark:bg-muted/20",
          className,
        )}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <Route className="size-4 shrink-0" />
          Codex 桥接
          {health?.ready ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              已就绪
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">未就绪</span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={healthLoading}
          onClick={() => void rescanAll()}
        >
          {healthLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          检测
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn("border-dashed border-primary/30", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="size-4 text-primary" />
          Codex 配置清单
        </CardTitle>
        <CardDescription>
          Codex 比其它 IDE 步骤更多：按顺序完成安装与桥接。选 OpenAI 官方 API
          可在 LLM 步骤跳过桥接。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canPickMode ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleOptions.map((opt) => {
              const isSelected = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => void persistMode(opt.id)}
                  className="text-left"
                >
                  <div
                    className={cn(
                      "rounded-xl border border-border bg-card p-3 transition-colors",
                      selectableCardClasses(isSelected),
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {opt.title}
                      {opt.recommended && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          推荐
                        </span>
                      )}
                      {isSelected && (
                        <span className="ml-1 text-xs font-normal text-primary">
                          已选
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : visibleOptions[0] ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground dark:bg-muted/20">
            桥接方式：
            <span className="font-medium text-foreground">
              {visibleOptions[0].title}
            </span>
            （当前 LLM 仅支持此方式）
          </p>
        ) : null}

        {summary && (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              flowSteps.every((s) => s.status === "done")
                ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
                : "border-primary/30 bg-primary/5 dark:bg-primary/10",
            )}
          >
            <p className="font-medium text-foreground">{summary}</p>
          </div>
        )}

        <ol className="space-y-3">
          {flowSteps.map((step) => {
            const isActive = step.status === "active";
            const isDone = step.status === "done";
            return (
              <li
                key={step.id}
                className={cn(
                  "flex gap-3 rounded-lg border p-3 text-sm transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                    : isDone
                      ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-border bg-muted/20 opacity-80 dark:bg-muted/10",
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                  ) : isActive ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      →
                    </span>
                  ) : (
                    <Circle className="size-5 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="font-medium text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  {((isActive && step.action) ||
                    (step.secondaryAction &&
                      (isDone || isActive))) && (
                    <div className="flex flex-wrap gap-2">
                      {isActive && step.action && step.actionLabel && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={actionBusy}
                          onClick={() => runFlowAction(step.action!)}
                        >
                          {actionBusy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : step.action === "start-bridge" ? (
                            <Play className="size-4" />
                          ) : (
                            <Zap className="size-4" />
                          )}
                          {step.actionLabel}
                        </Button>
                      )}
                      {step.secondaryAction && step.secondaryActionLabel && (
                        <Button
                          type="button"
                          size="sm"
                          variant={isDone ? "default" : "outline"}
                          disabled={actionBusy}
                          onClick={() => runFlowAction(step.secondaryAction!)}
                        >
                          {localizeCodexCmd.loading &&
                          step.secondaryAction === "localize-codex" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Zap className="size-4" />
                          )}
                          {step.secondaryActionLabel}
                        </Button>
                      )}
                      {step.action === "refresh-health" && (
                        <span className="self-center text-xs text-muted-foreground">
                          {health?.message}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {activeStep && !activeStep.action && health && !health.ready && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm dark:bg-amber-500/10">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">桥接状态</p>
              <p className="text-xs text-muted-foreground">{health.message}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={healthLoading}
              onClick={() => void refreshHealth()}
            >
              <RefreshCw className="size-3.5" />
              重新检测
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={healthLoading}
            onClick={() => void rescanAll()}
          >
            <RefreshCw className="size-4" />
            重新扫描环境
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              void openGuide(
                mode === "deepseek-bridge"
                  ? MANUAL_LINKS.codexBridge
                  : MANUAL_LINKS.ccSwitch,
                mode === "deepseek-bridge" ? "DeepSeek 桥文档" : "CC Switch",
              )
            }
          >
            <ExternalLink className="size-4" />
            说明文档
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              void openBrowser(
                "open_external_browser",
                {
                  url:
                    mode === "deepseek-bridge"
                      ? MANUAL_LINKS.codexBridge
                      : MANUAL_LINKS.ccSwitch,
                },
                "正在用系统浏览器打开…",
                "external",
              )
            }
          >
            系统浏览器
          </Button>
        </div>

        {(progressActive ||
          mergedInstallLog ||
          installCmd.error ||
          installCodexCmd.error ||
          localizeCodexCmd.error) && (
          <InstallProgressPanel
            loading={progressActive}
            progress={progress}
            log={
              mergedInstallLog ||
              installCmd.error ||
              installCodexCmd.error ||
              localizeCodexCmd.error ||
              null
            }
          />
        )}
        {(startLog || startBridgeCmd.error) && (
          <CommandOutput
            loading={startBridgeCmd.loading}
            log={startLog ?? startBridgeCmd.error ?? undefined}
          />
        )}

        {platform === "windows" && mode === "cc-switch" && (
          <p className="text-xs text-muted-foreground">
            winget 安装失败时，可从 GitHub Releases 或 Gitee 镜像手动下载 CC
            Switch。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
