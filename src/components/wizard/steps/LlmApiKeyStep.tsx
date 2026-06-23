import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
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

function storageKey(provider: string) {
  return `vibestart-llm-api-key-${provider}`;
}

export function LlmApiKeyStep() {
  const llmProvider = useWizardStore((s) => s.selections.llmProvider);
  const setSelection = useWizardStore((s) => s.setSelection);
  const selected = llmProvider ?? "deepseek";

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey(selected));
    setApiKey(stored ?? "");
    setSaved(!!stored);
  }, [selected]);

  const saveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem(storageKey(selected), apiKey.trim());
      setSaved(true);
    }
  };

  return (
    <StepShell
      title={step.title}
      description={step.description}
      onNext={saveKey}
      nextDisabled={!apiKey.trim()}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LLM_PROVIDERS.map((provider) => {
          const isSelected = selected === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => setSelection("llmProvider", provider.id)}
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
              setSaved(false);
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
        {saved && (
          <p className="text-xs text-muted-foreground">
            ✅ 已保存到本地（连接测试将在后续步骤提供）
          </p>
        )}
      </div>
    </StepShell>
  );
}
