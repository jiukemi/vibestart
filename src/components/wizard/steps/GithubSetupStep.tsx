import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepShell } from "@/components/wizard/StepShell";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { SshKeyInfo } from "@/lib/tauri-types";
import { WIZARD_STEPS } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

const step = WIZARD_STEPS[4];

const SUB_STEPS = [
  { id: "register", title: "注册 GitHub" },
  { id: "repo", title: "创建仓库" },
  { id: "ssh-key", title: "SSH 密钥" },
  { id: "test", title: "测试连接" },
] as const;

export function GithubSetupStep() {
  const [subStep, setSubStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const githubUsername = useWizardStore((s) => s.selections.githubUsername);
  const setSelection = useWizardStore((s) => s.setSelection);

  const sshCommand = useTauriCommand<SshKeyInfo>();
  const testCommand = useTauriCommand<string>();

  const ensureKey = useCallback(async () => {
    await sshCommand.run("ensure_ssh_key");
  }, [sshCommand]);

  const copyPublicKey = useCallback(async () => {
    if (!sshCommand.data?.public_key) return;
    await navigator.clipboard.writeText(sshCommand.data.public_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sshCommand.data?.public_key]);

  const testSsh = useCallback(async () => {
    const result = await testCommand.run("test_github_ssh");
    setTestResult(result ?? null);
  }, [testCommand]);

  const canProceedSub =
    subStep === 0 ||
    (subStep === 1 && (githubUsername ?? "").trim().length > 0) ||
    (subStep === 2 && sshCommand.data?.public_key) ||
    subStep === 3;

  return (
    <StepShell
      title={step.title}
      description={step.description}
      hideNext
      nextDisabled
    >
      <div className="mb-4 flex gap-2">
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
        <Card>
          <CardHeader>
            <CardTitle>注册 GitHub 账号</CardTitle>
            <CardDescription>
              如果还没有 GitHub 账号，请先完成注册。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-inside list-decimal space-y-2">
              <li>
                访问{" "}
                <a
                  href="https://github.com/signup"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  github.com/signup
                </a>{" "}
                注册账号
              </li>
              <li>验证邮箱并完成新手引导</li>
              <li>建议使用有意义的用户名，后续将用于部署</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {subStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>创建仓库</CardTitle>
            <CardDescription>
              创建一个用于存放项目的 GitHub 仓库。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>
                访问{" "}
                <a
                  href="https://github.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  github.com/new
                </a>
              </li>
              <li>填写仓库名称（例如 my-vibe-project）</li>
              <li>选择 Public，暂不勾选「Add a README」</li>
            </ol>
            <div className="space-y-2">
              <label
                htmlFor="github-username"
                className="text-sm font-medium text-foreground"
              >
                GitHub 用户名
              </label>
              <input
                id="github-username"
                type="text"
                value={githubUsername ?? ""}
                onChange={(e) =>
                  setSelection("githubUsername", e.target.value)
                }
                placeholder="your-username"
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {subStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>配置 SSH 密钥</CardTitle>
            <CardDescription>
              生成 SSH 密钥并添加到 GitHub Settings → SSH and GPG keys。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => void ensureKey()}
              disabled={sshCommand.loading}
            >
              {sshCommand.loading ? "生成中…" : "生成 / 确认 SSH 密钥"}
            </Button>
            {sshCommand.error && (
              <p className="text-sm text-destructive">{sshCommand.error}</p>
            )}
            {sshCommand.data?.public_key && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  公钥路径：{sshCommand.data.key_path}.pub
                </p>
                <div className="relative">
                  <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground">
                    {sshCommand.data.public_key}
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
                    {copied ? "已复制" : "复制"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {subStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>测试 GitHub SSH 连接</CardTitle>
            <CardDescription>
              确认 SSH 密钥已正确添加到 GitHub。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => void testSsh()}
              disabled={testCommand.loading}
            >
              {testCommand.loading ? "测试中…" : "测试 SSH 连接"}
            </Button>
            {testCommand.error && (
              <p className="text-sm text-destructive">{testCommand.error}</p>
            )}
            {testResult && (
              <pre className="overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground whitespace-pre-wrap">
                {testResult}
              </pre>
            )}
          </CardContent>
        </Card>
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
          <GithubNextButton />
        )}
      </footer>
    </StepShell>
  );
}

function GithubNextButton() {
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
