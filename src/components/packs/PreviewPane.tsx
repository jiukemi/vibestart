import { getPreviewUrl } from "@/lib/packs";
import { cn } from "@/lib/utils";

interface PreviewPaneProps {
  packId: string | null;
  className?: string;
}

export function PreviewPane({ packId, className }: PreviewPaneProps) {
  const previewUrl = packId ? getPreviewUrl(packId) : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-muted/30",
        className,
      )}
    >
      <div className="border-b border-border bg-muted/50 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          效果预览（只读参考，请勿直接复制代码）
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
