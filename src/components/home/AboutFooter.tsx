import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { InstallProgressPanel } from "@/components/shared/InstallProgressPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInstallProgress } from "@/hooks/useInstallProgress";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { APP_VERSION } from "@/lib/app-version";
import type { DownloadUpdateResult, UpdateCheckResult } from "@/lib/tauri-types";

const SUPPORT_EMAIL = "jiukemi001@2925.com";

export function AboutFooter() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const { run: checkUpdate, loading: checking, data: updateData } =
    useTauriCommand<UpdateCheckResult>();
  const { progress, streamLog } = useInstallProgress(downloading);

  const handleAbout = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
    } catch {
      // 复制失败仍展示弹框，用户可手动复制
    }
    setAboutOpen(true);
  }, []);

  const handleVersionCheck = useCallback(() => {
    setDownloadNote(null);
    setVersionOpen(true);
    void checkUpdate("check_for_update");
  }, [checkUpdate]);

  const handleDownload = async () => {
    if (!updateData?.update_available) return;
    setDownloading(true);
    setDownloadNote(null);
    try {
      const result = await invoke<DownloadUpdateResult>("download_app_update");
      setDownloadNote(result.message);
      if (!result.success && updateData.release_page_url) {
        await invoke("open_external_browser", { url: updateData.release_page_url });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDownloadNote(message);
      if (updateData.release_page_url) {
        await invoke("open_external_browser", { url: updateData.release_page_url });
      }
    } finally {
      setDownloading(false);
    }
  };

  const latestTag =
    updateData?.latest_tag ??
    (updateData?.latest_version ? `v${updateData.latest_version}` : null);

  return (
    <>
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border pt-6 text-xs text-muted-foreground">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-xs text-muted-foreground"
          onClick={() => void handleAbout()}
        >
          关于我们
        </Button>
        <span aria-hidden className="text-border">
          ·
        </span>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-xs tabular-nums text-muted-foreground"
          onClick={handleVersionCheck}
        >
          v{APP_VERSION}
        </Button>
      </footer>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>关于我们</DialogTitle>
            <DialogDescription>
              邮箱已复制，可直接粘贴到邮件客户端联系我们。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">{SUPPORT_EMAIL}</p>
            <p>
              如有任何问题，请邮件联系我们，并尽量提供电脑型号、操作系统版本，以及在哪一步出现了问题。我们将尽快修复。
            </p>
            <p>点击底部版本号可手动检查更新；有新版本时工作台顶部也会自动提示。</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={versionOpen}
        onOpenChange={(open) => {
          if (!downloading) setVersionOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>版本检查</DialogTitle>
            <DialogDescription>
              当前 v{APP_VERSION}
              {updateData?.mirror && updateData.mirror !== "unknown"
                ? ` · 来源 ${updateData.mirror === "github" ? "GitHub" : "Gitee"}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {checking && (
              <p className="flex items-center gap-2 text-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在检查更新…
              </p>
            )}
            {!checking && updateData && (
              <>
                {updateData.update_available ? (
                  <p className="font-medium text-foreground">
                    发现新版本 {latestTag}
                  </p>
                ) : (
                  <p className="text-foreground">{updateData.message}</p>
                )}
                {updateData.update_available && (
                  <p>
                    点击「下载更新」将安装包保存到「下载」文件夹；Windows 运行 .exe
                    覆盖安装，Mac 打开 .dmg 拖入应用程序。
                  </p>
                )}
                {downloadNote && (
                  <p className="text-foreground">{downloadNote}</p>
                )}
              </>
            )}
          </div>

          {downloading && (
            <InstallProgressPanel loading={downloading} progress={progress} log={streamLog} />
          )}

          {!checking && updateData?.update_available && (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => void checkUpdate("check_for_update")}
                disabled={downloading}
              >
                重新检查
              </Button>
              <Button type="button" onClick={() => void handleDownload()} disabled={downloading}>
                <Download className="size-3.5" />
                {downloading ? "下载中…" : "下载更新"}
              </Button>
            </DialogFooter>
          )}

          {!checking && updateData && !updateData.update_available && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVersionOpen(false)}>
                关闭
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
