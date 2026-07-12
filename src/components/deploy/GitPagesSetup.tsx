import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, RefreshCw } from "lucide-react";

import { GITEE_LINKS } from "@/components/gitee/GiteePanels";
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
import { interpretGitSshTest } from "@/lib/git-ssh-test";
import type { SshKeyInfo } from "@/lib/tauri-types";

const GITHUB_SSH_URL = "https://github.com/settings/ssh/new";

interface GitPagesSetupProps {
  provider: "gitee" | "github";
}

export function GitPagesSetup({ provider }: GitPagesSetupProps) {
  const host = provider === "gitee" ? "Gitee" : "GitHub";
  const {
    run: runEnsureKey,
    loading: keyLoading,
    data: sshData,
    error: keyError,
  } = useTauriCommand<SshKeyInfo>();
  const {
    run: runTestSsh,
    loading: testLoading,
    data: testRaw,
    error: testError,
  } = useTauriCommand<string>();
  const { open: openBrowser, loading: browserLoading } = useOpenInAppBrowser();

  const [copied, setCopied] = useState(false);

  const ensureKey = useCallback(async () => {
    await runEnsureKey("ensure_ssh_key");
  }, [runEnsureKey]);

  useEffect(() => {
    void ensureKey();
  }, [ensureKey]);

  const copyPublicKey = useCallback(async () => {
    if (!sshData?.public_key) return;
    await navigator.clipboard.writeText(sshData.public_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sshData?.public_key]);

  const testSsh = useCallback(async () => {
    const cmd = provider === "gitee" ? "test_gitee_ssh" : "test_github_ssh";
    await runTestSsh(cmd);
  }, [provider, runTestSsh]);

  const openSshPage = useCallback(() => {
    if (provider === "gitee") {
      const link = GITEE_LINKS.find((l) => l.id === "ssh");
      if (link) {
        void openBrowser(
          "open_external_browser",
          { url: link.url, title: link.label },
          "正在打开浏览器…",
          "external",
        );
      }
    } else {
      void openBrowser(
        "open_external_browser",
        { url: GITHUB_SSH_URL, title: "GitHub SSH 公钥" },
        "正在打开浏览器…",
        "external",
      );
    }
  }, [openBrowser, provider]);

  const sshInterpretation = testRaw
    ? interpretGitSshTest(testRaw, provider)
    : null;

  const keyReady = Boolean(sshData?.public_key);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">SSH 连接（一键配置）</CardTitle>
        <CardDescription>
          部署到 {host} Pages 需要 SSH 推送。VibeStart 会自动生成密钥并代为执行所有 Git
          命令，你只需把公钥粘贴到 {host} 网页一次。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {keyLoading && !sshData ? (
            <span className="text-muted-foreground">正在准备 SSH 密钥…</span>
          ) : keyReady ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              ✅ SSH 密钥已生成
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              ⚠️ 尚未生成 SSH 密钥
            </span>
          )}
          {sshInterpretation?.success && (
            <span className="text-emerald-600 dark:text-emerald-400">
              · {host} 连接正常
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={keyLoading}
            onClick={() => void ensureKey()}
          >
            {keyLoading ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {keyLoading ? "生成中…" : "一键生成 SSH 密钥"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!keyReady}
            onClick={() => void copyPublicKey()}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "已复制" : "复制 SSH 公钥"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={browserLoading || !keyReady}
            onClick={openSshPage}
          >
            <ExternalLink className="size-4" />
            打开 {host} 添加公钥
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={testLoading || !keyReady}
            onClick={() => void testSsh()}
          >
            {testLoading ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : null}
            {testLoading ? "测试中…" : "测试连接"}
          </Button>
        </div>

        {keyError && (
          <p className="text-sm text-destructive">{keyError}</p>
        )}

        {sshInterpretation && !sshInterpretation.success && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {sshInterpretation.summary}
          </p>
        )}

        {testError && (
          <p className="text-sm text-destructive">{testError}</p>
        )}

        <p className="text-xs text-muted-foreground">
          首次部署：先在 {host} 注册并
          {provider === "gitee" ? "完成实名认证，" : ""}
          新建<strong className="font-medium text-foreground">空仓库</strong>
          ，填写下方用户名与仓库名，再点「开始部署」。Git init / commit / push
          均由应用自动完成。
        </p>
      </CardContent>
    </Card>
  );
}
