import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, SkipForward } from "lucide-react";

import { BrowserPresetPicker } from "@/components/browser/BrowserPresetPicker";
import {
  GithubBrowserPanel,
  GithubNetworkPanel,
} from "@/components/github/GithubPanels";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TENCENT_PAGES_NAME } from "@/components/deploy/EdgeOnePanels";
import { StepShell } from "@/components/wizard/StepShell";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { interpretGitSshTest } from "@/lib/git-ssh-test";
import type { GithubConnectivity, SshKeyInfo } from "@/lib/tauri-types";
import { getStepMeta } from "@/lib/wizard-index";
import { useWizardStore, type GitProvider } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

const step = getStepMeta("git-hosting");

const TRACKS: { id: GitProvider; title: string; hint: string }[] = [
  { id: "skip", title: "跳过 Git", hint: "CLI 一键部署" },
  { id: "github", title: "GitHub", hint: "纯外网 · 学 Git" },
];

const SUB_STEPS = [
  { id: "register", title: "注册账号", stage: "register" as const },
  { id: "repo", title: "创建仓库", stage: "repo" as const },
  { id: "ssh-key", title: "SSH 密钥", stage: "ssh" as const },
  { id: "test", title: "测试连接", stage: "test" as const },
] as const;

export function GitHostingStep() {
  const gitProvider = useWizardStore((s) => s.selections.gitProvider) ?? "skip";
  const githubUsername = useWizardStore((s) => s.selections.githubUsername);
  const githubRepoName = useWizardStore((s) => s.selections.githubRepoName);
  const setSelection = useWizardStore((s) => s.setSelection);

  const [subStep, setSubStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [githubUnreachable, setGithubUnreachable] = useState(false);

  const { run: runConnectivity, data: connectivity } =
    useTauriCommand<GithubConnectivity>();
  const { run: runEnsureKey, loading: sshLoading, data: sshData, error: sshError } =
    useTauriCommand<SshKeyInfo>();
  const { run: runTestSsh, loading: testLoading, error: testError } =
    useTauriCommand<string>();

  useEffect(() => {
    void runConnectivity("test_github_connectivity").then((result) => {
      if (result && !result.reachable) {
        setGithubUnreachable(true);
      }
    });
  }, [runConnectivity]);

  const ensureKey = useCallback(async () => {
    await runEnsureKey("ensure_ssh_key");
  }, [runEnsureKey]);

  const copyPublicKey = useCallback(async () => {
    if (!sshData?.public_key) return;
    await navigator.clipboard.writeText(sshData.public_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sshData?.public_key]);

  const testSsh = useCallback(async () => {
    const result = await runTestSsh("test_github_ssh");
    setTestResult(result ?? null);
  }, [runTestSsh]);

  const guideStage = SUB_STEPS[subStep]?.stage ?? "register";

  const sshInterpretation = useMemo(() => {
    if (!testResult || gitProvider === "skip") return null;
    return interpretGitSshTest(testResult, "github");
  }, [testResult, gitProvider]);

  const canProceedSub =
    subStep === 0 ||
    (subStep === 1 && (githubUsername ?? "").trim().length > 0) ||
    (subStep === 2 && sshData?.public_key) ||
    subStep === 3;

  const selectTrack = (track: GitProvider) => {
    setSelection("gitProvider", track);
    setSubStep(0);
    setTestResult(null);
    if (track === "github") {
      setSelection("deployTarget", "github-pages");
    } else {
      setSelection("deployTarget", "edgeone-pages");
    }
  };

  if (gitProvider === "skip") {
    return (
      <StepShell
        title={step.title}
        description={`不配置 Git 也可以完成部署 —— 推荐${TENCENT_PAGES_NAME}或 Cloudflare 一键上线。`}
        hideNext
        nextDisabled
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {TRACKS.map((track) => (
            <TrackButton
              key={track.id}
              track={track}
              active={gitProvider === track.id}
              onSelect={() => selectTrack(track.id)}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SkipForward className="size-5" />
              跳过 Git 托管
            </CardTitle>
            <CardDescription>
              适合只想快速上线、暂不学习 Git 的用户。部署步骤默认使用
              {TENCENT_PAGES_NAME}（国内推荐）。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-inside list-disc space-y-1">
              <li>部署步骤可选腾讯云 / Cloudflare / Vercel 一键部署</li>
              <li>Cursor 等 IDE 注册仍可用邮箱，无需 GitHub</li>
              <li>以后想学习 Git，可切换 GitHub 轨道（纯外网）</li>
            </ul>
          </CardContent>
        </Card>

        <GitHostingNextButton />
      </StepShell>
    );
  }

  return (
    <StepShell
      title={step.title}
      description={`配置 GitHub 账号与仓库，用于 git push 发布 Pages。国内用户建议优先${TENCENT_PAGES_NAME}。`}
      hideNext
      nextDisabled
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {TRACKS.map((track) => (
          <TrackButton
            key={track.id}
            track={track}
            active={gitProvider === track.id}
            onSelect={() => selectTrack(track.id)}
          />
        ))}
      </div>

      {githubUnreachable && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            检测到 GitHub 当前不可达（
            {connectivity?.latency_ms != null
              ? `${connectivity.latency_ms}ms`
              : "超时"}
            ）。GitHub 为纯外网服务，国内用户建议改用{" "}
            <strong className="text-foreground">{TENCENT_PAGES_NAME}</strong>{" "}
            部署，或配置网络加速后继续 GitHub。
          </CardContent>
        </Card>
      )}

      <GithubNetworkPanel />

      <div className="mb-4 flex flex-wrap gap-2">
        {SUB_STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => i <= subStep && setSubStep(i)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              i === subStep
                ? "bg-primary text-primary-foreground"
                : i < subStep
                  ? "bg-muted text-foreground"
                  : "bg-muted/50 text-muted-foreground",
            )}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </div>

      {subStep === 0 && (
        <>
          <GithubBrowserPanel compact stage={guideStage} />
          <BrowserPresetPicker compact defaultCollapsed />
          <Card>
            <CardHeader>
              <CardTitle>注册 GitHub 账号</CardTitle>
              <CardDescription>
                点击上方按钮在浏览器中完成注册，无需切换浏览器。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ol className="list-inside list-decimal space-y-2">
                <li>填写邮箱、密码、用户名</li>
                <li>验证邮箱并完成新手引导</li>
                <li>记住你的用户名，下一步会用到</li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}

      {subStep === 1 && (
        <>
          <GithubBrowserPanel compact stage={guideStage} />
          <Card>
            <CardHeader>
              <CardTitle>创建仓库</CardTitle>
              <CardDescription>
                点击「创建仓库」，建议命名为 my-vibe-project。可见性请选择公开（Public）。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                <li>仓库名填 my-vibe-project（或你喜欢的名字）</li>
                <li>选择公开（Public）</li>
                <li>不要勾选「使用 README 初始化」</li>
              </ol>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="git-username"
                    className="text-sm font-medium text-foreground"
                  >
                    GitHub 用户名
                  </label>
                  <input
                    id="git-username"
                    type="text"
                    value={githubUsername ?? ""}
                    onChange={(e) =>
                      setSelection("githubUsername", e.target.value)
                    }
                    placeholder="your-username"
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="git-repo"
                    className="text-sm font-medium text-foreground"
                  >
                    仓库名称
                  </label>
                  <input
                    id="git-repo"
                    type="text"
                    value={githubRepoName ?? ""}
                    onChange={(e) =>
                      setSelection("githubRepoName", e.target.value)
                    }
                    placeholder="my-vibe-project"
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {subStep === 2 && (
        <>
          <GithubBrowserPanel compact stage={guideStage} />
          <Card>
            <CardHeader>
              <CardTitle>配置 SSH 密钥</CardTitle>
              <CardDescription>
                生成密钥后，在浏览器打开「SSH 公钥」页面粘贴公钥。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void ensureKey()}
                disabled={sshLoading}
              >
                {sshLoading ? "生成中…" : "生成 / 确认 SSH 密钥"}
              </Button>
              {sshError && (
                <p className="text-sm text-destructive">{sshError}</p>
              )}
              {sshData?.public_key && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    公钥路径：{sshData.key_path}.pub — 复制后在 GitHub SSH
                    密钥设置页粘贴
                  </p>
                  <div className="relative">
                    <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground dark:bg-muted/30">
                      {sshData.public_key}
                    </pre>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => void copyPublicKey()}
                    >
                      {copied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copied ? "已复制" : "复制公钥"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {subStep === 3 && (
        <>
          <GithubBrowserPanel compact stage={guideStage} />
          <Card>
            <CardHeader>
              <CardTitle>测试 GitHub SSH 连接</CardTitle>
              <CardDescription>
                确认 SSH 密钥已添加；若失败，检查网络加速。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void testSsh()}
                disabled={testLoading}
              >
                {testLoading ? "测试中…" : "测试 SSH 连接"}
              </Button>
              {sshInterpretation && (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    sshInterpretation.success
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                      : "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200",
                  )}
                >
                  <p className="font-medium">{sshInterpretation.summary}</p>
                </div>
              )}
              {testError && (
                <p className="text-sm text-destructive">{testError}</p>
              )}
              {sshInterpretation?.detail && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    查看原始输出
                  </summary>
                  <pre className="mt-2 overflow-auto rounded-lg border border-border bg-muted/50 p-3 whitespace-pre-wrap text-foreground dark:bg-muted/30">
                    {sshInterpretation.detail}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <footer className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => subStep > 0 && setSubStep(subStep - 1)}
          disabled={subStep === 0}
        >
          上一步
        </Button>
        {subStep < SUB_STEPS.length - 1 ? (
          <Button
            type="button"
            disabled={!canProceedSub}
            onClick={() => setSubStep(subStep + 1)}
          >
            下一步
          </Button>
        ) : (
          <GitHostingNextButton />
        )}
      </footer>
    </StepShell>
  );
}

function TrackButton({
  track,
  active,
  onSelect,
}: {
  track: (typeof TRACKS)[number];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-lg border px-4 py-2 text-left text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted/50",
      )}
    >
      <span className="font-medium">{track.title}</span>
      <span className="ml-2 text-xs opacity-80">{track.hint}</span>
    </button>
  );
}

function GitHostingNextButton() {
  const currentStep = useWizardStore((s) => s.currentStep);
  const completeStep = useWizardStore((s) => s.completeStep);
  const goNext = useWizardStore((s) => s.goNext);

  return (
    <Button
      type="button"
      onClick={() => {
        completeStep(currentStep);
        goNext();
      }}
    >
      下一步
    </Button>
  );
}
