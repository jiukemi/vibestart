import { useCallback, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { loadPrompts, type PackPrompt } from "@/lib/packs";
import { cn } from "@/lib/utils";

interface PromptStepperProps {
  packId: string;
  projectDir: string;
}

export function PromptStepper({ packId, projectDir }: PromptStepperProps) {
  const prompts = useMemo(() => loadPrompts(packId), [packId]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const previewCommand = useTauriCommand<void>();
  const cursorCommand = useTauriCommand<void>();

  const current = prompts[currentIndex];
  const isLast = currentIndex >= prompts.length - 1;

  const copyPrompt = useCallback(async (prompt: PackPrompt) => {
    await navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const openPreview = useCallback(async () => {
    await previewCommand.run("open_local_preview", { projectDir });
  }, [previewCommand, projectDir]);

  const openCursor = useCallback(async () => {
    await cursorCommand.run("open_in_cursor", { projectDir });
  }, [cursorCommand, projectDir]);

  if (prompts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">未找到该模板的提示词文件。</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, index) => (
          <button
            key={prompt.step}
            type="button"
            onClick={() => setCurrentIndex(index)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              index === currentIndex
                ? "bg-primary text-primary-foreground"
                : index < currentIndex
                  ? "bg-muted text-foreground"
                  : "bg-muted/50 text-muted-foreground",
            )}
          >
            {prompt.step}. {prompt.title}
          </button>
        ))}
      </div>

      {current && (
        <Card>
          <CardHeader>
            <CardTitle>
              步骤 {current.step}：{current.title}
            </CardTitle>
            <CardDescription>
              复制下方提示词，在 Cursor 中粘贴并发送，让 AI 帮你改
              index.html。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {current.content}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => void copyPrompt(current)}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "已复制" : "复制提示词"}
              </Button>
            </div>

            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>点击「复制提示词」</li>
              <li>在 Cursor 中打开项目文件夹</li>
              <li>粘贴到 AI 对话框并发送</li>
              <li>等待 AI 修改 index.html 后，点击「本地预览」查看效果</li>
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void openCursor()}
                disabled={cursorCommand.loading}
              >
                <FolderOpen className="size-4" />
                在 Cursor 中打开
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void openPreview()}
                disabled={previewCommand.loading}
              >
                <ExternalLink className="size-4" />
                本地预览
              </Button>
              {!isLast ? (
                <Button type="button" onClick={() => setCurrentIndex((i) => i + 1)}>
                  做完了，下一步
                </Button>
              ) : (
                <p className="flex items-center text-sm text-muted-foreground">
                  全部步骤完成后，点击底部「下一步」去部署上线。
                </p>
              )}
            </div>

            {(previewCommand.error || cursorCommand.error) && (
              <p className="text-sm text-destructive">
                {previewCommand.error ?? cursorCommand.error}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
