import { ExternalLink, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import { getLlmApiGuide } from "@/lib/llm-api-guides";

interface LlmApiKeyGuidePanelProps {
  providerId: string;
}

export function LlmApiKeyGuidePanel({ providerId }: LlmApiKeyGuidePanelProps) {
  const guide = getLlmApiGuide(providerId);
  const { openGuide, loading, error } = useOpenInAppBrowser();

  return (
    <Card className="border-border bg-muted/20 dark:bg-muted/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" />
          如何获取 API Key（图文步骤）
        </CardTitle>
        <CardDescription>
          {guide.note} 点击下方按钮会在系统浏览器打开（可在设置中选择 Chrome 或默认浏览器）。
        </CardDescription>
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
            size="sm"
            disabled={loading}
            onClick={() =>
              void openGuide(guide.signupUrl, `${guide.browserTitle} · 注册`)
            }
          >
            <ExternalLink className="size-4" />
            浏览器打开注册页
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() =>
              void openGuide(guide.apiKeyUrl, `${guide.browserTitle} · API Key`)
            }
          >
            <ExternalLink className="size-4" />
            浏览器打开 API Keys
          </Button>
        </div>
        {guide.keyPrefix && (
          <p className="text-xs text-muted-foreground">
            Key 通常以 <code className="text-foreground">{guide.keyPrefix}</code>{" "}
            开头
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
