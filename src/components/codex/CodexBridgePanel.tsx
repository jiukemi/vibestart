import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Route,
  Zap,
} from "lucide-react";

import { CommandOutput } from "@/components/shared/CommandOutput";
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
import {
  bridgeOptionForProvider,
  CC_SWITCH_GUIDE_STEPS,
  CODEX_BRIDGE_OPTIONS,
  DEEPSEEK_BRIDGE_GUIDE_STEPS,
  type CodexBridgeMode,
} from "@/lib/codex-bridge";
import { selectableCardClasses } from "@/lib/selectable-card";
import type { CodexBridgeHealth, CommandResult } from "@/lib/tauri-types";
import { useWizardStore } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

const MANUAL_LINKS = {
  ccSwitch: "https://ccswitch.io",
  ccSwitchGithub: "https://github.com/farion1231/cc-switch",
  codexBridge: "https://github.com/xiaoshaoning/codex-bridge",
} as const;

interface CodexBridgePanelProps {
  llmProvider: string | null;
  /** 紧凑模式：仅显示状态条 */
  compact?: boolean;
  className?: string;
}

export function CodexBridgePanel({
  llmProvider,
  compact = false,
  className,
}: CodexBridgePanelProps) {
  const { platform } = useOsInfo();
  const codexBridgeMode = useWizardStore((s) => s.selections.codexBridgeMode);
  const setSelection = useWizardStore((s) => s.setSelection);

  const [installLog, setInstallLog] = useState<string | null>(null);
  const [startLog, setStartLog] = useState<string | null>(null);

  const { run: loadConfig, data: savedConfig } =
    useTauriCommand<{
      mode: string;
      cc_switch_port: number;
      deepseek_bridge_port: number;
    }>();
  const saveConfigCmd = useTauriCommand<void>();
  const healthCmd = useTauriCommand<CodexBridgeHealth>();
  const installCmd = useTauriCommand<CommandResult>();
  const startBridgeCmd = useTauriCommand<CommandResult>();
  const openCcSwitchCmd = useTauriCommand<void>();

  const { open: openBrowser, openGuide } = useOpenInAppBrowser();

  const mode: CodexBridgeMode = codexBridgeMode ?? "cc-switch";

  const visibleOptions = useMemo(
    () =>
      CODEX_BRIDGE_OPTIONS.filter((opt) => {
        if (opt.providerLimit && llmProvider !== opt.providerLimit) {
          return false;
        }
        return true;
      }),
    [llmProvider],
  );

  const selectedOption =
    CODEX_BRIDGE_OPTIONS.find((o) => o.id === mode) ?? CODEX_BRIDGE_OPTIONS[0];

  const guideSteps =
    mode === "deepseek-bridge"
      ? DEEPSEEK_BRIDGE_GUIDE_STEPS
      : CC_SWITCH_GUIDE_STEPS;

  const refreshHealth = useCallback(async () => {
    await healthCmd.run("check_codex_bridge_health", { mode });
  }, [healthCmd, mode]);

  const persistMode = useCallback(
    async (nextMode: CodexBridgeMode) => {
      setSelection("codexBridgeMode", nextMode);
      await saveConfigCmd.run("save_codex_bridge_config", { mode: nextMode });
      await refreshHealth();
    },
    [refreshHealth, saveConfigCmd, setSelection],
  );

  useEffect(() => {
    void loadConfig("get_codex_bridge_config");
  }, [loadConfig]);

  useEffect(() => {
    if (savedConfig?.mode) {
      const m = savedConfig.mode as CodexBridgeMode;
      if (m !== codexBridgeMode) {
        setSelection("codexBridgeMode", m);
      }
    }
  }, [codexBridgeMode, savedConfig?.mode, setSelection]);

  useEffect(() => {
    if (llmProvider && !codexBridgeMode) {
      const suggested = bridgeOptionForProvider(llmProvider);
      if (suggested !== "none") {
        void persistMode(suggested);
      }
    }
  }, [codexBridgeMode, llmProvider, persistMode]);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const installTool = async () => {
    setInstallLog(null);
    const tool = mode === "deepseek-bridge" ? "codex-bridge" : "cc-switch";
    const result = await installCmd.run("install_tool", { tool });
    if (result) {
      setInstallLog(result.log);
      setTimeout(() => void refreshHealth(), 2000);
    } else if (installCmd.error) {
      setInstallLog(installCmd.error);
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

  const health = healthCmd.data;
  const healthLoading = healthCmd.loading;

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
          onClick={() => void refreshHealth()}
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
          Codex 国产模型桥接
        </CardTitle>
        <CardDescription>
          Codex 使用 Responses 协议，国产 API 需经本地桥接。VibeStart
          会写入 localhost 配置；Key 还需在 CC Switch 或 bridge 中再填一次。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleOptions.map((opt) => {
            const isSelected = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
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
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            "flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            health?.ready
              ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
              : "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10",
          )}
        >
          {healthLoading ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : health?.ready ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {health?.ready ? "桥接就绪" : "桥接未就绪（可继续向导，启动 Codex 前请完成）"}
            </p>
            <p className="text-xs text-muted-foreground">
              {health?.message ??
                `检测 ${selectedOption.defaultPort} 端口…`}
            </p>
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

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={installCmd.loading}
            onClick={() => void installTool()}
          >
            {installCmd.loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            {mode === "deepseek-bridge"
              ? "一键安装 DeepSeek 桥"
              : "一键安装 CC Switch"}
          </Button>
          {mode === "deepseek-bridge" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={startBridgeCmd.loading}
              onClick={() => void startBridge()}
            >
              {startBridgeCmd.loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              启动 DeepSeek 桥
            </Button>
          )}
          {mode === "cc-switch" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={openCcSwitchCmd.loading}
              onClick={() => void openCcSwitchCmd.run("open_cc_switch_app")}
            >
              打开 CC Switch
            </Button>
          )}
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
            应用内打开说明页
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

        {(installLog || installCmd.error) && (
          <CommandOutput
            loading={installCmd.loading}
            log={installLog ?? installCmd.error ?? undefined}
          />
        )}
        {(startLog || startBridgeCmd.error) && (
          <CommandOutput
            loading={startBridgeCmd.loading}
            log={startLog ?? startBridgeCmd.error ?? undefined}
          />
        )}

        <ol className="space-y-3 border-t border-border pt-3">
          {guideSteps.map((step, index) => (
            <li key={step.id} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {platform === "windows" && mode === "cc-switch" && (
          <p className="text-xs text-muted-foreground">
            winget 安装失败时，可从{" "}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() =>
                void openGuide(MANUAL_LINKS.ccSwitchGithub, "CC Switch · GitHub")
              }
            >
              GitHub Releases
            </button>{" "}
            下载；也可在 Gitee 镜像 Release 中应用内打开下载页。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
