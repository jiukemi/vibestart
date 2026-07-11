import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

import { InstallProgressPanel } from "@/components/shared/InstallProgressPanel";
import { Button } from "@/components/ui/button";
import { useInstallProgress } from "@/hooks/useInstallProgress";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { DownloadUpdateResult, UpdateCheckResult } from "@/lib/tauri-types";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "vibestart-update-dismissed";

function isDismissed(tag: string | null | undefined) {
  if (!tag) return false;
  return localStorage.getItem(DISMISS_KEY) === tag;
}

function dismiss(tag: string) {
  localStorage.setItem(DISMISS_KEY, tag);
}

interface UpdateBannerProps {
  className?: string;
}

export function UpdateBanner({ className }: UpdateBannerProps) {
  const { run, loading, data } = useTauriCommand<UpdateCheckResult>();
  const [hidden, setHidden] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const { progress, streamLog } = useInstallProgress(downloading);

  const check = useCallback(() => {
    setDownloadNote(null);
    void run("check_for_update");
  }, [run]);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (data?.latest_tag && isDismissed(data.latest_tag)) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  }, [data?.latest_tag]);

  if (!data?.update_available || hidden) {
    return null;
  }

  const tag = data.latest_tag ?? `v${data.latest_version}`;

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadNote(null);
    try {
      const result = await invoke<DownloadUpdateResult>("download_app_update");
      setDownloadNote(result.message);
      if (!result.success && data.release_page_url) {
        await invoke("open_external_browser", { url: data.release_page_url });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDownloadNote(message);
      if (data.release_page_url) {
        await invoke("open_external_browser", { url: data.release_page_url });
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm",
        className,
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">新版本 {tag} 可用</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            当前 v{data.current_version} · 来源{" "}
            {data.mirror === "github" ? "GitHub" : "Gitee"}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
            点击「下载更新」将安装包保存到本机「下载」文件夹并打开所在位置；Mac 打开 .dmg
            拖入应用程序，Windows 运行 .exe 覆盖安装。
          </p>
          {downloadNote && (
            <p className="text-foreground mt-2 text-xs leading-relaxed">{downloadNote}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={check} disabled={loading || downloading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            检查
          </Button>
          <Button type="button" size="sm" onClick={() => void handleDownload()} disabled={downloading}>
            <Download className={cn("size-3.5", downloading && "animate-pulse")} />
            {downloading ? "下载中…" : "下载更新"}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="稍后提醒"
            onClick={() => {
              dismiss(tag);
              setHidden(true);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      {downloading && (
        <div className="mt-3">
          <InstallProgressPanel loading={downloading} progress={progress} log={streamLog} />
        </div>
      )}
    </div>
  );
}
