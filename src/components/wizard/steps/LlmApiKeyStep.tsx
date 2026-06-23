import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepShell } from "@/components/wizard/StepShell";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { LlmConfig } from "@/lib/tauri-types";
import { useWizardStore } from "@/stores/wizardStore";
import { WIZARD_STEPS } from "@/lib/steps";
import { cn } from "@/lib/utils";

const step = WIZARD_STEPS[5];

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
  const llmProvider = useWizardStore((s) => s.selections.llmProvider);
  const setSelection = useWizardStore((s) => s.setSelection);
  const selected = llmProvider ?? "deepseek";

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [validated, setValidated] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const configCommand = useTauriCommand<LlmConfig | null>();
  const testCommand = useTauriCommand<string>();

  const loadStoredKey = useCallback(async () => {
    try {
      const config = await configCommand.run("get_llm_config");
      if (config && config.provider === selected) {
        setApiKey(config.api_key);
        setValidated(true);
        setStatusMessage("已从本地配置加载已验证的 Key");
      } else {
        setApiKey("");
        setValidated(false);
        setStatusMessage(null);
      }
    } catch {
      setApiKey("");
      setValidated(false);
      setStatusMessage(null);
    }
  }, [configCommand, selected]);

  useEffect(() => {
    void loadStoredKey();
  }, [loadStoredKey]);

  const testAndSave = async () => {
    setStatusMessage(null);
    const result = await testCommand.run("test_llm_api", {
      provider: selected,
      apiKey: apiKey.trim(),
    });
    setValidated(true);
    setStatusMessage(result ?? "API Key 验证成功");
  };

  return (
    <StepShell
      title={step.title}
      description={step.description}
      onNext={testAndSave}
      nextDisabled={!apiKey.trim() || testCommand.loading}
      nextLabel={testCommand.loading ? "验证中…" : "验证并继续"}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LLM_PROVIDERS.map((provider) => {
          const isSelected = selected === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                setSelection("llmProvider", provider.id);
                setValidated(false);
                setStatusMessage(null);
              }}
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

      <div className="space-y-2">
        <label
          htmlFor="llm-api-key"
          className="text-sm font-medium text-foreground"
        >
          API Key
        </label>
        <div className="relative">
          <input
            id="llm-api-key"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setValidated(false);
              setStatusMessage(null);
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

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!apiKey.trim() || testCommand.loading}
            onClick={() => void testAndSave()}
          >
            {testCommand.loading && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            测试连接
          </Button>
          {validated && !testCommand.error && (
            <span className="text-xs text-muted-foreground">✅ 已验证</span>
          )}
        </div>

        {statusMessage && !testCommand.error && (
          <p className="text-xs text-muted-foreground">{statusMessage}</p>
        )}
        {testCommand.error && (
          <p className="text-xs text-destructive">{testCommand.error}</p>
        )}
      </div>
    </StepShell>
  );
}
