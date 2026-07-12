import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLaunchIde } from "@/hooks/useLaunchIde";
import { useOsInfo } from "@/hooks/useOsInfo";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { getIdeSyncGuide } from "@/lib/ide-sync-guides";
import type { IdeSyncVerifyItem } from "@/lib/tauri-types";
import { cn } from "@/lib/utils";

interface IdeSyncVerifyPanelProps {
  ides: string[];
  provider: string;
  apiKey: string;
  /** CLI 工具（Claude Code / Codex）优先在此目录启动 */
  projectDir?: string | null;
  /** 同步成功后自动验证 */
  autoVerify?: boolean;
  className?: string;
}

export function IdeSyncVerifyPanel({
  ides,
  provider,
  apiKey,
  projectDir,
  autoVerify = false,
  className,
}: IdeSyncVerifyPanelProps) {
  const [items, setItems] = useState<IdeSyncVerifyItem[]>([]);
  const [verified, setVerified] = useState(false);

  const {
    run: invokeVerify,
    loading: verifyLoading,
    error: verifyError,
  } = useTauriCommand<IdeSyncVerifyItem[]>();
  const { platform } = useOsInfo();
  const { launchIde, launching, launchError, dialog } = useLaunchIde();

  const runVerify = useCallback(async () => {
    if (!apiKey.trim() || ides.length === 0) return;
    const result = await invokeVerify("verify_ide_sync", {
      ides,
      provider,
      apiKey: apiKey.trim(),
    });
    if (result) {
      setItems(result);
      setVerified(true);
    }
  }, [apiKey, ides, invokeVerify, provider]);

  useEffect(() => {
    if (autoVerify && apiKey.trim() && ides.length > 0) {
      void runVerify();
    }
  }, [autoVerify, apiKey, ides.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ides.length === 0) return null;

  const allReady = items.length > 0 && items.every((i) => i.ready);

  return (
    <>
      {dialog}
      <Card
        size="sm"
        className={cn(
          allReady
            ? "border-emerald-500/30 bg-emerald-500/5"
            : verified
              ? "border-amber-500/30 bg-amber-500/5"
              : undefined,
          className,
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            同步验证与启动
          </CardTitle>
          <CardDescription>
            验证 Key 是否写入各编辑器，并可直接打开编辑器。若已在运行，可选择使用现有窗口。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={verifyLoading || !apiKey.trim()}
            onClick={() => void runVerify()}
          >
            {verifyLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            {verifyLoading ? "验证中…" : verified ? "重新验证" : "验证同步结果"}
          </Button>

          {verifyError && (
            <p className="text-xs text-destructive">{verifyError}</p>
          )}
          {launchError && (
            <p className="text-xs text-destructive">{launchError}</p>
          )}

          {items.map((item) => {
            const guide = getIdeSyncGuide(item.ide, platform);
            const needsManual = !item.ready && item.manual_steps.length > 0;

            return (
              <div
                key={item.ide}
                className="rounded-lg border border-border bg-background/60 p-3 dark:bg-background/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {item.ready ? (
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                      )}
                      {item.ide_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className={item.key_matched ? "text-emerald-600 dark:text-emerald-400" : ""}>
                        Key {item.key_matched ? "✓" : "✗"}
                      </span>
                      <span className={item.base_url_ok ? "text-emerald-600 dark:text-emerald-400" : ""}>
                        Base URL {item.base_url_ok ? "✓" : "✗"}
                      </span>
                      {["cursor", "trae", "windsurf"].includes(item.ide) && (
                        <span
                          className={
                            item.custom_enabled
                              ? "text-emerald-600 dark:text-emerald-400"
                              : ""
                          }
                        >
                          自定义 Key {item.custom_enabled ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={launching}
                    onClick={() => void launchIde(item.ide, projectDir)}
                  >
                    <Play className="size-3.5" />
                    打开编辑器
                  </Button>
                </div>

                {guide?.autoNote && (
                  <p className="mt-2 text-xs text-muted-foreground">{guide.autoNote}</p>
                )}

                {needsManual && (
                  <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 dark:bg-amber-500/10">
                    <p className="text-xs font-medium text-foreground">
                      {guide?.title ?? "还需手动确认"}
                      {guide?.settingsPath && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          （{guide.settingsPath}）
                        </span>
                      )}
                    </p>
                    <ol className="mt-1.5 list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
                      {(item.manual_steps.length > 0
                        ? item.manual_steps
                        : guide?.manualSteps ?? []
                      ).map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {item.ready && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <ExternalLink className="size-3" />
                    配置就绪，点击「打开编辑器」即可开始编程
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
