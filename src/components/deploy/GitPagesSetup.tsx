import { useCallback, useEffect, useState } from "react";

import { Check, Copy, ExternalLink, KeyRound, RefreshCw } from "lucide-react";



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

import { cn } from "@/lib/utils";



const GITHUB_SSH_URL = "https://github.com/settings/ssh/new";



interface GitPagesSetupProps {

  provider: "github";

  embedded?: boolean;

}



export function GitPagesSetup({ embedded = false }: GitPagesSetupProps) {

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

    await runTestSsh("test_github_ssh");

  }, [runTestSsh]);



  const openSshPage = useCallback(() => {

    void openBrowser(

      "open_external_browser",

      { url: GITHUB_SSH_URL, title: "GitHub SSH 公钥" },

      "正在打开浏览器…",

      "external",

    );

  }, [openBrowser]);



  const sshInterpretation = testRaw

    ? interpretGitSshTest(testRaw, "github")

    : null;



  const keyReady = Boolean(sshData?.public_key);



  const body = (

    <div className="space-y-3">

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

            · GitHub 连接正常

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

          打开 GitHub 添加公钥

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



      {keyError && <p className="text-sm text-destructive">{keyError}</p>}



      {sshInterpretation && !sshInterpretation.success && (

        <p className="text-sm text-amber-600 dark:text-amber-400">

          {sshInterpretation.summary}

        </p>

      )}



      {testError && <p className="text-sm text-destructive">{testError}</p>}



      <p className="text-xs text-muted-foreground">

        VibeStart 会自动执行 git init / commit / push，无需打开终端。

      </p>

    </div>

  );



  if (embedded) {

    return (

      <div

        className={cn(

          "rounded-lg border border-border bg-muted/20 p-4 dark:bg-muted/10",

        )}

      >

        <p className="mb-1 text-sm font-medium text-foreground">

          SSH 连接（一键配置）

        </p>

        <p className="mb-3 text-xs text-muted-foreground">

          复制公钥到 GitHub 账户，测试连接通过后即可部署。

        </p>

        {body}

      </div>

    );

  }



  return (

    <Card className="border-border">

      <CardHeader className="pb-2">

        <CardTitle className="text-base">SSH 连接（一键配置）</CardTitle>

        <CardDescription>

          部署到 GitHub Pages 需要 SSH 推送。完成注册与仓库填写后再配置此项。

        </CardDescription>

      </CardHeader>

      <CardContent>{body}</CardContent>

    </Card>

  );

}

