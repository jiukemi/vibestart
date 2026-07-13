import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  ExternalLink,
  GitBranch,
  Globe,
  Rocket,
} from "lucide-react";

import { CloudflareAccountIdGuide } from "@/components/deploy/CloudflareAccountIdGuide";
import { CloudflareCliSetup } from "@/components/deploy/CloudflareCliSetup";
import { CloudflarePagesTokenGuide } from "@/components/deploy/CloudflarePagesTokenGuide";
import { CloudflarePagesTroubleGuide } from "@/components/deploy/CloudflarePagesTroubleGuide";
import {
  buildCloudflarePagesUrl,
  buildCloudflareWorkersPagesUrl,
  CLOUDFLARE_API_TOKENS_URL,
  CLOUDFLARE_DASHBOARD_URL,
  CLOUDFLARE_SIGNUP_URL,
  parseCloudflareAccountId,
} from "@/components/deploy/CloudflarePanels";
import { DeployFlowSection } from "@/components/deploy/DeployFlowSection";
import { EdgeOneCliSetup } from "@/components/deploy/EdgeOneCliSetup";
import { TencentPagesDomainNote } from "@/components/deploy/TencentPagesDomainNote";
import { TencentPagesTokenGuide } from "@/components/deploy/TencentPagesTokenGuide";
import {
  tencentPagesDeployUrlHint,
  TENCENT_CLOUD_HOME_URL,
  TENCENT_CLOUD_REGISTER_URL,
  TENCENT_PAGES_CONSOLE_URL,
  TENCENT_PAGES_NAME,
} from "@/components/deploy/EdgeOnePanels";
import { GitPagesSetup } from "@/components/deploy/GitPagesSetup";
import { VercelCliSetup } from "@/components/deploy/VercelCliSetup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import type { VercelAccountInfo } from "@/lib/tauri-types";
import { cn } from "@/lib/utils";

export type DeployTarget =
  | "edgeone-pages"
  | "cloudflare-pages"
  | "github-pages"
  | "vercel";

interface DeployOptionMeta {
  id: DeployTarget;
  name: string;
  tagline: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline";
}

const DEPLOY_OPTIONS: DeployOptionMeta[] = [
  {
    id: "edgeone-pages",
    name: TENCENT_PAGES_NAME,
    tagline: "国内首选 · 一键部署",
    icon: Globe,
    badge: "国内首选",
  },
  {
    id: "cloudflare-pages",
    name: "Cloudflare",
    tagline: "全球 CDN · *.pages.dev",
    icon: Cloud,
    badge: "全球 CDN",
    badgeVariant: "secondary",
  },
  {
    id: "github-pages",
    name: "GitHub Pages",
    tagline: "纯外网 · 需 Git",
    icon: GitBranch,
    badge: "纯外网",
    badgeVariant: "outline",
  },
  {
    id: "vercel",
    name: "Vercel",
    tagline: "约 30 秒 · 快速上线",
    icon: Rocket,
    badge: "约 30 秒",
  },
];

interface DeployCardsProps {
  selected: DeployTarget;
  onSelect: (target: DeployTarget) => void;
  githubUsername: string;
  githubRepoName: string;
  edgeoneApiToken: string;
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  vercelPersonalScope?: string;
  onGithubUsernameChange: (value: string) => void;
  onGithubRepoChange: (value: string) => void;
  onEdgeoneApiTokenChange: (value: string) => void;
  onCloudflareApiTokenChange: (value: string) => void;
  onCloudflareAccountIdChange: (value: string) => void;
  onVercelLogin: () => void;
  onVercelTeamsSwitch: () => void;
  onCloudflareLogin: () => void;
  onEdgeoneCliReadyChange?: (ready: boolean) => void;
  onCloudflareCliReadyChange?: (ready: boolean) => void;
  onVercelCliReadyChange?: (ready: boolean) => void;
  onVercelAccountChange?: (account: VercelAccountInfo | null) => void;
  vercelLoginMessage?: string | null;
  vercelSwitchMessage?: string | null;
  vercelSwitchLoading?: boolean;
  cloudflareLoginLoading?: boolean;
  deployOnlyMode?: boolean;
  deploySkipped?: boolean;
  canDeploy?: boolean;
  deployBlockReason?: string | null;
  children?: React.ReactNode;
}

export function DeployCards({
  selected,
  onSelect,
  githubUsername,
  githubRepoName,
  edgeoneApiToken,
  cloudflareApiToken,
  cloudflareAccountId,
  vercelPersonalScope,
  onGithubUsernameChange,
  onGithubRepoChange,
  onEdgeoneApiTokenChange,
  onCloudflareApiTokenChange,
  onCloudflareAccountIdChange,
  onVercelLogin,
  onVercelTeamsSwitch,
  onCloudflareLogin,
  onEdgeoneCliReadyChange,
  onCloudflareCliReadyChange,
  onVercelCliReadyChange,
  onVercelAccountChange,
  vercelLoginMessage,
  vercelSwitchMessage,
  vercelSwitchLoading,
  cloudflareLoginLoading = false,
  deployOnlyMode = false,
  deploySkipped = false,
  canDeploy = false,
  deployBlockReason = null,
  children,
}: DeployCardsProps) {
  const { open: openBrowser, loading: browserLoading } = useOpenInAppBrowser();
  const [browserHint, setBrowserHint] = useState<string | null>(null);

  useEffect(() => {
    setBrowserHint(null);
  }, [selected]);

  const active = DEPLOY_OPTIONS.find((o) => o.id === selected) ?? DEPLOY_OPTIONS[0];
  const ActiveIcon = active.icon;

  if (deploySkipped) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-background px-4 shadow-sm md:-mx-8 md:px-8">
        {deployOnlyMode && (
          <p className="border-b border-border/60 py-2 text-xs text-muted-foreground">
            已有项目部署 · 推荐 {TENCENT_PAGES_NAME}（国内一键部署）
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-4">
          {DEPLOY_OPTIONS.map((opt) => (
            <DeployTab
              key={opt.id}
              option={opt}
              active={selected === opt.id}
              onSelect={() => onSelect(opt.id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <ActiveIcon className="size-5 shrink-0 text-primary" />
          <span className="text-base font-semibold text-foreground">{active.name}</span>
          {active.badge && (
            <Badge variant={active.badgeVariant}>{active.badge}</Badge>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {panelDescription(selected, deployOnlyMode)}
        </p>
      </div>

      <Card className="overflow-visible">
        <CardContent className="space-y-6 pt-4">
          {selected === "edgeone-pages" && (
            <EdgeOnePanel
              githubRepoName={githubRepoName}
              edgeoneApiToken={edgeoneApiToken}
              onGithubRepoChange={onGithubRepoChange}
              onEdgeoneApiTokenChange={onEdgeoneApiTokenChange}
              onReadyChange={onEdgeoneCliReadyChange}
              browserHint={browserHint}
              browserLoading={browserLoading}
              onRegister={() =>
                void openBrowser(
                  "open_external_browser",
                  { url: TENCENT_CLOUD_REGISTER_URL, title: "注册腾讯云" },
                  "正在打开浏览器…",
                  "external",
                ).then(() =>
                  setBrowserHint(
                    "已打开注册页。登录 Makers 后：设置 → 默认 API Token → 创建 API Token。",
                  ),
                )
              }
              onOpenHome={() =>
                void openBrowser(
                  "open_external_browser",
                  { url: TENCENT_CLOUD_HOME_URL, title: "腾讯云" },
                  "正在打开浏览器…",
                  "external",
                ).then(() =>
                  setBrowserHint(
                    "已打开腾讯云首页。登录后进入 Makers（网页托管），再按下方步骤进入设置创建 Token。",
                  ),
                )
              }
              onOpenConsole={() =>
                void openBrowser(
                  "open_external_browser",
                  {
                    url: TENCENT_PAGES_CONSOLE_URL,
                    title: "腾讯云网页托管",
                  },
                  "正在打开浏览器…",
                  "external",
                ).then(() =>
                  setBrowserHint(
                    "已打开 Makers 控制台。请点「设置」→「默认 API Token」→「创建 API Token」，复制后粘贴到下方。",
                  ),
                )
              }
            />
          )}

          {selected === "cloudflare-pages" && (
            <CloudflarePanel
              githubRepoName={githubRepoName}
              cloudflareApiToken={cloudflareApiToken}
              cloudflareAccountId={cloudflareAccountId}
              onGithubRepoChange={onGithubRepoChange}
              onCloudflareApiTokenChange={onCloudflareApiTokenChange}
              onCloudflareAccountIdChange={onCloudflareAccountIdChange}
              onReadyChange={onCloudflareCliReadyChange}
              onCloudflareLogin={onCloudflareLogin}
              cloudflareLoginLoading={cloudflareLoginLoading}
              browserLoading={browserLoading}
              onRegister={() =>
                void openBrowser(
                  "open_external_browser",
                  { url: CLOUDFLARE_SIGNUP_URL, title: "注册 Cloudflare" },
                  "正在打开浏览器…",
                  "external",
                )
              }
              onOpenDashboard={() =>
                void openBrowser(
                  "open_external_browser",
                  { url: CLOUDFLARE_DASHBOARD_URL, title: "Cloudflare 控制台" },
                  "正在打开浏览器…",
                  "external",
                )
              }
              onOpenApiTokens={() =>
                void openBrowser(
                  "open_external_browser",
                  { url: CLOUDFLARE_API_TOKENS_URL, title: "Cloudflare API Tokens" },
                  "正在打开浏览器…",
                  "external",
                ).then(() =>
                  setBrowserHint(
                    "已打开 API Tokens 页。Create Token → Custom token → Account/Pages/Edit + User/User Details/Read。",
                  ),
                )
              }
              onOpenPagesOverview={() => {
                const workersUrl = buildCloudflareWorkersPagesUrl(cloudflareAccountId);
                const hasId = Boolean(parseCloudflareAccountId(cloudflareAccountId));
                void openBrowser(
                  "open_external_browser",
                  { url: workersUrl, title: "Workers & Pages" },
                  "正在打开浏览器…",
                  "external",
                ).then(() =>
                  setBrowserHint(
                    hasId
                      ? "已打开你的 Workers 页；Account ID 已识别，可直接部署。"
                      : "登录后地址栏会出现 …/【32位ID】/workers-and-pages。复制整段链接粘贴到 Account ID 输入框即可自动识别。",
                  ),
                );
              }}
              browserHint={browserHint}
            />
          )}

          {selected === "github-pages" && (
            <GitHubPanel
              githubUsername={githubUsername}
              githubRepoName={githubRepoName}
              onGithubUsernameChange={onGithubUsernameChange}
              onGithubRepoChange={onGithubRepoChange}
            />
          )}

          {selected === "vercel" && (
            <VercelPanel
              vercelPersonalScope={vercelPersonalScope}
              vercelLoggedIn={Boolean(vercelPersonalScope)}
              onReadyChange={onVercelCliReadyChange}
              onAccountChange={onVercelAccountChange}
              onVercelLogin={onVercelLogin}
              onVercelTeamsSwitch={onVercelTeamsSwitch}
              vercelLoginMessage={vercelLoginMessage}
              vercelSwitchMessage={vercelSwitchMessage}
              vercelSwitchLoading={vercelSwitchLoading ?? false}
              browserHint={browserHint}
              browserLoading={browserLoading}
              onRegister={() =>
                void openBrowser(
                  "open_external_browser",
                  { url: "https://vercel.com/signup", title: "注册 Vercel" },
                  "正在打开浏览器…",
                  "external",
                ).then(() =>
                  setBrowserHint(
                    "已在浏览器打开 Vercel 注册页。注册完成后在本页安装 CLI 并登录。",
                  ),
                )
              }
            />
          )}

          <DeployFlowSection step={4} title="开始部署">
            {!canDeploy && deployBlockReason && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {deployBlockReason}
              </p>
            )}
            {children}
          </DeployFlowSection>
        </CardContent>
      </Card>
    </div>
  );
}

function DeployTab({
  option,
  active,
  onSelect,
}: {
  option: DeployOptionMeta;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            active ? "bg-primary" : "bg-muted-foreground/35",
          )}
          aria-hidden
        />
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium text-foreground">
          {option.name}
        </span>
      </span>
      <span className="pl-3.5 text-[10px] leading-snug text-muted-foreground line-clamp-2">
        {option.tagline}
      </span>
    </button>
  );
}

function panelDescription(target: DeployTarget, deployOnlyMode: boolean): string {
  switch (target) {
    case "edgeone-pages":
      return deployOnlyMode
        ? "国内推荐默认方案：按顺序完成安装、取 Token、部署即可上线。"
        : "腾讯云网页托管，国内访问快；默认域名预览约 3 小时，长期分享请绑定自定义域名。";
    case "cloudflare-pages":
      return "Cloudflare 免费 Pages，全球 CDN 加速，适合需要海外访问的场景。";
    case "github-pages":
      return "通过 Git 推送到 GitHub Pages。纯外网，国内可能不稳定。";
    case "vercel":
      return "Vercel 零配置静态部署。vercel.com 国内一般能打开；*.vercel.app 多数可访问，速度因网络而异。";
  }
}

function EdgeOnePanel({
  githubRepoName,
  edgeoneApiToken,
  onGithubRepoChange,
  onEdgeoneApiTokenChange,
  onReadyChange,
  browserHint,
  browserLoading,
  onRegister,
  onOpenHome,
  onOpenConsole,
}: {
  githubRepoName: string;
  edgeoneApiToken: string;
  onGithubRepoChange: (value: string) => void;
  onEdgeoneApiTokenChange: (value: string) => void;
  onReadyChange?: (ready: boolean) => void;
  browserHint: string | null;
  browserLoading: boolean;
  onRegister: () => void;
  onOpenHome: () => void;
  onOpenConsole: () => void;
}) {
  const hasToken = Boolean(edgeoneApiToken.trim());
  return (
    <>
      <DeployFlowSection step={1} title="了解方案">
        <p className="text-sm text-muted-foreground">
          用腾讯云免费发布静态网页，国内打开快。部署后会分配
          <strong className="text-foreground">项目 / 部署域名</strong>
          （如 *.edgeone.cool），但国内合规要求访客使用带校验的预览链接或自定义域名。
        </p>
        <TencentPagesDomainNote />
      </DeployFlowSection>

      <DeployFlowSection step={2} title="安装部署工具">
        <EdgeOneCliSetup embedded onReadyChange={onReadyChange} />
      </DeployFlowSection>

      <DeployFlowSection step={3} title={hasToken ? "填写配置" : "注册与配置"}>
        {!hasToken && (
          <TencentPagesTokenGuide
            browserLoading={browserLoading}
            onRegister={onRegister}
            onOpenHome={onOpenHome}
            onOpenConsole={onOpenConsole}
          />
        )}
        {hasToken && (
          <>
            <p className="text-sm text-muted-foreground">
              已填写 Token。如需更换，可在下方修改；或重新在控制台「API Token」页创建新 Token。
            </p>
            <TencentPagesTokenGuide
              compact
              browserLoading={browserLoading}
              onOpenHome={onOpenHome}
              onOpenConsole={onOpenConsole}
            />
          </>
        )}
        {browserHint && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{browserHint}</p>
        )}
        <ProjectNameField
          id="edgeone-project"
          label="项目名称（英文）"
          value={githubRepoName}
          onChange={onGithubRepoChange}
          placeholder="my-vibe-project"
        />
        <TokenField
          id="edgeone-token"
          label="API Token"
          value={edgeoneApiToken}
          onChange={onEdgeoneApiTokenChange}
          placeholder="粘贴控制台「API Token」页创建的 Token"
        />
        {githubRepoName && (
          <p className="text-xs text-muted-foreground">
            {tencentPagesDeployUrlHint(githubRepoName)}
          </p>
        )}
      </DeployFlowSection>
    </>
  );
}

function CloudflarePanel({
  githubRepoName,
  cloudflareApiToken,
  cloudflareAccountId,
  onGithubRepoChange,
  onCloudflareApiTokenChange,
  onCloudflareAccountIdChange,
  onReadyChange,
  onCloudflareLogin,
  cloudflareLoginLoading,
  browserLoading,
  browserHint,
  onRegister,
  onOpenDashboard,
  onOpenApiTokens,
  onOpenPagesOverview,
}: {
  githubRepoName: string;
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  onGithubRepoChange: (value: string) => void;
  onCloudflareApiTokenChange: (value: string) => void;
  onCloudflareAccountIdChange: (value: string) => void;
  onReadyChange?: (ready: boolean) => void;
  onCloudflareLogin: () => void;
  cloudflareLoginLoading: boolean;
  browserLoading: boolean;
  browserHint: string | null;
  onRegister: () => void;
  onOpenDashboard: () => void;
  onOpenApiTokens: () => void;
  onOpenPagesOverview: () => void;
}) {
  const hasToken = Boolean(cloudflareApiToken.trim());
  const parsedAccountId = parseCloudflareAccountId(cloudflareAccountId);
  const accountIdInvalid =
    Boolean(cloudflareAccountId.trim()) && !parsedAccountId;
  const [accountIdHint, setAccountIdHint] = useState<string | null>(null);

  const applyAccountIdInput = (raw: string) => {
    const trimmed = raw.trim();
    const parsed = parseCloudflareAccountId(trimmed);
    const fromUrl = trimmed.includes("cloudflare.com");
    if (parsed && (fromUrl || /^[a-f0-9]{32}$/i.test(trimmed))) {
      onCloudflareAccountIdChange(parsed);
      setAccountIdHint(
        fromUrl ? "已从控制台链接识别 Account ID。" : "Account ID 格式正确。",
      );
      return;
    }
    onCloudflareAccountIdChange(trimmed);
    setAccountIdHint(null);
  };

  const pasteAccountIdFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setAccountIdHint("剪贴板为空。请先复制浏览器地址栏链接或 Account ID。");
        return;
      }
      applyAccountIdInput(text);
    } catch {
      setAccountIdHint("无法读取剪贴板，请手动粘贴到输入框。");
    }
  };

  return (
    <>
      <DeployFlowSection step={1} title="了解方案">
        <p className="text-sm text-muted-foreground">
          免费 *.pages.dev 域名，Wrangler CLI 一键部署，国内外均可访问。
        </p>
        <CloudflarePagesTroubleGuide />
      </DeployFlowSection>

      <DeployFlowSection step={2} title="安装 Wrangler CLI">
        <CloudflareCliSetup embedded onReadyChange={onReadyChange} />
      </DeployFlowSection>

      <DeployFlowSection step={3} title={hasToken ? "填写配置" : "注册与配置"}>
        {!hasToken && (
          <>
            <CloudflarePagesTokenGuide
              browserLoading={browserLoading}
              onRegister={onRegister}
              onOpenDashboard={onOpenDashboard}
              onOpenApiTokens={onOpenApiTokens}
              onOpenPagesOverview={onOpenPagesOverview}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cloudflareLoginLoading}
                onClick={onCloudflareLogin}
              >
                {cloudflareLoginLoading ? "启动中…" : "Cloudflare 登录（免填 Token）"}
              </Button>
            </div>
          </>
        )}
        {hasToken && (
          <>
            <p className="text-sm text-muted-foreground">
              已填写 API Token。请同时填写 Account ID（可粘贴控制台链接，自动识别）。
            </p>
            <p className="text-xs text-muted-foreground">
              部署时会自动退出本机 wrangler 旧登录，并隔离 pages.json 账号缓存（同一台电脑测多个账号时 Wrangler 会沿用旧 ID）。
              若改用 OAuth 登录，请先清空 API Token。
            </p>
            <CloudflarePagesTokenGuide
              compact
              browserLoading={browserLoading}
              onOpenDashboard={onOpenDashboard}
              onOpenApiTokens={onOpenApiTokens}
              onOpenPagesOverview={onOpenPagesOverview}
            />
          </>
        )}
        {browserHint && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{browserHint}</p>
        )}
        {accountIdHint && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{accountIdHint}</p>
        )}
        {accountIdInvalid && (
          <p className="text-xs text-destructive">
            无法识别 Account ID。请粘贴 Workers 页完整链接，或 32 位字母数字（不是 Zone ID）。
          </p>
        )}
        {parsedAccountId && (
          <p className="text-xs text-muted-foreground">
            已识别 Account ID：<code className="font-mono text-[11px]">{parsedAccountId}</code>
          </p>
        )}
        <ProjectNameField
          id="cf-project"
          label="项目名称"
          value={githubRepoName}
          onChange={onGithubRepoChange}
          placeholder="my-vibe-project"
        />
        <CloudflareAccountIdGuide />
        <div className="space-y-2">
          <label htmlFor="cf-account-id" className="text-sm font-medium text-foreground">
            Account ID
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="cf-account-id"
              type="text"
              value={cloudflareAccountId}
              onChange={(e) => applyAccountIdInput(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.includes("cloudflare.com")) {
                  e.preventDefault();
                  applyAccountIdInput(text);
                }
              }}
              placeholder="粘贴完整链接或 32 位 ID（从 Workers 页地址栏复制，勿用文档示例）"
              className="min-w-[12rem] flex-1 h-9 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onOpenPagesOverview()}
            >
              打开 Workers 页
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void pasteAccountIdFromClipboard()}
            >
              从剪贴板粘贴
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            支持粘贴跳转后的完整 URL（自动提取 ID）或手动填写 32 位 ID。使用 API Token 部署时必填。首次部署会自动创建同名 Pages 项目。
          </p>
        </div>
        <TokenField
          id="cf-token"
          label="API Token（可选）"
          value={cloudflareApiToken}
          onChange={onCloudflareApiTokenChange}
          placeholder="Pages/Edit + User Details/Read；新账号须新建 Token"
        />
        {githubRepoName && (
          <p className="text-xs text-muted-foreground">
            预计地址：{buildCloudflarePagesUrl(githubRepoName)}
          </p>
        )}
      </DeployFlowSection>
    </>
  );
}

function GitHubPanel({
  githubUsername,
  githubRepoName,
  onGithubUsernameChange,
  onGithubRepoChange,
}: {
  githubUsername: string;
  githubRepoName: string;
  onGithubUsernameChange: (value: string) => void;
  onGithubRepoChange: (value: string) => void;
}) {
  return (
    <>
      <DeployFlowSection step={1} title="了解方案">
        <p className="text-sm text-muted-foreground">
          通过 git push 发布到 GitHub Pages，适合学习 Git 工作流。
        </p>
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
          ⚠️ GitHub 为纯外网服务，国内用户可能无法注册、推送或访问 Pages，建议优先选
          {TENCENT_PAGES_NAME}。
        </p>
      </DeployFlowSection>

      <DeployFlowSection step={2} title="配置 Git 与 SSH">
        <GitPagesSetup provider="github" embedded />
      </DeployFlowSection>

      <DeployFlowSection step={3} title="填写仓库信息">
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>在 GitHub 新建空仓库</li>
          <li>填写用户名与仓库名（需与 GitHub 上一致）</li>
        </ol>
        <DeployRepoFields
          username={githubUsername}
          repo={githubRepoName}
          onUsernameChange={onGithubUsernameChange}
          onRepoChange={onGithubRepoChange}
          pagesHost="github.io"
        />
      </DeployFlowSection>
    </>
  );
}

function VercelPanel({
  vercelPersonalScope,
  vercelLoggedIn,
  onReadyChange,
  onAccountChange,
  onVercelLogin,
  onVercelTeamsSwitch,
  vercelLoginMessage,
  vercelSwitchMessage,
  vercelSwitchLoading,
  browserHint,
  browserLoading,
  onRegister,
}: {
  vercelPersonalScope?: string;
  vercelLoggedIn: boolean;
  onReadyChange?: (ready: boolean) => void;
  onAccountChange?: (account: VercelAccountInfo | null) => void;
  onVercelLogin: () => void;
  onVercelTeamsSwitch: () => void;
  vercelLoginMessage?: string | null;
  vercelSwitchMessage?: string | null;
  vercelSwitchLoading: boolean;
  browserHint: string | null;
  browserLoading: boolean;
  onRegister: () => void;
}) {
  return (
    <>
      <DeployFlowSection step={1} title="了解方案">
        <p className="text-sm text-muted-foreground">
          零配置静态部署，适合快速验证想法。部署后获得 项目名.vercel.app 稳定链接。
        </p>
        <p className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
          vercel.com 国内一般能打开；*.vercel.app
          静态站多数也能访问（Vercel 官方：无国内 CDN，速度不保证）。若打开是登录页 =
          链接类型不对，请重新部署或点「诊断」。国内要秒开请用腾讯云网页托管。
        </p>
      </DeployFlowSection>

      <DeployFlowSection step={2} title="安装 CLI 并登录">
        <VercelCliSetup
          embedded
          onReadyChange={onReadyChange}
          onAccountChange={onAccountChange}
          onRequestLogin={onVercelLogin}
          loginMessage={vercelLoginMessage}
          switchMessage={vercelSwitchMessage}
        />
      </DeployFlowSection>

      <DeployFlowSection step={3} title={vercelLoggedIn ? "账号" : "注册与登录"}>
        {!vercelLoggedIn && (
          <>
            <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
              <li>没有账号？先注册 Vercel</li>
              <li>
                浏览器点 Allow 后<strong className="text-foreground">不要关 cmd</strong>
                ，接着选 Personal / 你的用户名 (Hobby)
              </li>
            </ol>
            <Button type="button" size="sm" disabled={browserLoading} onClick={onRegister}>
              <ExternalLink className="size-4" />
              注册 Vercel
            </Button>
            {browserHint && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{browserHint}</p>
            )}
          </>
        )}
        {vercelLoggedIn && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            ✅ 已登录 · {vercelPersonalScope}（个人 Hobby，部署时使用）
          </p>
        )}
        {vercelLoggedIn && (
          <p className="text-sm text-muted-foreground">
            若误选了团队 scope，可切换到个人账号后再部署。
          </p>
        )}
        {!vercelLoggedIn && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
            登录请在上方「安装 CLI 并登录」步骤完成，不要手动打开 vercel.com/用户名。
          </p>
        )}
        {vercelLoggedIn && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={vercelSwitchLoading}
            onClick={onVercelTeamsSwitch}
          >
            {vercelSwitchLoading ? "启动中…" : "切换到个人账号"}
          </Button>
        )}
      </DeployFlowSection>
    </>
  );
}

function ProjectNameField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}

function TokenField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}

function DeployRepoFields({
  username,
  repo,
  onUsernameChange,
  onRepoChange,
  pagesHost,
}: {
  username: string;
  repo: string;
  onUsernameChange: (value: string) => void;
  onRepoChange: (value: string) => void;
  pagesHost: string;
}) {
  return (
    <>
      <div className="space-y-2">
        <label
          htmlFor={`deploy-username-${pagesHost}`}
          className="text-sm font-medium text-foreground"
        >
          GitHub 用户名
        </label>
        <input
          id={`deploy-username-${pagesHost}`}
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="your-username"
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor={`deploy-repo-${pagesHost}`}
          className="text-sm font-medium text-foreground"
        >
          仓库名称
        </label>
        <input
          id={`deploy-repo-${pagesHost}`}
          type="text"
          value={repo}
          onChange={(e) => onRepoChange(e.target.value)}
          placeholder="my-vibe-project"
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {username && repo && (
        <p className="text-xs text-muted-foreground">
          预计 Pages 地址：https://{username}.github.io/{repo}/
        </p>
      )}
    </>
  );
}
