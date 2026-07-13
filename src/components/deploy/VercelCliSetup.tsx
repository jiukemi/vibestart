import { useCallback, useEffect, useState } from "react";

import { Download, LogOut, RefreshCw } from "lucide-react";



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

import type { CommandResult, ToolStatus, VercelAccountInfo } from "@/lib/tauri-types";



interface VercelCliSetupProps {

  onReadyChange?: (ready: boolean) => void;

  onAccountChange?: (account: VercelAccountInfo | null) => void;

  onRequestLogin?: () => void;

  loginMessage?: string | null;

  switchMessage?: string | null;

  embedded?: boolean;

}



const VERCEL_SCAN_TOOLS = ["vercel", "node", "npm"] as const;



export function VercelCliSetup({

  onReadyChange,

  onAccountChange,

  onRequestLogin,

  loginMessage,

  switchMessage,

  embedded = false,

}: VercelCliSetupProps) {

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

  const {

    run: runAccount,

    loading: accountLoading,

    data: accountData,

    error: accountError,

  } = useTauriCommand<VercelAccountInfo>();

  const { run: runLogout, loading: logoutLoading } =

    useTauriCommand<string>();



  const [installLog, setInstallLog] = useState<string | null>(null);

  const { progress, streamLog } = useInstallProgress(installBusy);

  const mergedLog = [streamLog, installLog].filter(Boolean).join("\n\n");



  const vercelStatus = scanData?.find((t) => t.name === "vercel");

  const nodeStatus = scanData?.find((t) => t.name === "node");

  const cliReady = Boolean(vercelStatus?.installed);

  const loggedIn = Boolean(accountData && !accountError);

  const ready = cliReady && loggedIn;



  const rescan = useCallback(async () => {

    await runScan("scan_tools", { tools: [...VERCEL_SCAN_TOOLS] });

  }, [runScan]);



  const fetchAccount = useCallback(async () => {

    if (!cliReady) {

      onAccountChange?.(null);

      return;

    }

    try {

      const account = await runAccount("vercel_account");

      onAccountChange?.(account ?? null);

    } catch {

      onAccountChange?.(null);

    }

  }, [cliReady, onAccountChange, runAccount]);



  useEffect(() => {

    void runScan("scan_tools", { tools: [...VERCEL_SCAN_TOOLS] });

  }, [runScan]);



  useEffect(() => {

    if (cliReady) {

      void fetchAccount();

    } else {

      onAccountChange?.(null);

    }

  }, [cliReady, fetchAccount, onAccountChange]);



  useEffect(() => {

    onReadyChange?.(ready);

  }, [ready, onReadyChange]);



  useEffect(() => {

    if (!cliReady || (!loginMessage && !switchMessage)) return;

    let stopped = false;
    const poll = () => {
      if (!stopped) void fetchAccount();
    };
    poll();
    const interval = window.setInterval(poll, 3000);
    const timeout = window.setTimeout(() => {
      stopped = true;
      window.clearInterval(interval);
    }, 90_000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };

  }, [cliReady, fetchAccount, loginMessage, switchMessage]);



  const install = useCallback(async () => {

    setInstallLog(null);

    try {

      const result = await runInstall("install_tool", { tool: "vercel" });

      if (result) setInstallLog(result.log);

      await rescan();

    } catch {

      // hook surfaces error

    }

  }, [runInstall, rescan]);



  const relogin = useCallback(async () => {

    try {

      await runLogout("vercel_logout");

      onAccountChange?.(null);

      onRequestLogin?.();

    } catch {

      onRequestLogin?.();

    }

  }, [onAccountChange, onRequestLogin, runLogout]);



  const content = (
    <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className="space-y-1 text-sm">

            {scanLoading && !vercelStatus ? (

              <span className="text-muted-foreground">正在检测…</span>

            ) : cliReady ? (

              <span className="text-emerald-600 dark:text-emerald-400">

                ✅ CLI 已安装

                {vercelStatus?.version ? ` · ${vercelStatus.version}` : ""}

              </span>

            ) : (

              <span className="text-amber-600 dark:text-amber-400">

                ⚠️ CLI 未安装

                {!nodeStatus?.installed && "（需先在「准备环境」安装 Node.js）"}

              </span>

            )}

            {cliReady && (

              <p>

                {accountLoading ? (

                  <span className="text-muted-foreground">正在读取账号…</span>

                ) : loggedIn && accountData ? (

                  <span className="text-emerald-600 dark:text-emerald-400">

                    ✅ {accountData.display_label}

                  </span>

                ) : (

                  <span className="text-amber-600 dark:text-amber-400">

                    ⚠️ 未登录 — 请点「登录 Vercel」

                  </span>

                )}

              </p>

            )}

          </div>

          <div className="flex flex-wrap gap-2">

            {!cliReady && (

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

                {installBusy ? "安装中…" : "一键安装 Vercel CLI"}

              </Button>

            )}

            {cliReady && !loggedIn && onRequestLogin && (

              <Button type="button" size="sm" onClick={onRequestLogin}>

                登录 Vercel

              </Button>

            )}

            {cliReady && (

              <Button

                type="button"

                size="sm"

                variant="outline"

                disabled={logoutLoading || accountLoading}

                onClick={() => void relogin()}

              >

                {logoutLoading ? (

                  <RefreshCw className="size-4 animate-spin" />

                ) : (

                  <LogOut className="size-4" />

                )}

                重新登录

              </Button>

            )}

            <Button

              type="button"

              size="sm"

              variant="outline"

              disabled={installBusy || scanLoading || accountLoading}

              onClick={() => {

                void rescan();

                void fetchAccount();

              }}

            >

              重新检测

            </Button>

          </div>

        </div>



        {accountError && cliReady && (

          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">

            {accountError.includes("token")

              ? "登录令牌无效或已过期。请点「重新登录」。"

              : loginMessage || switchMessage

                ? "登录进行中…完成 cmd 里的 Personal 选择后，此处会自动更新（约每 3 秒检测一次）。"

                : "尚未完成 CLI 登录。请点「登录 Vercel」。"}

          </p>

        )}



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
        <CardTitle className="text-base">Vercel CLI</CardTitle>
        <CardDescription>
          需安装 CLI 并完成登录。个人用户名会在登录后自动识别，无需手填。
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

