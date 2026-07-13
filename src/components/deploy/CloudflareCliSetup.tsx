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

interface CloudflareCliSetupProps {
  onReadyChange?: (ready: boolean) => void;
  embedded?: boolean;
}

const SCAN_TOOLS = ["wrangler", "node", "npm"] as const;

export function CloudflareCliSetup({
  onReadyChange,
  embedded = false,
}: CloudflareCliSetupProps) {
  const {
    run: runScan,
    loading: scanLoading,
    data: scanData,
  } = useTauriCommand<ToolStatus[]>();
  const {
    run: runInstall,
    loading: installBusy,
    error: installError,
  } = useTauriCommand<CommandResult>();
  const [installLog, setInstallLog] = useState<string | null>(null);
  const { progress, streamLog } = useInstallProgress(installBusy);
  const mergedLog = [streamLog, installLog].filter(Boolean).join("\n\n");

  const wranglerStatus = scanData?.find((t) => t.name === "wrangler");
  const nodeStatus = scanData?.find((t) => t.name === "node");
  const ready = Boolean(wranglerStatus?.installed);

  const rescan = useCallback(async () => {
    await runScan("scan_tools", { tools: [...SCAN_TOOLS] });
  }, [runScan]);

  useEffect(() => {
    void runScan("scan_tools", { tools: [...SCAN_TOOLS] });
  }, [runScan]);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  const install = useCallback(async () => {
    setInstallLog(null);
    try {
      const result = await runInstall("install_tool", { tool: "wrangler" });
      if (result) setInstallLog(result.log);
      await rescan();
    } catch {
      // hook surfaces error
    }
  }, [runInstall, rescan]);

  const content = (
    <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {scanLoading && !wranglerStatus ? (
              <span className="text-muted-foreground">正在检测…</span>
            ) : ready ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                ✅ 已就绪
                {wranglerStatus?.version ? ` · ${wranglerStatus.version}` : ""}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                ⚠️ 未安装 — 请先安装再部署
                {!nodeStatus?.installed && "（需先在「准备环境」安装 Node.js）"}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {!ready && (
              <Button
                type="button"
                size="sm"
                disabled={installBusy || scanLoading}
                onClick={() => void install()}
              >
                {installBusy ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {installBusy ? "安装中…" : "一键安装 Wrangler"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={installBusy || scanLoading}
              onClick={() => void rescan()}
            >
              重新检测
            </Button>
          </div>
        </div>

        {(installBusy || mergedLog || installError) && (
          <InstallProgressPanel
            loading={installBusy}
            progress={progress}
            log={mergedLog || installError}
          />
        )}
    </div>
  );

  if (embedded) return content;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Wrangler CLI</CardTitle>
        <CardDescription>
          Cloudflare Pages 部署需要 Wrangler。需已安装 Node.js；此处一键安装到 VibeStart 的
          npm 目录。
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
