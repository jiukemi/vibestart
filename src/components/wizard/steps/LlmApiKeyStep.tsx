import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";

import { IdeSyncTargetPicker } from "@/components/llm/IdeSyncTargetPicker";
import { IdeSyncVerifyPanel } from "@/components/llm/IdeSyncVerifyPanel";
import { LlmApiKeyGuidePanel } from "@/components/llm/LlmApiKeyGuidePanel";
import { CodexBridgePanel } from "@/components/codex/CodexBridgePanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StepShell } from "@/components/wizard/StepShell";
import { useOsInfo } from "@/hooks/useOsInfo";
import { quitAppHint } from "@/lib/platform-ui";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { isCodexIde, needsCodexBridge } from "@/lib/codex-bridge";
import { getIdeOption } from "@/lib/ide";
import type {
  IdeSyncBatchResult,
  LlmConfig,
  LlmTestResult,
} from "@/lib/tauri-types";
import { useWizardStore } from "@/stores/wizardStore";
import { getStepMeta } from "@/lib/wizard-index";
import {
  selectableCardClasses,
  selectableGridButtonClassName,
} from "@/lib/selectable-card";
import { cn } from "@/lib/utils";

const step = getStepMeta("llm-api-key");

const LLM_PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "高性价比，推荐默认",
    default: true,
  },
  {
    id: "tongyi",
    name: "通义千问",
    description: "阿里云大模型 API",
  },
  {
    id: "zhipu",
    name: "智谱",
    description: "智谱 AI GLM 系列",
  },
  {
    id: "kimi",
    name: "Kimi",
    description: "Moonshot AI 长上下文模型",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT 系列官方 API",
  },
] as const;

export function LlmApiKeyStep() {
  const { platform } = useOsInfo();
  const llmProvider = useWizardStore((s) => s.selections.llmProvider);
  const primaryIde = useWizardStore((s) => s.selections.primaryIde);
  const llmSyncTargets = useWizardStore(
    (s) => s.selections.llmSyncTargets ?? [],
  );
  const projectDir = useWizardStore((s) => s.selections.projectDir);
  const setSelection = useWizardStore((s) => s.setSelection);
  const llmChosen = llmProvider != null;
  const activeProvider = llmProvider ?? "deepseek";

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [validated, setValidated] = useState(false);
  const [synced, setSynced] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [syncBatch, setSyncBatch] = useState<IdeSyncBatchResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [verifyAfterSync, setVerifyAfterSync] = useState(false);

  const { run: loadConfig } = useTauriCommand<LlmConfig | null>();
  const testCommand = useTauriCommand<LlmTestResult>();
  const syncCommand = useTauriCommand<IdeSyncBatchResult>();

  const setSyncTargets = useCallback(
    (ids: string[]) => setSelection("llmSyncTargets", ids),
    [setSelection],
  );

  const loadStoredKey = useCallback(async () => {
    try {
      const config = await loadConfig("get_llm_config");
      if (config && config.provider === activeProvider && llmChosen) {
        setApiKey(config.api_key);
        setValidated(true);
        setStatusMessage("已从本地配置加载已验证的 Key");
      } else {
        setApiKey("");
        setValidated(false);
        setSynced(false);
        setStatusMessage(null);
        setSyncBatch(null);
      }
    } catch {
      setApiKey("");
      setValidated(false);
      setSynced(false);
      setStatusMessage(null);
      setSyncBatch(null);
    }
  }, [activeProvider, llmChosen, loadConfig]);

  useEffect(() => {
    void loadStoredKey();
  }, [loadStoredKey]);

  const testOnly = async (provider: string): Promise<boolean> => {
    setStatusMessage(null);
    setSyncBatch(null);
    setSynced(false);
    const result = await testCommand.run("test_llm_api", {
      provider,
      apiKey: apiKey.trim(),
    });
    if (result) {
      setValidated(true);
      setStatusMessage(result.message);
      return true;
    }
    return false;
  };

  const handleStepNext = async (): Promise<boolean> => {
    const provider = llmProvider ?? "deepseek";
    if (!llmProvider) {
      setSelection("llmProvider", provider);
    }
    if (validated) return true;
    return testOnly(provider);
  };

  const runSync = async () => {
    setConfirmOpen(false);
    setSyncBatch(null);
    const result = await syncCommand.run("sync_llm_to_ides", {
      ides: llmSyncTargets,
      provider: activeProvider,
      apiKey: apiKey.trim(),
    });
    if (result) {
      setSyncBatch(result);
      setSynced(result.success);
      setVerifyAfterSync(true);
    }
  };

  const selectedIdeNames = llmSyncTargets
    .map((id) => getIdeOption(id).name)
    .join("、");

  const selectedProviderName =
    LLM_PROVIDERS.find((p) => p.id === activeProvider)?.name ??
    activeProvider;

  const canSync =
    llmChosen &&
    validated &&
    llmSyncTargets.length > 0 &&
    apiKey.trim().length > 0 &&
    !syncCommand.loading;

  const showCodexBridgeContinue =
    isCodexIde(primaryIde) && llmChosen && needsCodexBridge(primaryIde, llmProvider);

  return (
    <StepShell
      title={step.title}
      description="先选择 LLM 供应商，按教程获取 Key 并验证，再同步到编辑器。"
      onNext={handleStepNext}
      nextDisabled={
        testCommand.loading || !llmChosen || (!validated && !apiKey.trim())
      }
      nextLabel={
        testCommand.loading
          ? "验证中…"
          : validated
            ? "下一步"
            : "验证并继续"
      }
    >
      {isCodexIde(primaryIde) && !llmChosen && (
        <p className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground dark:bg-primary/10">
          你已在 IDE 步骤开始 Codex 配置。请在此选择 LLM：国产模型将继续桥接清单，OpenAI
          官方 API 无需本地桥。
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LLM_PROVIDERS.map((provider) => {
          const isSelected = llmProvider === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                setSelection("llmProvider", provider.id);
                setValidated(false);
                setSynced(false);
                setStatusMessage(null);
                setSyncBatch(null);
              }}
              className={selectableGridButtonClassName()}
            >
              <Card
                size="sm"
                className={selectableCardClasses(isSelected, "cursor-pointer")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {provider.name}
                    {"default" in provider && provider.default && (
                      <span className="text-xs font-normal text-muted-foreground">
                        默认
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{provider.description}</CardDescription>
                </CardHeader>
              </Card>
            </button>
          );
        })}
      </div>

      {!llmChosen && (
        <p className="text-sm text-muted-foreground">
          选择 LLM 供应商后，将显示 Key 获取教程与输入框。
        </p>
      )}

      {llmChosen && (
        <>
          <LlmApiKeyGuidePanel providerId={activeProvider} />

          <div className="space-y-2">
            <label
              htmlFor="llm-api-key"
              className="text-sm font-medium text-foreground"
            >
              粘贴 API Key
            </label>
            <div className="relative">
              <input
                id="llm-api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setValidated(false);
                  setSynced(false);
                  setStatusMessage(null);
                  setSyncBatch(null);
                }}
                placeholder="sk-..."
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-2 -translate-y-1/2"
                aria-label={showKey ? "隐藏密钥" : "显示密钥"}
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!apiKey.trim() || testCommand.loading}
                onClick={() => void testOnly(activeProvider)}
              >
                {testCommand.loading && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                仅测试连接
              </Button>
              {validated && !testCommand.error && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  已验证
                </span>
              )}
              {synced && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  已同步到编辑器
                </span>
              )}
            </div>

            {statusMessage && !testCommand.error && (
              <p className="text-xs text-muted-foreground">{statusMessage}</p>
            )}
            {testCommand.error && (
              <p className="text-xs text-destructive">{testCommand.error}</p>
            )}
          </div>

          {showCodexBridgeContinue && llmProvider && (
            <CodexBridgePanel
              llmProvider={llmProvider}
              phase="llm-api-key"
              apiKeyReady={validated}
            />
          )}

          <IdeSyncTargetPicker
            selected={llmSyncTargets}
            onChange={setSyncTargets}
            primaryIde={primaryIde}
            action={
              <>
                <Button
                  type="button"
                  disabled={!canSync}
                  onClick={() => setConfirmOpen(true)}
                >
                  {syncCommand.loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {syncCommand.loading ? "同步中…" : "同步到选中的编辑器"}
                </Button>
                {!validated && llmSyncTargets.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    请先测试连接，再同步
                  </p>
                )}
              </>
            }
          />

          {syncBatch && (
            <Card
              size="sm"
              className={cn(
                syncBatch.success
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <CardHeader>
                <CardTitle className="text-base">同步结果</CardTitle>
                <CardDescription className="whitespace-pre-wrap">
                  {syncBatch.message}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {syncBatch.results.map((item) => (
                  <div
                    key={item.ide}
                    className="rounded-lg border border-border bg-background/60 p-3 dark:bg-background/40"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.ide_name} {item.success ? "✅" : "⚠️"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.message}
                    </p>
                    {item.details.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                        {item.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(syncBatch || (validated && llmSyncTargets.length > 0)) && (
            <IdeSyncVerifyPanel
              ides={llmSyncTargets}
              provider={activeProvider}
              apiKey={apiKey}
              projectDir={projectDir}
              autoVerify={Boolean(syncBatch && verifyAfterSync)}
            />
          )}

          <p className="text-xs text-muted-foreground">
            Key 保存在{" "}
            <code className="text-foreground">~/.vibestart/config.json</code>
            （权限 600）。同步后会自动验证各编辑器配置；Cursor 等若需额外开关，按验证面板指引操作。
            同步可随时跳过，稍后在编辑器里手动配置也行。
          </p>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>确认同步 API Key？</DialogTitle>
                <DialogDescription>
                  将把 {selectedProviderName} 的 Key 写入：
                  {selectedIdeNames || "（未选择）"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 px-0 text-sm text-muted-foreground">
                <ul className="list-inside list-disc space-y-1 text-xs">
                  <li>Key 仅保存在你的电脑上，不会上传到网络</li>
                  <li>
                    Cursor 类编辑器需完全退出后重启（{quitAppHint(platform)}）
                  </li>
                  <li>可随时取消，改在编辑器里手动粘贴 Key</li>
                </ul>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  disabled={syncCommand.loading}
                  onClick={() => void runSync()}
                >
                  {syncCommand.loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  确认同步
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </StepShell>
  );
}
