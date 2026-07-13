import { useCallback, useEffect, useMemo, useState } from "react";

import {

  ChevronDown,

  ChevronUp,

  Copy,

  Loader2,

  QrCode,

  RefreshCw,

  Stethoscope,

  Trash2,

} from "lucide-react";



import { DeployUrlQr } from "@/components/deploy/DeployUrlQr";
import { DeployUrlLink } from "@/components/deploy/DeployUrlLink";

import { Button } from "@/components/ui/button";

import {

  Card,

  CardContent,

  CardDescription,

  CardHeader,

  CardTitle,

} from "@/components/ui/card";

import { useTauriCommand } from "@/hooks/useTauriCommand";

import {

  DEPLOY_TARGET_LABELS,

  edgeoneShareUrlHint,

  formatDeployTime,

  normalizeDeployShareUrl,

  type DeployRecord,

} from "@/lib/deploy-records";

import type { DeployResult, UrlProbeResult } from "@/lib/tauri-types";

import { useWizardStore } from "@/stores/wizardStore";

import { cn } from "@/lib/utils";



interface DeployHistoryPanelProps {

  projectDir: string | null;

  records: DeployRecord[];

  onRedeploy?: () => void;

  redeployLoading?: boolean;

  /** 腾讯云刷新预览链：项目名称 + API Token */

  edgeoneProjectName?: string | null;

  edgeoneApiToken?: string | null;

  /** 切换部署方案时自动收起面板 */

  activeDeployTarget?: string | null;

  showWhenEmpty?: boolean;

  emptyHint?: string;

}



function historySummary(records: DeployRecord[]): string {

  if (records.length === 0) return "暂无记录";

  const latest = records[0];

  const label = DEPLOY_TARGET_LABELS[latest.target] ?? latest.target;

  const status = latest.success ? "成功" : "失败";

  return `共 ${records.length} 条 · 最近 ${status} · ${label} · ${formatDeployTime(latest.createdAt)}`;

}



export function DeployHistoryPanel({

  projectDir,

  records,

  onRedeploy,

  redeployLoading = false,

  edgeoneProjectName = null,

  edgeoneApiToken = null,

  activeDeployTarget = null,

  showWhenEmpty = false,

  emptyHint,

}: DeployHistoryPanelProps) {

  const [panelOpen, setPanelOpen] = useState(false);



  useEffect(() => {

    setPanelOpen(false);

  }, [activeDeployTarget]);



  const projectRecords = useMemo(() => {

    if (!projectDir) return records.slice(0, 10);

    return records.filter((r) => r.projectDir === projectDir).slice(0, 10);

  }, [projectDir, records]);



  if (projectRecords.length === 0 && !showWhenEmpty) {

    return null;

  }



  const summary = historySummary(projectRecords);



  return (

    <Card>

      <CardHeader className="pb-2">

        <div className="flex flex-wrap items-start justify-between gap-2">

          <button

            type="button"

            className="min-w-0 flex-1 space-y-1 text-left"

            onClick={() => setPanelOpen((v) => !v)}

            aria-expanded={panelOpen}

          >

            <div className="flex items-center gap-2">

              <CardTitle className="text-base">部署记录</CardTitle>

              {panelOpen ? (

                <ChevronUp className="size-4 shrink-0 text-muted-foreground" />

              ) : (

                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />

              )}

            </div>

            <CardDescription>

              {panelOpen

                ? "每次发版自动保存，可诊断链接、查看日志、再次部署或删除记录"

                : summary}

            </CardDescription>

          </button>

          {onRedeploy && projectRecords.length > 0 && panelOpen && (

            <Button

              type="button"

              size="sm"

              variant="outline"

              disabled={redeployLoading}

              onClick={onRedeploy}

            >

              {redeployLoading ? (

                <Loader2 className="size-4 animate-spin" />

              ) : (

                <RefreshCw className="size-4" />

              )}

              再次部署

            </Button>

          )}

        </div>

      </CardHeader>

      {panelOpen && (

        <CardContent className="space-y-2">

          {projectRecords.length === 0 ? (

            <div className="space-y-3 text-sm text-muted-foreground">

              <p>{emptyHint ?? "暂无部署记录。完成部署后会自动保存在这里。"}</p>

              {onRedeploy && (

                <Button type="button" size="sm" onClick={onRedeploy}>

                  去部署

                </Button>

              )}

            </div>

          ) : (

            projectRecords.map((record) => (

              <DeployRecordRow

                key={record.id}

                record={record}

                projectDir={projectDir}

                edgeoneProjectName={edgeoneProjectName}

                edgeoneApiToken={edgeoneApiToken}

              />

            ))

          )}

        </CardContent>

      )}

    </Card>

  );

}



function DeployRecordRow({

  record,

  projectDir,

  edgeoneProjectName,

  edgeoneApiToken,

}: {

  record: DeployRecord;

  projectDir: string | null;

  edgeoneProjectName?: string | null;

  edgeoneApiToken?: string | null;

}) {

  const removeDeployRecord = useWizardStore((s) => s.removeDeployRecord);

  const updateDeployRecord = useWizardStore((s) => s.updateDeployRecord);

  const setSelection = useWizardStore((s) => s.setSelection);

  const [expanded, setExpanded] = useState(false);

  const [showQr, setShowQr] = useState(false);

  const [copied, setCopied] = useState(false);

  const [probe, setProbe] = useState<UrlProbeResult | null>(null);

  const { run: runProbe, loading: probing } = useTauriCommand<UrlProbeResult>();

  const { run: runRefresh, loading: refreshing } = useTauriCommand<DeployResult>();



  const shareUrl = normalizeDeployShareUrl(record.url);

  const shareAltUrls = record.altUrls

    .map((u) => normalizeDeployShareUrl(u))

    .filter((u): u is string => Boolean(u));

  const shareHint = edgeoneShareUrlHint(shareUrl);



  const copyUrl = useCallback(async (url: string) => {

    await navigator.clipboard.writeText(url);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);

  }, []);



  const diagnose = useCallback(async () => {

    const target = shareUrl ?? shareAltUrls[0];

    if (!target) return;

    try {

      const result = await runProbe("probe_deploy_url", { url: target });

      if (result) setProbe(result);

    } catch {

      setProbe(null);

    }

  }, [runProbe, shareAltUrls, shareUrl]);



  const label = DEPLOY_TARGET_LABELS[record.target] ?? record.target;

  const canRefreshEdgeone =

    record.target === "edgeone-pages" &&

    Boolean(projectDir) &&

    Boolean(edgeoneProjectName?.trim()) &&

    Boolean(edgeoneApiToken?.trim());



  const refreshPreview = useCallback(async () => {

    if (!canRefreshEdgeone || !projectDir || !edgeoneProjectName || !edgeoneApiToken) {

      return;

    }

    try {

      const result = await runRefresh("refresh_edgeone_preview_url", {

        projectDir,

        projectName: edgeoneProjectName.trim(),

        apiToken: edgeoneApiToken.trim(),

      });

      if (result?.url) {

        updateDeployRecord(record.id, {

          url: result.url,

          altUrls: result.alt_urls ?? [],

          log: result.log,

          success: result.success,

        });

        if (record.projectDir === projectDir) {

          setSelection("deployUrl", result.url);

        }

      }

    } catch {

      // hook surfaces error

    }

  }, [

    canRefreshEdgeone,

    edgeoneApiToken,

    edgeoneProjectName,

    projectDir,

    record.id,

    record.projectDir,

    runRefresh,

    setSelection,

    updateDeployRecord,

  ]);



  return (

    <div className="rounded-lg border border-border bg-muted/20 dark:bg-muted/10">

      <button

        type="button"

        className="flex w-full items-start justify-between gap-2 p-3 text-left"

        onClick={() => setExpanded((v) => !v)}

        aria-expanded={expanded}

      >

        <div className="min-w-0 space-y-0.5">

          <div className="flex flex-wrap items-center gap-2 text-sm">

            <span

              className={cn(

                "font-medium",

                record.success

                  ? "text-emerald-600 dark:text-emerald-400"

                  : "text-destructive",

              )}

            >

              {record.success ? "成功" : "失败"}

            </span>

            <span className="text-muted-foreground">·</span>

            <span className="text-muted-foreground">{label}</span>

            <span className="text-muted-foreground">·</span>

            <span className="text-xs text-muted-foreground">

              {formatDeployTime(record.createdAt)}

            </span>

          </div>

          {!expanded && shareUrl && (
            <DeployUrlLink url={shareUrl} className="text-xs" truncate showIcon={false} />
          )}

        </div>

        {expanded ? (

          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />

        ) : (

          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />

        )}

      </button>



      {expanded && (

        <div className="space-y-2 border-t border-border px-3 pb-3 pt-0">

          {shareUrl && (
            <DeployUrlLink url={shareUrl} className="text-xs" truncate />
          )}

          {shareHint && (

            <p className="text-xs text-amber-700 dark:text-amber-300">{shareHint}</p>

          )}

          {shareAltUrls.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
              <span className="shrink-0">备用链接：</span>
              {shareAltUrls.map((alt, index) => (
                <span key={alt} className="inline-flex items-center gap-1">
                  {index > 0 && <span aria-hidden>·</span>}
                  <DeployUrlLink url={alt} className="text-xs" showIcon={false} />
                </span>
              ))}
            </div>
          )}

          {record.target === "vercel" && record.success && (

            <p className="text-xs text-muted-foreground">

              若打开是登录页，说明用了临时链接；请用 Aliased 生产域名或重新部署。

            </p>

          )}



          <div className="flex flex-wrap gap-1.5">

            {shareUrl && (

              <>

                <Button

                  type="button"

                  size="sm"

                  variant="outline"

                  className="h-7 px-2 text-xs"

                  onClick={() => void copyUrl(shareUrl)}

                >

                  <Copy className="size-3" />

                  {copied ? "已复制" : "复制"}

                </Button>

                <Button

                  type="button"

                  size="sm"

                  variant="outline"

                  className="h-7 px-2 text-xs"

                  disabled={probing}

                  onClick={() => void diagnose()}

                >

                  {probing ? (

                    <Loader2 className="size-3 animate-spin" />

                  ) : (

                    <Stethoscope className="size-3" />

                  )}

                  诊断

                </Button>

                {record.success && (

                  <Button

                    type="button"

                    size="sm"

                    variant="outline"

                    className="h-7 px-2 text-xs"

                    onClick={() => setShowQr((v) => !v)}

                  >

                    <QrCode className="size-3" />

                    扫码

                  </Button>

                )}

                {canRefreshEdgeone && (

                  <Button

                    type="button"

                    size="sm"

                    variant="outline"

                    className="h-7 px-2 text-xs"

                    disabled={refreshing}

                    onClick={() => void refreshPreview()}

                  >

                    {refreshing ? (

                      <Loader2 className="size-3 animate-spin" />

                    ) : (

                      <RefreshCw className="size-3" />

                    )}

                    刷新预览链

                  </Button>

                )}

              </>

            )}

            <Button

              type="button"

              size="sm"

              variant="ghost"

              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"

              aria-label="删除此条部署记录"

              onClick={() => removeDeployRecord(record.id)}

            >

              <Trash2 className="size-3" />

              删除

            </Button>

          </div>



          {showQr && shareUrl && record.success && (

            <div className="flex justify-start sm:justify-end">

              <DeployUrlQr url={shareUrl} size={88} />

            </div>

          )}

          {probe && (

            <div className="space-y-1 rounded-md border border-border bg-background/80 p-2 text-xs dark:bg-card/80">

              <p

                className={

                  probe.reachable

                    ? "text-emerald-600 dark:text-emerald-400"

                    : "text-amber-700 dark:text-amber-300"

                }

              >

                {probe.message}

                {probe.latency_ms != null && probe.reachable

                  ? ` · ${probe.latency_ms} ms`

                  : ""}

              </p>

              {probe.suggestions.map((s) => (

                <p key={s} className="text-muted-foreground">

                  · {s}

                </p>

              ))}

            </div>

          )}

          <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-[11px] whitespace-pre-wrap dark:bg-muted/20">

            {record.log}

          </pre>

        </div>

      )}

    </div>

  );

}

