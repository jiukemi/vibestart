import { useCallback, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, FolderOpen, Sparkles } from "lucide-react";

import { CommandOutput } from "@/components/shared/CommandOutput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { getIdeOption } from "@/lib/ide";
import {
  getPackMeta,
  loadPrompts,
  scaffoldPreviewLabel,
  type PackPrompt,
} from "@/lib/packs";
import { useWizardStore } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

interface PromptStepperProps {
  packId: string;
  projectDir: string;
}

export function PromptStepper({ packId, projectDir }: PromptStepperProps) {
  const primaryIde = useWizardStore((s) => s.selections.primaryIde) ?? "cursor";
  const ide = getIdeOption(primaryIde);

  const prompts = useMemo(() => loadPrompts(packId), [packId]);
  const packMeta = useMemo(() => getPackMeta(packId), [packId]);
  const scaffoldKind = packMeta?.scaffoldKind ?? "html";
  const canLocalPreview = scaffoldKind === "html";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [starterCopied, setStarterCopied] = useState(false);

  const previewCommand = useTauriCommand<void>();
  const ideCommand = useTauriCommand<void>();

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

  const openIde = useCallback(async () => {
    await ideCommand.run("open_in_ide", { projectDir, ide: primaryIde });
  }, [ideCommand, primaryIde, projectDir]);

  const copyStarter = useCallback(async () => {
    const text = packMeta?.starterPrompt ?? prompts[0]?.content;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setStarterCopied(true);
    setTimeout(() => setStarterCopied(false), 2000);
  }, [packMeta?.starterPrompt, prompts]);

  if (prompts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">未找到该模板的提示词文件。</p>
    );
  }

  return (
    <div className="space-y-4">
      {(packMeta?.starterPrompt || prompts.length > 0) && (
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              开始第一步
            </CardTitle>
            <CardDescription>
              复制开场提示词 → 打开 {ide.promptLabel} → 粘贴到 AI 对话框发送。
              {canLocalPreview
                ? " 你的 index.html 几乎是空的，AI 会帮你从零搭建。"
                : ` 预览方式：${scaffoldPreviewLabel(scaffoldKind)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-background/80 p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground dark:bg-background/60">
                {packMeta?.starterPrompt ?? prompts[0].content}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => void copyStarter()}
              >
                {starterCopied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {starterCopied ? "已复制" : "复制开场提示词"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void openIde()}
                disabled={ideCommand.loading}
              >
                <FolderOpen className="size-4" />
                打开 {ide.promptLabel} 开始
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              共 {prompts.length} 步：{prompts.map((p) => p.title).join(" → ")}
            </p>
          </CardContent>
        </Card>
      )}

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
              复制下方提示词，在 {ide.promptLabel} 中粘贴并发送，让 AI 帮你改项目文件。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground dark:bg-muted/30">
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
              <li>点击「在 {ide.promptLabel} 中打开」进入项目</li>
              <li>粘贴到 AI 对话框并发送</li>
              <li>
                {canLocalPreview
                  ? "等待 AI 修改后，点击「本地预览」查看效果"
                  : `在 ${scaffoldPreviewLabel(scaffoldKind)} 查看效果`}
              </li>
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void openIde()}
                disabled={ideCommand.loading}
              >
                <FolderOpen className="size-4" />
                在 {ide.promptLabel} 中打开
              </Button>
              {canLocalPreview && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void openPreview()}
                  disabled={previewCommand.loading}
                >
                  <ExternalLink className="size-4" />
                  本地预览
                </Button>
              )}
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

            {(previewCommand.error || ideCommand.error) && (
              <CommandOutput log={previewCommand.error ?? ideCommand.error} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
