import { useCallback, useState } from "react";

import { Check, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { QRCodeSVG } from "qrcode.react";



import {

  DeployCards,

  type DeployTarget,

} from "@/components/deploy/DeployCards";

import { DeployHistoryPanel } from "@/components/deploy/DeployHistoryPanel";
import { TENCENT_PAGES_NAME } from "@/components/deploy/EdgeOnePanels";
import { parseCloudflareAccountId } from "@/components/deploy/CloudflarePanels";
import { createDeployRecord, edgeoneShareUrlHint, normalizeDeployShareUrl } from "@/lib/deploy-records";

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

  const githubUsername = useWizardStore((s) => s.selections.githubUsername);

  const githubRepoName = useWizardStore((s) => s.selections.githubRepoName);

  const edgeoneApiToken = useWizardStore((s) => s.selections.edgeoneApiToken);

  const cloudflareApiToken = useWizardStore(
    (s) => s.selections.cloudflareApiToken,
  );
  const cloudflareAccountId = useWizardStore(
    (s) => s.selections.cloudflareAccountId,
  );
  const vercelUsername = useWizardStore((s) => s.selections.vercelUsername);
  const userIntent = useWizardStore((s) => s.selections.userIntent);

  const setSelection = useWizardStore((s) => s.setSelection);
  const deployHistory = useWizardStore((s) => s.deployHistory);
  const addDeployRecord = useWizardStore((s) => s.addDeployRecord);
  const updateDeployRecord = useWizardStore((s) => s.updateDeployRecord);



  const deployOnly = isDeployOnlyIntent(userIntent);



  const [copied, setCopied] = useState(false);

  const [deployLog, setDeployLog] = useState<string | null>(null);

  const [deployUrl, setDeployUrl] = useState<string | null>(null);

  const [deployAltUrls, setDeployAltUrls] = useState<string[]>([]);

  const [deploySuccess, setDeploySuccess] = useState(false);

  const [deploySkipped, setDeploySkipped] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);

  const [vercelCliReady, setVercelCliReady] = useState(false);

  const [edgeoneCliReady, setEdgeoneCliReady] = useState(false);

  const [cloudflareCliReady, setCloudflareCliReady] = useState(false);



  const validateCommand = useTauriCommand<void>();

  const deployCommand = useTauriCommand<DeployResult>();
  const refreshEdgeoneCommand = useTauriCommand<DeployResult>();

  const loginCommand = useTauriCommand<string>();
  const cfLoginCommand = useTauriCommand<string>();
  const vercelSwitchCommand = useTauriCommand<string>();



  const selected = (deployTarget ?? "edgeone-pages") as DeployTarget;



  const handleDeploy = useCallback(async () => {

    if (!projectDir) return;



    setDeployLog(null);

    setDeployUrl(null);

    setDeployAltUrls([]);

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

      if (selected === "edgeone-pages") {

        const token = (edgeoneApiToken ?? "").trim();

        const name = (githubRepoName ?? "").trim();

        if (!token || !name) {

          setLocalError(`请填写项目名称和腾讯云 API Token 后再部署。`);

          deployCommand.reset();

          return;

        }

        result = await deployCommand.run("deploy_edgeone_pages", {

          projectDir,

          projectName: name,

          apiToken: token,

        });

      } else if (selected === "cloudflare-pages") {

        const name = (githubRepoName ?? "").trim();

        if (!name) {

          setLocalError("请填写 Cloudflare Pages 项目名称后再部署。");

          deployCommand.reset();

          return;

        }

        const token = (cloudflareApiToken ?? "").trim();
        const accountId = parseCloudflareAccountId(cloudflareAccountId);

        if (token && !accountId) {
          setLocalError(
            "已填写 API Token，请填写有效的 Account ID（粘贴 Workers 页链接或 32 位 ID）。",
          );
          deployCommand.reset();
          return;
        }

        result = await deployCommand.run("deploy_cloudflare_pages", {

          projectDir,

          projectName: name,

          apiToken: token || null,

          accountId: accountId ?? null,

        });

      } else if (selected === "vercel") {
        result = await deployCommand.run("deploy_vercel", { projectDir });

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

      if (projectDir) {
        addDeployRecord(
          createDeployRecord({
            target: selected,
            projectDir,
            success: result.success,
            url: result.url ?? null,
            altUrls: result.alt_urls ?? [],
            log: result.log,
          }),
        );
      }

      if (result.success && result.url) {

        const shareUrl = normalizeDeployShareUrl(result.url);

        if (!shareUrl) {
          setLocalError("部署已成功，但未能解析可分享的链接，请查看下方日志。");
          return;
        }

        setDeployUrl(shareUrl);

        setDeployAltUrls(
          (result.alt_urls ?? [])
            .map((u) => normalizeDeployShareUrl(u))
            .filter((u): u is string => Boolean(u)),
        );

        setDeploySuccess(true);

        setSelection("deployUrl", shareUrl);

      } else if (!result.success) {

        setLocalError(

          result.log.split("\n\n").pop()?.replace(/\*\*/g, "") ??

            "部署未成功，请查看下方日志。",

        );

      }

    } catch {

      // error handled by hook

    }

  }, [

    cloudflareApiToken,

    cloudflareAccountId,

    deployCommand,

    edgeoneApiToken,

    githubRepoName,

    githubUsername,

    projectDir,

    selected,

    setSelection,

    validateCommand,

    addDeployRecord,

    refreshEdgeoneCommand,

  ]);



  const copyUrl = useCallback(async () => {

    if (!deployUrl) return;

    await navigator.clipboard.writeText(deployUrl);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);

  }, [deployUrl]);



  const handleRefreshEdgeonePreview = useCallback(async () => {
    if (!projectDir || selected !== "edgeone-pages") return;
    const token = (edgeoneApiToken ?? "").trim();
    const name = (githubRepoName ?? "").trim();
    if (!token || !name) return;

    try {
      const result = await refreshEdgeoneCommand.run("refresh_edgeone_preview_url", {
        projectDir,
        projectName: name,
        apiToken: token,
      });
      if (result.log) {
        setDeployLog((prev) =>
          prev
            ? `${prev}\n\n--- 刷新预览链接 ---\n\n${result.log}`
            : result.log,
        );
      }
      const shareUrl = normalizeDeployShareUrl(result.url ?? null);
      if (shareUrl) {
        setDeployUrl(shareUrl);
        setDeployAltUrls(
          (result.alt_urls ?? [])
            .map((u) => normalizeDeployShareUrl(u))
            .filter((u): u is string => Boolean(u)),
        );
        setDeploySuccess(true);
        setSelection("deployUrl", shareUrl);
        const latest = deployHistory.find(
          (r) =>
            r.target === "edgeone-pages" && r.projectDir === projectDir,
        );
        if (latest) {
          updateDeployRecord(latest.id, {
            url: shareUrl,
            altUrls: result.alt_urls ?? [],
            log: result.log,
            success: true,
          });
        }
      }
    } catch {
      // hook surfaces error
    }
  }, [
    deployHistory,
    edgeoneApiToken,
    githubRepoName,
    projectDir,
    refreshEdgeoneCommand,
    selected,
    setSelection,
    updateDeployRecord,
  ]);



  const canDeploy =

    Boolean(projectDir) &&

    ((selected === "edgeone-pages" &&

      edgeoneCliReady &&

      Boolean((edgeoneApiToken ?? "").trim()) &&

      Boolean((githubRepoName ?? "").trim())) ||

      (selected === "cloudflare-pages" &&

        cloudflareCliReady &&

        Boolean((githubRepoName ?? "").trim()) &&

        (!(cloudflareApiToken ?? "").trim() ||
          Boolean(parseCloudflareAccountId(cloudflareAccountId)))) ||

      (selected === "vercel" && vercelCliReady) ||

      (selected === "github-pages" &&

        Boolean((githubUsername ?? "").trim()) &&

        Boolean((githubRepoName ?? "").trim())));



  const deployBlockReason = (() => {

    if (!projectDir) return "未找到项目目录，请先完成「首个项目」步骤。";

    if (selected === "edgeone-pages") {

      if (!edgeoneCliReady) return "请先完成步骤 2：安装部署工具。";

      if (!(githubRepoName ?? "").trim()) return "请填写项目名称。";

      if (!(edgeoneApiToken ?? "").trim()) return "请填写腾讯云 API Token。";

    }

    if (selected === "cloudflare-pages") {

      if (!cloudflareCliReady) return "请先完成步骤 2：安装 Wrangler CLI。";

      if (!(githubRepoName ?? "").trim()) return "请填写项目名称。";

      if (
        (cloudflareApiToken ?? "").trim() &&
        !parseCloudflareAccountId(cloudflareAccountId)
      ) {
        return "已填写 API Token，请填写有效的 Account ID（粘贴 Workers 页链接或 32 位 ID）。";
      }

    }

    if (selected === "vercel") {

      if (!vercelCliReady) return "请先完成步骤 2：安装 Vercel CLI 并登录。";

    }

    if (selected === "github-pages") {

      if (!(githubUsername ?? "").trim() || !(githubRepoName ?? "").trim()) {

        return "请填写 GitHub 用户名和仓库名称。";

      }

    }

    return null;

  })();



  const error =

    localError ??

    validateCommand.error ??

    deployCommand.error ??

    loginCommand.error ??
    cfLoginCommand.error ??
    vercelSwitchCommand.error;



  const loginMessage =
    loginCommand.data ?? cfLoginCommand.data ?? vercelSwitchCommand.data;



  return (

    <StepShell

      title={deployOnly ? "部署已有项目" : step.title}

      description={

        deployOnly

          ? `默认${TENCENT_PAGES_NAME}（国内推荐），也可选 Cloudflare / GitHub / Vercel`

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

          deployOnlyMode={deployOnly}

          deploySkipped={deploySkipped}

          onSelect={(target) => setSelection("deployTarget", target)}

          githubUsername={githubUsername ?? ""}

          githubRepoName={githubRepoName ?? ""}

          edgeoneApiToken={edgeoneApiToken ?? ""}

          cloudflareApiToken={cloudflareApiToken ?? ""}
          cloudflareAccountId={cloudflareAccountId ?? ""}
          vercelPersonalScope={vercelUsername ?? undefined}
          onGithubUsernameChange={(value) =>
            setSelection("githubUsername", value)
          }
          onGithubRepoChange={(value) =>
            setSelection("githubRepoName", value)
          }
          onEdgeoneApiTokenChange={(value) =>
            setSelection("edgeoneApiToken", value)
          }
          onCloudflareApiTokenChange={(value) =>
            setSelection("cloudflareApiToken", value)
          }
          onCloudflareAccountIdChange={(value) =>
            setSelection("cloudflareAccountId", value)
          }
          onEdgeoneCliReadyChange={setEdgeoneCliReady}
          onCloudflareCliReadyChange={setCloudflareCliReady}
          onVercelCliReadyChange={setVercelCliReady}
          onVercelAccountChange={(account) => {
            setSelection("vercelUsername", account?.personal_scope ?? null);
          }}
          onVercelLogin={() => void loginCommand.run("vercel_login")}
          onVercelTeamsSwitch={() =>
            void vercelSwitchCommand.run("vercel_teams_switch")
          }
          onCloudflareLogin={() => void cfLoginCommand.run("wrangler_login")}
          vercelLoginMessage={loginCommand.data}
          vercelSwitchMessage={vercelSwitchCommand.data}
          vercelSwitchLoading={vercelSwitchCommand.loading}

          cloudflareLoginLoading={cfLoginCommand.loading}

          canDeploy={canDeploy}

          deployBlockReason={deployBlockReason}

        >

          <div className="flex flex-wrap items-center gap-3">

            <Button

              type="button"

              onClick={() => void handleDeploy()}

              disabled={

                !canDeploy ||

                validateCommand.loading ||

                deployCommand.loading ||

                refreshEdgeoneCommand.loading

              }

            >

              {(validateCommand.loading || deployCommand.loading || refreshEdgeoneCommand.loading) && (

                <Loader2 className="size-4 animate-spin" />

              )}

              {validateCommand.loading

                ? "校验项目中…"

                : deployCommand.loading

                  ? "部署中…"

                  : refreshEdgeoneCommand.loading

                    ? "刷新预览链…"

                  : "开始部署"}

            </Button>

            {projectDir && (

              <p className="text-xs text-muted-foreground">

                项目：{projectDir}

              </p>

            )}

          </div>

        </DeployCards>



        {!deploySkipped && (
          <DeployHistoryPanel
            projectDir={projectDir}
            records={deployHistory}
            onRedeploy={() => void handleDeploy()}
            redeployLoading={
              validateCommand.loading ||
              deployCommand.loading ||
              refreshEdgeoneCommand.loading
            }
            edgeoneProjectName={githubRepoName}
            edgeoneApiToken={edgeoneApiToken}
            activeDeployTarget={selected}
          />
        )}



        {error && <p className="text-sm text-destructive">{error}</p>}



        {(deployCommand.loading || refreshEdgeoneCommand.loading || deployLog) && (

          <Card>

            <CardHeader>

              <CardTitle className="text-base">部署日志</CardTitle>

              <CardDescription>

                {deployCommand.loading || refreshEdgeoneCommand.loading

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

              {refreshEdgeoneCommand.loading && !deployCommand.loading && (

                <div className="flex items-center gap-2 text-sm text-muted-foreground">

                  <Loader2 className="size-4 animate-spin" />

                  正在刷新预览链接…

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

                    {selected === "edgeone-pages" && deployUrl && (
                      <p className="text-xs text-muted-foreground">
                        {edgeoneShareUrlHint(deployUrl) ??
                          "请完整复制链接（含 ?eo_token=），不要去掉校验参数。"}
                      </p>
                    )}

                    {selected === "vercel" && (

                      <p className="text-xs text-muted-foreground">

                        请用 Aliased 生产链接。若打开是登录页，说明链接类型不对，请点部署记录「诊断」。

                      </p>

                    )}

                    {deployAltUrls.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        若主链接打不开，可试备用：{deployAltUrls.join(" · ")}
                      </p>
                    )}

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

                      {selected === "edgeone-pages" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={refreshEdgeoneCommand.loading}
                          onClick={() => void handleRefreshEdgeonePreview()}
                        >
                          {refreshEdgeoneCommand.loading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          刷新预览链
                        </Button>
                      )}

                    </div>

                  </div>

                  <div className="rounded-lg border border-border bg-background p-3 dark:bg-card">

                    <QRCodeSVG value={deployUrl} size={96} />

                  </div>

                </div>

              )}

            </CardContent>

          </Card>

        )}



        {loginMessage && (

          <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground dark:bg-muted/30">

            {loginMessage}

          </p>

        )}

      </div>

    </StepShell>

  );

}

