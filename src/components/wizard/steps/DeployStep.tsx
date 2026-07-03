import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import {
  DeployCards,
  type DeployTarget,
} from "@/components/deploy/DeployCards";
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
import type { DeployResult } from "@/lib/tauri-types";
import { getStepMeta } from "@/lib/wizard-index";
import { isDeployOnlyIntent } from "@/lib/wizard-intent";
import { useWizardStore } from "@/stores/wizardStore";

const step = getStepMeta("deploy");

export function DeployStep() {
  const projectDir = useWizardStore((s) => s.selections.projectDir);
  const deployTarget = useWizardStore((s) => s.selections.deployTarget);
  const gitProvider = useWizardStore((s) => s.selections.gitProvider);
  const githubUsername = useWizardStore((s) => s.selections.githubUsername);
  const giteeUsername = useWizardStore((s) => s.selections.giteeUsername);
  const githubRepoName = useWizardStore((s) => s.selections.githubRepoName);
  const wizardTrack = useWizardStore((s) => s.selections.wizardTrack);
  const userIntent = useWizardStore((s) => s.selections.userIntent);
  const setSelection = useWizardStore((s) => s.setSelection);

  const deployOnly = isDeployOnlyIntent(userIntent);
  const expressMode = wizardTrack === "express" && !deployOnly;

  const [copied, setCopied] = useState(false);
  const [deployLog, setDeployLog] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [deploySkipped, setDeploySkipped] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateCommand = useTauriCommand<void>();
  const deployCommand = useTauriCommand<DeployResult>();
  const loginCommand = useTauriCommand<string>();

  const selected = (deployTarget ?? "vercel") as DeployTarget;

  useEffect(() => {
    if (deployOnly) {
      return;
    }
    if (gitProvider === "gitee" && selected !== "gitee-pages" && selected !== "vercel") {
      setSelection("deployTarget", "gitee-pages");
    } else if (gitProvider === "github" && selected === "gitee-pages") {
      setSelection("deployTarget", "github-pages");
    } else if (gitProvider === "skip" && selected !== "vercel") {
      setSelection("deployTarget", "vercel");
    }
  }, [deployOnly, gitProvider, selected, setSelection]);

  const handleDeploy = useCallback(async () => {
    if (!projectDir) return;

    setDeployLog(null);
    setDeployUrl(null);
    setDeploySuccess(false);
    setDeploySkipped(false);
    setLocalError(null);

    try {
      await validateCommand.run("validate_project", { projectDir });
    } catch {
      return;
    }

    try {
      let result: DeployResult;
      if (selected === "vercel") {
        result = await deployCommand.run("deploy_vercel", { projectDir });
      } else if (selected === "gitee-pages") {
        const username = (giteeUsername ?? "").trim();
        const repo = (githubRepoName ?? "").trim();
        if (!username || !repo) {
          setLocalError("请填写 Gitee 用户名和仓库名称后再部署。");
          deployCommand.reset();
          return;
        }
        result = await deployCommand.run("deploy_gitee_pages", {
          projectDir,
          username,
          repo,
        });
      } else {
        const username = (githubUsername ?? "").trim();
        const repo = (githubRepoName ?? "").trim();
        if (!username || !repo) {
          setLocalError("请填写 GitHub 用户名和仓库名称后再部署。");
          deployCommand.reset();
          return;
        }
        result = await deployCommand.run("deploy_github_pages", {
          projectDir,
          username,
          repo,
        });
      }

      setDeployLog(result.log);
      if (result.success && result.url) {
        setDeployUrl(result.url);
        setDeploySuccess(true);
        setSelection("deployUrl", result.url);
      } else if (!result.success) {
        setLocalError("部署未成功，请查看下方日志或稍后重试。");
      }
    } catch {
      // error handled by hook
    }
  }, [
    deployCommand,
    giteeUsername,
    githubRepoName,
    githubUsername,
    projectDir,
    selected,
    setSelection,
    validateCommand,
  ]);

  const copyUrl = useCallback(async () => {
    if (!deployUrl) return;
    await navigator.clipboard.writeText(deployUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [deployUrl]);

  const canDeploy =
    Boolean(projectDir) &&
    (selected === "vercel" ||
      (selected === "gitee-pages" &&
        (giteeUsername ?? "").trim() &&
        (githubRepoName ?? "").trim()) ||
      (selected === "github-pages" &&
        (githubUsername ?? "").trim() &&
        (githubRepoName ?? "").trim()));

  const error =
    localError ?? validateCommand.error ?? deployCommand.error ?? loginCommand.error;

  return (
    <StepShell
      title={deployOnly ? "部署已有项目" : step.title}
      description={
        deployOnly
          ? "默认 Gitee Pages（国内推荐），也可切换 Vercel"
          : step.description
      }
      nextDisabled={!deploySuccess && !deploySkipped}
      nextLabel={deploySkipped ? "下一步：查看总结" : "完成，查看总结"}
      secondaryNext={
        !deploySuccess && !deploySkipped
          ? {
              label: "暂时跳过，稍后部署",
              onClick: () => {
                setDeploySkipped(true);
                setSelection("deployUrl", null);
              },
            }
          : undefined
      }
    >
      <div className="space-y-4">
        {deployOnly && (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground dark:bg-primary/10">
            已有项目部署轨：推荐{" "}
            <strong className="text-foreground">Gitee Pages</strong>{" "}
            便于国内访问。推送后请在 Gitee 仓库 → 服务 → Gitee Pages 手动启动。
          </p>
        )}

        {expressMode && (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground dark:bg-primary/10">
            极速轨：使用 <strong className="text-foreground">Vercel</strong>{" "}
            一键部署即可分享链接。GitHub / Gitee Pages 可在工作台切换完整轨后再试。
          </p>
        )}

        {!projectDir && (
          <p className="text-sm text-destructive">
            未找到项目目录，请先完成「首个项目」步骤。
          </p>
        )}

        {deploySkipped && (
          <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground dark:bg-muted/30">
            已跳过部署。你仍可在工作台或重新进入本步骤完成上线；本地项目路径已保存在上一步。
          </p>
        )}

        <DeployCards
          selected={selected}
          gitProvider={gitProvider}
          expressMode={expressMode}
          deployOnlyMode={deployOnly}
          onSelect={(target) => setSelection("deployTarget", target)}
          githubUsername={githubUsername ?? ""}
          giteeUsername={giteeUsername ?? ""}
          githubRepoName={githubRepoName ?? ""}
          onGithubUsernameChange={(value) =>
            setSelection("githubUsername", value)
          }
          onGiteeUsernameChange={(value) =>
            setSelection("giteeUsername", value)
          }
          onGithubRepoChange={(value) =>
            setSelection("githubRepoName", value)
          }
          onVercelLogin={() => void loginCommand.run("vercel_login")}
          vercelLoginLoading={loginCommand.loading}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleDeploy()}
              disabled={
                !canDeploy ||
                validateCommand.loading ||
                deployCommand.loading
              }
            >
              {(validateCommand.loading || deployCommand.loading) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {validateCommand.loading
                ? "校验项目中…"
                : deployCommand.loading
                  ? "部署中…"
                  : "开始部署"}
            </Button>
            {projectDir && (
              <p className="text-xs text-muted-foreground">
                项目：{projectDir}
              </p>
            )}
          </div>
        </DeployCards>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {(deployCommand.loading || deployLog) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">部署日志</CardTitle>
              <CardDescription>
                {deployCommand.loading
                  ? "正在执行部署命令，请稍候…"
                  : deploySuccess
                    ? "部署完成"
                    : "部署遇到问题，请查看日志"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deployCommand.loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  运行中…
                </div>
              )}
              {deployLog && (
                <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs whitespace-pre-wrap text-foreground dark:bg-muted/30">
                  {deployLog}
                </pre>
              )}
              {deploySuccess && deployUrl && (
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      你的网站已上线 🎉
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={deployUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {deployUrl}
                        <ExternalLink className="size-3.5" />
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void copyUrl()}
                      >
                        {copied ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        {copied ? "已复制" : "复制链接"}
                      </Button>
                    </div>
                    {selected === "gitee-pages" && (
                      <p className="text-xs text-muted-foreground">
                        若页面暂未生效，请到 Gitee 仓库 → 服务 → Gitee Pages 点击「启动」或「更新」。
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3 dark:bg-card">
                    <QRCodeSVG value={deployUrl} size={96} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loginCommand.data && (
          <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground dark:bg-muted/30">
            {loginCommand.data}
          </p>
        )}
        {loginCommand.error && (
          <p className="text-sm text-destructive">{loginCommand.error}</p>
        )}
      </div>
    </StepShell>
  );
}
