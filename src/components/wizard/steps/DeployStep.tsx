import { useCallback, useState } from "react";
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
import { WIZARD_STEPS } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizardStore";

const step = WIZARD_STEPS[7];

export function DeployStep() {
  const projectDir = useWizardStore((s) => s.selections.projectDir);
  const deployTarget = useWizardStore((s) => s.selections.deployTarget);
  const githubUsername = useWizardStore((s) => s.selections.githubUsername);
  const githubRepoName = useWizardStore((s) => s.selections.githubRepoName);
  const setSelection = useWizardStore((s) => s.setSelection);

  const [copied, setCopied] = useState(false);
  const [deployLog, setDeployLog] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState(false);

  const validateCommand = useTauriCommand<void>();
  const deployCommand = useTauriCommand<DeployResult>();
  const loginCommand = useTauriCommand<string>();

  const selected = (deployTarget ?? "vercel") as DeployTarget;

  const handleDeploy = useCallback(async () => {
    if (!projectDir) return;

    setDeployLog(null);
    setDeployUrl(null);
    setDeploySuccess(false);

    try {
      await validateCommand.run("validate_project", { projectDir });
    } catch {
      return;
    }

    try {
      let result: DeployResult;
      if (selected === "vercel") {
        result = await deployCommand.run("deploy_vercel", { projectDir });
      } else {
        const username = (githubUsername ?? "").trim();
        const repo = (githubRepoName ?? "").trim();
        if (!username || !repo) {
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
      }
    } catch {
      // error handled by hook
    }
  }, [
    deployCommand,
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
      ((githubUsername ?? "").trim() && (githubRepoName ?? "").trim()));

  const error = validateCommand.error ?? deployCommand.error ?? loginCommand.error;

  return (
    <StepShell
      title={step.title}
      description={step.description}
      nextDisabled={!deploySuccess}
    >
      <div className="space-y-4">
        {!projectDir && (
          <p className="text-sm text-destructive">
            未找到项目目录，请先完成「首个项目」步骤。
          </p>
        )}

        <DeployCards
          selected={selected}
          onSelect={(target) => setSelection("deployTarget", target)}
          githubUsername={githubUsername ?? ""}
          githubRepoName={githubRepoName ?? ""}
          onGithubUsernameChange={(value) =>
            setSelection("githubUsername", value)
          }
          onGithubRepoChange={(value) => setSelection("githubRepoName", value)}
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
                <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs whitespace-pre-wrap text-foreground">
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
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <QRCodeSVG value={deployUrl} size={96} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loginCommand.data && (
          <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs whitespace-pre-wrap text-foreground">
            {loginCommand.data}
          </pre>
        )}
      </div>
    </StepShell>
  );
}
