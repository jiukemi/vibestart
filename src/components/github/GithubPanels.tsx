import { Globe, Wifi } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CommandOutput } from "@/components/shared/CommandOutput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import {
  GITHUB_LINKS,
  GITHUB_STAGE_HINT,
  GITHUB_STAGE_LINK_IDS,
  type GithubGuideStage,
} from "@/lib/github-hosting-links";
import type {
  GithubConnectivity,
  NetworkConfig,
  NetworkStatus,
} from "@/lib/tauri-types";

interface GithubBrowserPanelProps {
  compact?: boolean;
  stage?: GithubGuideStage;
}

export function GithubBrowserPanel({
  compact = false,
  stage = "register",
}: GithubBrowserPanelProps) {
  const { open, loading, error } = useOpenInAppBrowser();

  const openLink = useCallback(
    (url: string, label: string) => {
      void open("open_github_in_app", { url, title: label });
    },
    [open],
  );

  const linkIds = GITHUB_STAGE_LINK_IDS[stage];
  const links = GITHUB_LINKS.filter((l) =>
    (linkIds as readonly string[]).includes(l.id),
  );

  return (
    <Card size={compact ? "sm" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="size-4" />
          GitHub 操作
        </CardTitle>
        <CardDescription>
          {GITHUB_STAGE_HINT[stage]}
          {stage === "register"
            ? " GitHub 登录/OAuth 若异常请用系统浏览器。"
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {links.map(({ label, url, icon: Icon }) => (
          <Button
            key={url}
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => openLink(url, label)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </CardContent>
      {error && (
        <CardContent className="pt-0">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      )}
    </Card>
  );
}

export function GithubNetworkPanel() {
  const { run: runGetStatus, data: statusData } =
    useTauriCommand<NetworkStatus>();
  const testCommand = useTauriCommand<GithubConnectivity>();
  const applyCommand = useTauriCommand<string>();
  const detectCommand = useTauriCommand<NetworkConfig>();

  const [config, setConfig] = useState<NetworkConfig>({
    enabled: false,
    http_proxy: "http://127.0.0.1:7890",
    socks_proxy: "127.0.0.1:7890",
  });
  const [applyLog, setApplyLog] = useState<string | null>(null);

  useEffect(() => {
    void runGetStatus("get_network_status");
  }, [runGetStatus]);

  useEffect(() => {
    if (statusData?.config) {
      setConfig(statusData.config);
    }
  }, [statusData]);

  const testConnection = useCallback(async () => {
    await testCommand.run("test_github_connectivity");
  }, [testCommand]);

  const useDetected = useCallback(async () => {
    const detected = await detectCommand.run("use_detected_proxy");
    if (detected) {
      setConfig(detected);
    }
  }, [detectCommand]);

  const applyNetwork = useCallback(async () => {
    setApplyLog(null);
    const result = await applyCommand.run("apply_github_network", { config });
    if (result) setApplyLog(result);
    await runGetStatus("get_network_status");
  }, [applyCommand, config, runGetStatus]);

  const connectivity = testCommand.data;
  const detected = statusData?.detected_proxies ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wifi className="size-4" />
          GitHub 访问助手
        </CardTitle>
        <CardDescription>
          VibeStart <strong className="font-medium text-foreground">不提供 VPN</strong>。
          若你已有 VPN/Clash，助手帮你检测并把代理写入 Git；若 GitHub 仍不通，建议改走 Gitee。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground dark:bg-muted/20">
          <p className="font-medium text-foreground">需要 VPN 吗？</p>
          <ul className="mt-1.5 list-inside list-disc space-y-1">
            <li>
              <strong className="text-foreground">已有 VPN 且全局可用</strong>
              ：先点「检测 GitHub 连接」，通了就不必再配；不通再点「使用检测到的系统代理」。
            </li>
            <li>
              <strong className="text-foreground">没有 VPN</strong>
              ：GitHub 可能无法访问，请选向导里的 <strong className="text-foreground">Gitee</strong> 或「跳过 Git」用 Vercel 部署。
            </li>
            <li>
              助手解决的是<strong className="text-foreground">注册、SSH、Git 推送</strong>，不是替代 VPN 产品。
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testCommand.loading}
            onClick={() => void testConnection()}
          >
            {testCommand.loading ? "检测中…" : "检测 GitHub 连接"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={detectCommand.loading}
            onClick={() => void useDetected()}
          >
            使用检测到的系统代理
          </Button>
        </div>

        {connectivity && (
          <p
            className={
              connectivity.reachable
                ? "text-sm text-emerald-600 dark:text-emerald-400"
                : "text-sm text-destructive"
            }
          >
            {connectivity.reachable ? "✅" : "❌"} {connectivity.message}
            {connectivity.latency_ms != null && ` (${connectivity.latency_ms}ms)`}
          </p>
        )}

        {detected.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground dark:bg-muted/20">
            <p className="mb-1 font-medium text-foreground">已检测到：</p>
            <ul className="list-inside list-disc space-y-1">
              {detected.map((p) => (
                <li key={p.source}>
                  {p.source}
                  {p.http_proxy ? ` · HTTP ${p.http_proxy}` : ""}
                  {p.socks_proxy ? ` · SOCKS ${p.socks_proxy}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              setConfig((c) => ({ ...c, enabled: e.target.checked }))
            }
            className="size-4 rounded border-input"
          />
          启用 Git / SSH 代理加速
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              HTTP 代理（Git）
            </label>
            <input
              type="text"
              value={config.http_proxy}
              onChange={(e) =>
                setConfig((c) => ({ ...c, http_proxy: e.target.value }))
              }
              placeholder="http://127.0.0.1:7890"
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              SOCKS5（SSH，可选）
            </label>
            <input
              type="text"
              value={config.socks_proxy ?? ""}
              onChange={(e) =>
                setConfig((c) => ({ ...c, socks_proxy: e.target.value }))
              }
              placeholder="127.0.0.1:7890"
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </div>

        {statusData?.git_proxy_applied && (
          <p className="text-xs text-muted-foreground">
            当前 Git 代理：{statusData.git_proxy_applied}
          </p>
        )}

        <Button
          type="button"
          disabled={applyCommand.loading}
          onClick={() => void applyNetwork()}
        >
          {applyCommand.loading ? "应用中…" : "应用网络配置"}
        </Button>

        {(applyLog || applyCommand.error) && (
          <CommandOutput log={applyLog ?? applyCommand.error} />
        )}

        <p className="text-xs text-muted-foreground">
          提示：请先在 Clash 等工具中开启「系统代理」或「TUN 模式」，再点「检测
          GitHub 连接」。Clash 默认 HTTP 端口常为 7890。
        </p>
      </CardContent>
    </Card>
  );
}
