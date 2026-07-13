import { useCallback, useEffect, useState } from "react";

import { Download, RefreshCw } from "lucide-react";



import { TENCENT_PAGES_NAME } from "@/components/deploy/EdgeOnePanels";

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



interface EdgeOneCliSetupProps {

  onReadyChange?: (ready: boolean) => void;

  embedded?: boolean;

}



const SCAN_TOOLS = ["edgeone", "node", "npm"] as const;



export function EdgeOneCliSetup({ onReadyChange, embedded = false }: EdgeOneCliSetupProps) {

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



  const edgeoneStatus = scanData?.find((t) => t.name === "edgeone");

  const nodeStatus = scanData?.find((t) => t.name === "node");

  const ready = Boolean(edgeoneStatus?.installed);



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

      const result = await runInstall("install_tool", { tool: "edgeone" });

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

            {scanLoading && !edgeoneStatus ? (

              <span className="text-muted-foreground">正在检测…</span>

            ) : ready ? (

              <span className="text-emerald-600 dark:text-emerald-400">

                ✅ 已就绪，可以部署

                {edgeoneStatus?.version ? ` · ${edgeoneStatus.version}` : ""}

              </span>

            ) : (

              <span className="text-amber-600 dark:text-amber-400">

                ⚠️ 尚未安装 — 请先点右侧按钮

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

                {installBusy ? "安装中…" : "一键安装部署工具"}

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
        <CardTitle className="text-base">部署工具（{TENCENT_PAGES_NAME}）</CardTitle>
        <CardDescription>
          一键把网页上传到腾讯云。需已安装 Node.js（「准备环境」步完成）；此处自动安装部署小工具。
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

