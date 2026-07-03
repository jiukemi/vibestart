import { AppWindow, ExternalLink, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import { getIdeRegisterGuide } from "@/lib/ide-accounts";
import { getIdeOption } from "@/lib/ide";

interface IdeRegisterGuidePanelProps {
  ideId: string;
}

export function IdeRegisterGuidePanel({ ideId }: IdeRegisterGuidePanelProps) {
  const option = getIdeOption(ideId);
  const guide = getIdeRegisterGuide(ideId);
  const { openGuide, open, loading, error } = useOpenInAppBrowser();

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
            disabled={loading}
            onClick={() =>
              void openGuide(guide.signupUrl, guide.browserTitle)
            }
          >
            <AppWindow className="size-4" />
            应用内打开注册页
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
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
            系统浏览器（OAuth 异常时用）
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
