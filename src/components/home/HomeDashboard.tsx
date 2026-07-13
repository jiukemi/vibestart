import { useCallback, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  Globe,
  KeyRound,
  Monitor,
  RotateCcw,
  Rocket,
  Sparkles,
} from "lucide-react";
import { AboutFooter } from "@/components/home/AboutFooter";
import { BrowserPresetPicker } from "@/components/browser/BrowserPresetPicker";
import { BackendAssistPanel } from "@/components/backend/BackendAssistPanel";
import { DeployHistoryPanel } from "@/components/deploy/DeployHistoryPanel";
import { DeployUrlQr } from "@/components/deploy/DeployUrlQr";
import { WorkbenchIdeLauncher } from "@/components/home/WorkbenchIdeLauncher";
import { GithubNetworkPanel } from "@/components/github/GithubPanels";
import { GoalPathPanel } from "@/components/goal/GoalPathPanel";
import { GoalSwitcherDialog } from "@/components/goal/GoalSwitcherDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOsInfo } from "@/hooks/useOsInfo";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { fileManagerLabel } from "@/lib/platform-ui";
import { normalizeDeployShareUrl } from "@/lib/deploy-records";
import { getGoalLabel } from "@/lib/build-goals";
import { supportsBackendAssist } from "@/lib/backend-assist";
import { getIdeOption } from "@/lib/ide";
import { getPackMeta } from "@/lib/packs";
import { wizardStepIndex } from "@/lib/wizard-index";
import { useWizardStore } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

const LLM_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  tongyi: "通义千问",
  zhipu: "智谱",
  kimi: "Kimi",
  openai: "OpenAI",
};

const GIT_LABELS: Record<string, string> = {
  github: "GitHub",
  skip: "未配置 Git",
};

const DEPLOY_LABELS: Record<string, string> = {
  vercel: "Vercel",
  "github-pages": "GitHub Pages",
  "edgeone-pages": "腾讯云网页托管",
  "cloudflare-pages": "Cloudflare Pages",
};

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors",
        "hover:border-primary/40 hover:bg-muted/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Icon className="size-5 text-primary" />
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

export function HomeDashboard() {
  const selections = useWizardStore((s) => s.selections);
  const openWizard = useWizardStore((s) => s.openWizard);
  const resetForNewProject = useWizardStore((s) => s.resetForNewProject);
  const deployHistory = useWizardStore((s) => s.deployHistory);

  const {
    projectDir,
    packId,
    primaryIde,
    llmProvider,
    gitProvider,
    deployTarget,
    deployUrl,
    buildGoal,
    appStack,
    wizardTrack,
    githubRepoName,
    edgeoneApiToken,
  } = selections;

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const [copied, setCopied] = useState(false);
  const revealCommand = useTauriCommand<void>();
  const { platform } = useOsInfo();

  const packMeta = packId ? getPackMeta(packId) : null;
  const ide = getIdeOption(primaryIde ?? "cursor");
  const shareDeployUrl = useMemo(
    () => normalizeDeployShareUrl(deployUrl),
    [deployUrl],
  );

  const copyUrl = useCallback(async () => {
    if (!shareDeployUrl) return;
    await navigator.clipboard.writeText(shareDeployUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareDeployUrl]);

  const revealProject = () => {
    if (!projectDir) return;
    void revealCommand.run("reveal_project_dir", { dir: projectDir });
  };

  return (
    <>
      <GoalSwitcherDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
      />
      <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          工作台
        </h1>
        <p className="text-sm text-muted-foreground">
          向导已完成。在这里继续开发、部署，或随时回到向导调整配置。
        </p>
      </header>

      <GoalPathPanel
        buildGoal={buildGoal}
        appStack={appStack}
        onSwitch={() => setGoalDialogOpen(true)}
      />

      {supportsBackendAssist(buildGoal) && (
        <BackendAssistPanel
          buildGoal={buildGoal}
          appStack={appStack}
          defaultCollapsed
        />
      )}

      {wizardTrack === "express" && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">完整向导（进阶）</CardTitle>
            <CardDescription>
              极速轨已跳过 IDE 选择与 Git。需要时可在此补开对应步骤。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                useWizardStore.getState().setSelection("wizardTrack", "full");
                openWizard(wizardStepIndex("pick-ide"));
              }}
            >
              <Monitor className="size-3.5" />
              选择 IDE
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                useWizardStore.getState().setSelection("wizardTrack", "full");
                openWizard(wizardStepIndex("git-hosting"));
              }}
            >
              <Globe className="size-3.5" />
              Git 托管
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                useWizardStore.getState().setSelection("wizardTrack", "full");
                openWizard(wizardStepIndex("setup-env"));
              }}
            >
              环境安装
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">当前配置概览</CardTitle>
          <CardDescription>你刚才走通的 0→1 流程摘要</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">开发方向</dt>
              <dd className="font-medium text-foreground">
                {buildGoal ? (
                  <>
                    {getGoalLabel(buildGoal, appStack)}
                    <Button
                      type="button"
                      variant="link"
                      className="ml-1 h-auto p-0 text-xs"
                      onClick={() => setGoalDialogOpen(true)}
                    >
                      切换
                    </Button>
                  </>
                ) : (
                  "未设置"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">项目模板</dt>
              <dd className="font-medium text-foreground">
                {packMeta?.title ?? packId ?? "未选择"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">主编辑器</dt>
              <dd className="font-medium text-foreground">{ide.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">LLM 提供商</dt>
              <dd className="font-medium text-foreground">
                {LLM_LABELS[llmProvider ?? ""] ?? llmProvider ?? "未设置"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Git / 部署</dt>
              <dd className="font-medium text-foreground">
                {GIT_LABELS[gitProvider ?? ""] ?? "—"}
                {deployTarget
                  ? ` · ${DEPLOY_LABELS[deployTarget] ?? deployTarget}`
                  : ""}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">项目文件夹</dt>
              <dd className="break-all font-medium text-foreground">
                {projectDir ?? "未选择"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <WorkbenchIdeLauncher projectDir={projectDir} />

      <BrowserPresetPicker compact />

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">常用操作</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            icon={FolderOpen}
            title="打开项目文件夹"
            description={`在 ${fileManagerLabel(platform)} 中查看项目文件`}
            onClick={revealProject}
            disabled={!projectDir || revealCommand.loading}
          />
          <QuickAction
            icon={Rocket}
            title="重新部署"
            description="更新线上版本或更换部署方式"
            onClick={() => openWizard(wizardStepIndex("deploy"))}
          />
          <QuickAction
            icon={KeyRound}
            title="同步 API Key"
            description="验证 Key 并同步到已安装的编辑器"
            onClick={() => openWizard(wizardStepIndex("llm-api-key"))}
          />
          <QuickAction
            icon={Sparkles}
            title="新建项目"
            description="重新选模板，开始下一个作品"
            onClick={resetForNewProject}
          />
          <QuickAction
            icon={Globe}
            title="Git 与网络"
            description="GitHub 访问助手与网络配置"
            onClick={() => openWizard(wizardStepIndex("git-hosting"))}
          />
        </div>
      </div>

      {shareDeployUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-4 text-primary" />
              线上地址
            </CardTitle>
            {deployTarget === "vercel" && (
              <CardDescription>
                vercel.com 国内一般能打开；*.vercel.app
                静态站多数可访问但速度因网络而异。若打不开请查下方部署记录的「诊断」。
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex-1 space-y-2">
              <a
                href={shareDeployUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all text-sm text-primary underline-offset-4 hover:underline"
              >
                {shareDeployUrl}
                <ExternalLink className="size-3.5 shrink-0" />
              </a>
              <div className="flex flex-wrap gap-2">
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
            <DeployUrlQr url={shareDeployUrl} size={100} className="p-4" />
            </div>
          </CardContent>
        </Card>
      )}

      <DeployHistoryPanel
        projectDir={projectDir}
        records={deployHistory}
        showWhenEmpty
        emptyHint="暂无部署记录。点「重新部署」完成首次上线后会自动保存在这里。"
        onRedeploy={() => openWizard(wizardStepIndex("deploy"))}
        edgeoneProjectName={githubRepoName}
        edgeoneApiToken={edgeoneApiToken}
      />

      {packMeta?.starterPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">继续开发提示</CardTitle>
            <CardDescription>
              在 {ide.name} 里可以继续用这段开场白让 AI 帮你迭代
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs whitespace-pre-wrap text-foreground dark:bg-muted/30">
              {packMeta.starterPrompt}
            </pre>
          </CardContent>
        </Card>
      )}

      {gitProvider === "github" && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">GitHub 网络</h2>
          <GithubNetworkPanel />
        </div>
      )}

      {revealCommand.error && (
        <p className="text-sm text-destructive">{revealCommand.error}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => openWizard(wizardStepIndex("complete"))}
        >
          查看完成总结
        </Button>
        <Button type="button" variant="ghost" onClick={resetForNewProject}>
          <RotateCcw className="size-4" />
          再做一次
        </Button>
      </div>

      <AboutFooter />
    </div>
    </>
  );
}
