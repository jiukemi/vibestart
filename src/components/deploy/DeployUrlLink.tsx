import { ExternalLink } from "lucide-react";

import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import { cn } from "@/lib/utils";

interface DeployUrlLinkProps {
  url: string;
  className?: string;
  showIcon?: boolean;
  truncate?: boolean;
}

/** 部署链接：点击用系统浏览器打开（Tauri 内普通 <a> 不可靠） */
export function DeployUrlLink({
  url,
  className,
  showIcon = true,
  truncate = false,
}: DeployUrlLinkProps) {
  const { openExternal } = useOpenInAppBrowser();

  return (
    <button
      type="button"
      title={url}
      onClick={(e) => {
        e.stopPropagation();
        void openExternal(url);
      }}
      className={cn(
        "inline-flex max-w-full items-center gap-1 text-primary underline-offset-4 hover:underline",
        truncate && "min-w-0",
        className,
      )}
    >
      <span className={cn(truncate && "truncate")}>{url}</span>
      {showIcon && <ExternalLink className="size-3 shrink-0" />}
    </button>
  );
}
