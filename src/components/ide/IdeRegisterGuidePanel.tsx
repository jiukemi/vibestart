import { ExternalLink, Info, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useExternalReachability } from "@/hooks/useExternalReachability";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import {
  getIdeRegisterGuide,
  ideRegisterBlockedReason,
  shouldShowIdeRegisterGuide,
} from "@/lib/ide-accounts";
import { getIdeOption } from "@/lib/ide";

interface IdeRegisterGuidePanelProps {
  ideId: string;
  llmProvider?: string | null;
  /** 尚未进入 LLM 选择步骤时为 true，不假定国产 LLM */
  beforeLlmStep?: boolean;
}

export function IdeRegisterGuidePanel({
  ideId,
  llmProvider = null,
  beforeLlmStep = false,
}: IdeRegisterGuidePanelProps) {
  const option = getIdeOption(ideId);
  const guide = getIdeRegisterGuide(ideId);
  const { open, loading, error } = useOpenInAppBrowser();
  const { reachable, checked, loading: netLoading } = useExternalReachability();

  const blockedReason = beforeLlmStep
    ? null
    : ideRegisterBlockedReason(ideId, {
        llmProvider,
        externalReachable: reachable,
        externalChecked: checked,
      });

  const showRegister = beforeLlmStep
    ? true
    : shouldShowIdeRegisterGuide(ideId, {
        llmProvider,
        externalReachable: reachable,
        externalChecked: checked,
      });

  if (!showRegister && blockedReason) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4 text-primary" />
            关于 {option.name} 账号
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{blockedReason}</p>
        </CardContent>
      </Card>
    );
  }

  if (!showRegister) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4" />
          注册 {option.name} 账号
        </CardTitle>
        <CardDescription>{guide.note}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {checked && reachable === false && guide.requiresExternalNetwork && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
            检测到当前网络可能无法访问海外注册页。若注册失败，请配置代理或改用国内
            IDE（Trae / 通义灵码）。
          </p>
        )}
        <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
          {guide.steps.map((step, i) => (
            <li key={i} className="leading-relaxed">
              {step.split("**").map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="font-medium text-foreground">
                    {part}
                  </strong>
                ) : (
                  part
                ),
              )}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={loading || netLoading}
            onClick={() =>
              void open(
                "open_external_browser",
                { url: guide.signupUrl },
                "正在用系统浏览器打开…",
                "external",
              )
            }
          >
            <ExternalLink className="size-4" />
            浏览器打开注册页
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {ideId === "cursor" && (
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground dark:bg-muted/20">
            💡 <strong className="text-foreground">GitHub 不是必须的。</strong>
            Cursor 用邮箱就能注册。GitHub 账号以后有条件再注册，可用于更多工具的快捷登录。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
