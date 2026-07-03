import { useCallback, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import { cn } from "@/lib/utils";

const PENPOT_URL = "https://design.penpot.app";
const EXCALIDRAW_URL = "https://excalidraw.com";

const AI_PROMPT = `我上传/参考了一张 UI 原型图（或 Penpot 导出的截图），请按这个布局修改我项目里的页面文件。
要求：
1. 保持与原型相近的结构与间距
2. 使用项目现有技术栈（HTML/CSS 或 WXML 等）
3. 颜色与字体可微调，但层次关系一致
4. 注释用中文
若项目里还没有内容，从空白 scaffold 开始搭建。`;

interface PenpotPrototypePanelProps {
  className?: string;
  defaultOpen?: boolean;
}

export function PenpotPrototypePanel({
  className,
  defaultOpen = false,
}: PenpotPrototypePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const openBrowser = useOpenInAppBrowser();

  const copyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 dark:bg-muted/10",
          className,
        )}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <PenLine className="size-4" />
          想先画原型？（可选 · Penpot / 手绘）
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
              <PenLine className="size-4 text-primary" />
              先画原型（可选）
            </CardTitle>
            <CardDescription>
              说不清 UI 时，用 Penpot（开源免费）或 Excalidraw 快速画线框，截图后让 AI 照着做。
              模板预览已是目标参考，多数新手可跳过。
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="收起"
          >
            <ChevronUp className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() =>
              void openBrowser.open(
                "open_external_browser",
                { url: PENPOT_URL },
                "正在打开 Penpot…",
                "external",
              )
            }
          >
            <ExternalLink className="size-3.5" />
            打开 Penpot
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              void openBrowser.open(
                "open_external_browser",
                { url: EXCALIDRAW_URL },
                "正在打开…",
                "external",
              )
            }
          >
            Excalidraw 手绘
          </Button>
        </div>
        <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
          <li>画简单线框（标题、按钮、列表即可）</li>
          <li>导出 PNG 或截图</li>
          <li>在 AI 编辑器里上传图片 + 复制下方提示词</li>
        </ol>
        <div className="relative">
          <pre className="max-h-28 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs whitespace-pre-wrap text-foreground dark:bg-muted/30">
            {AI_PROMPT}
          </pre>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="absolute top-2 right-2"
            onClick={() => void copyPrompt()}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "已复制" : "复制提示词"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
