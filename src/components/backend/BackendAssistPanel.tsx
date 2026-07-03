import { useCallback, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import {
  getBackendProvider,
  getBackendProvidersForGoal,
  getProviderAiPrompt,
  isWebsiteBackendGoal,
  type BackendProvider,
} from "@/lib/backend-assist";
import { selectableCardClasses } from "@/lib/selectable-card";
import type { AppStack, BuildGoal } from "@/stores/wizardStore";
import { useWizardStore } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

interface BackendAssistPanelProps {
  buildGoal: BuildGoal | null;
  appStack: AppStack | null;
  className?: string;
  /** 默认折叠，仅显示入口条 */
  defaultCollapsed?: boolean;
}

export function BackendAssistPanel({
  buildGoal,
  appStack,
  className,
  defaultCollapsed = true,
}: BackendAssistPanelProps) {
  const backendAssistEnabled = useWizardStore(
    (s) => s.selections.backendAssistEnabled,
  );
  const backendProviderId = useWizardStore(
    (s) => s.selections.backendProviderId,
  );
  const setSelection = useWizardStore((s) => s.setSelection);

  const providers = getBackendProvidersForGoal(buildGoal, appStack);
  const selected = getBackendProvider(backendProviderId);
  const openBrowser = useOpenInAppBrowser();

  const [expanded, setExpanded] = useState(
    () => !defaultCollapsed || backendAssistEnabled,
  );
  const [copied, setCopied] = useState(false);

  const copyPrompt = useCallback(
    async (provider: BackendProvider) => {
      await navigator.clipboard.writeText(
        getProviderAiPrompt(provider, buildGoal),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [buildGoal],
  );

  if (providers.length === 0) {
    return null;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 dark:bg-muted/10",
          className,
        )}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <Server className="size-4" />
          以后需要存数据 / 后端？（可选进阶）
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="size-4 text-primary" />
              进阶后端辅助（可选）
            </CardTitle>
            <CardDescription>
              {isWebsiteBackendGoal(buildGoal)
                ? "静态页上线后如需留言板、表单存数据，可接 Vercel Functions 或国内 Serverless。"
                : "前端完成后可接轻量后端。国内推荐微信云开发 / 腾讯云 SCF；跨端可用 Supabase。"}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded(false)}
            aria-label="收起"
          >
            <ChevronUp className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 dark:bg-muted/20">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border-input accent-primary"
            checked={backendAssistEnabled}
            onChange={(e) => {
              setSelection("backendAssistEnabled", e.target.checked);
              if (!e.target.checked) {
                setSelection("backendProviderId", null);
              }
            }}
          />
          <span className="space-y-1 text-sm">
            <span className="font-medium text-foreground">启用进阶后端引导</span>
            <span className="block text-muted-foreground">
              第一天做网页可以跳过；需要云端数据时再勾选。
            </span>
          </span>
        </label>

        {backendAssistEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => {
              const isSelected = backendProviderId === provider.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() =>
                    setSelection("backendProviderId", provider.id)
                  }
                  className="text-left"
                >
                  <Card
                    size="sm"
                    className={selectableCardClasses(isSelected, "h-full")}
                  >
                    <CardHeader>
                      <CardTitle className="text-sm">{provider.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {provider.tagline}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {provider.pricingHint}
                        {provider.domestic && (
                          <span className="ml-1 text-primary">· 国内友好</span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}

        {backendAssistEnabled && selected && (
          <div className="space-y-3 rounded-xl border border-border bg-background p-4 dark:bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-foreground">
                {selected.name} · 接入步骤
              </h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void openBrowser.open(
                      "open_external_browser",
                      { url: selected.signupUrl },
                      "正在打开…",
                      "external",
                    )
                  }
                >
                  <ExternalLink className="size-3.5" />
                  注册 / 控制台
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void openBrowser.open(
                      "open_builtin_browser",
                      { url: selected.docsUrl, title: `${selected.name} 文档` },
                      "正在打开文档…",
                      "external",
                    )
                  }
                >
                  文档
                </Button>
              </div>
            </div>
            <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
              {selected.setupSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="relative">
              <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground dark:bg-muted/30">
                {getProviderAiPrompt(selected, buildGoal)}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => void copyPrompt(selected)}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "已复制" : "复制 AI 提示词"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
