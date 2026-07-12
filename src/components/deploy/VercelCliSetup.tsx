import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { InstallProgressPanel } from "@/components/shared/InstallProgressPanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useInstallProgress } from "@/hooks/useInstallProgress";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { CommandResult, ToolStatus } from "@/lib/tauri-types";

interface VercelCliSetupProps {
  onReadyChange?: (ready: boolean) => void;
}

export function VercelCliSetup({ onReadyChange }: VercelCliSetupProps) {
  const scanCommand = useTauriCommand<ToolStatus[]>();
  const installCommand = useTauriCommand<CommandResult>();
  const [installLog, setInstallLog] = useState<string | null>(null);
  const installBusy = installCommand.loading;
  const { progress, streamLog } = useInstallProgress(installBusy);
  const mergedLog = [streamLog, installLog].filter(Boolean).join("\n\n");

  const vercelStatus = scanCommand.data?.find((t) => t.name === "vercel");
  const ready = Boolean(vercelStatus?.installed);

  const rescan = useCallback(async () => {
    await scanCommand.run("scan_environment");
  }, [scanCommand]);

  useEffect(() => {
    void rescan();
  }, [rescan]);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  const install = useCallback(async () => {
    setInstallLog(null);
    try {
      const result = await installCommand.run("install_tool", { tool: "vercel" });
      if (result) setInstallLog(result.log);
      await rescan();
    } catch {
      // hook surfaces error
    }
  }, [installCommand, rescan]);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Vercel CLI</CardTitle>
        <CardDescription>
          选 Vercel 部署时需要。需已安装 Node.js（在「准备环境」步骤完成）；此处一键安装到
          VibeStart 的 npm 目录。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {scanCommand.loading && !vercelStatus ? (
              <span className="text-muted-foreground">正在检测…</span>
            ) : ready ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                ✅ 已就绪
                {vercelStatus?.version ? ` · ${vercelStatus.version}` : ""}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                ⚠️ 未安装 — 请先安装再部署
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {!ready && (
              <Button
                type="button"
                size="sm"
                disabled={installBusy || scanCommand.loading}
                onClick={() => void install()}
              >
                {installBusy ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {installBusy ? "安装中…" : "一键安装 Vercel CLI"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={installBusy || scanCommand.loading}
              onClick={() => void rescan()}
            >
              重新检测
            </Button>
          </div>
        </div>

        {(installBusy || mergedLog || installCommand.error) && (
          <InstallProgressPanel
            loading={installBusy}
            progress={progress}
            log={mergedLog || installCommand.error}
          />
        )}

        {!ready && !installBusy && (
          <p className="text-xs text-muted-foreground">
            安装失败？见右侧故障排查「npm 未找到 / Vercel CLI 安装失败」。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
