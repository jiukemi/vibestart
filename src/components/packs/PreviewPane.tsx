import { getPackMeta, getPreviewUrl } from "@/lib/packs";
import { cn } from "@/lib/utils";

interface PreviewPaneProps {
  packId: string | null;
  className?: string;
}

export function PreviewPane({ packId, className }: PreviewPaneProps) {
  const previewUrl = packId ? getPreviewUrl(packId) : null;
  const packMeta = packId ? getPackMeta(packId) : null;
  const isHtml = (packMeta?.scaffoldKind ?? "html") === "html";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-muted/30",
        className,
      )}
    >
      <div className="border-b border-border bg-muted/50 px-3 py-2 dark:bg-muted/30">
        <p className="text-xs font-medium text-foreground">目标效果预览</p>
        <p className="text-xs text-muted-foreground">
          {packMeta?.previewHint ??
            (isHtml
              ? "这是成品参考，不是让你复制——你的 index.html 从空白开始，用下方提示词让 AI 做出来"
              : "这是界面参考；真实运行请在对应开发工具中预览")}
        </p>
      </div>
      {previewUrl ? (
        <iframe
          title="项目预览"
          src={previewUrl}
          className="h-[320px] w-full border-0 bg-background sm:h-[380px]"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground sm:h-[380px]">
          请选择一个项目模板查看预览
        </div>
      )}
    </div>
  );
}
