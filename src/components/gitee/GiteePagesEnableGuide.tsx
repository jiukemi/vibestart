import { AlertTriangle, ExternalLink, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import { cn } from "@/lib/utils";

/** Gitee Pages 已于 2024 年下线，新仓库服务菜单中不再出现该入口 */
export const GITEE_PAGES_DISCONTINUED =
  "Gitee Pages 静态站点服务已下线（2024 年起），仓库「服务」菜单中不再有 Gitee Pages，/pages 链接也会 404。代码推送成功 ≠ 网站已上线。";

export function buildGiteeRepoUrl(username: string, repo: string): string {
  const u = encodeURIComponent(username.trim());
  const r = encodeURIComponent(repo.trim());
  return `https://gitee.com/${u}/${r}`;
}

interface GiteePushResultGuideProps {
  username: string;
  repo: string;
  repoUrl?: string;
  /** preview：部署前说明；success：推送成功后 */
  variant?: "success" | "preview";
  /** 引导用户改选 Vercel 上线 */
  onSwitchToVercel?: () => void;
  className?: string;
}

export function GiteePushResultGuide({
  username,
  repo,
  repoUrl,
  variant = "success",
  onSwitchToVercel,
  className,
}: GiteePushResultGuideProps) {
  const { open, loading } = useOpenInAppBrowser();
  const url = repoUrl ?? buildGiteeRepoUrl(username, repo);
  const canOpen = Boolean(username.trim() && repo.trim());
  const isSuccess = variant === "success";

  const openRepo = () =>
    open(
      "open_external_browser",
      { url, title: "Gitee 仓库" },
      "正在打开浏览器…",
      "external",
    );

  return (
    <div
      className={cn(
        "rounded-lg border text-sm",
        isSuccess
          ? "border-amber-500/40 bg-amber-500/5 text-muted-foreground"
          : "border-amber-500/30 bg-amber-500/5 text-muted-foreground",
        className,
      )}
    >
      <div className="p-4">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          {isSuccess ? "代码已在 Gitee，但 Pages 已下线" : "Gitee Pages 已不可用"}
        </p>
        <p className="mt-2">{GITEE_PAGES_DISCONTINUED}</p>

        {isSuccess ? (
          <>
            <p className="mt-3">
              你的项目已成功推送到 Gitee 仓库，可在网页查看代码。若要<strong className="text-foreground">分享可访问的网站链接</strong>
              ，请改选上方 <strong className="text-foreground">Vercel</strong>（约 30 秒上线，国内一般可访问）。
            </p>
            <ol className="mt-3 list-inside list-decimal space-y-1.5">
              <li>在部署页点击 Vercel 卡片</li>
              <li>安装 Vercel CLI 并登录（若尚未完成）</li>
              <li>再次点击「开始部署」即可获得线上链接</li>
            </ol>
          </>
        ) : (
          <p className="mt-3">
            此选项仅将代码推送到 Gitee 做<strong className="text-foreground">国内 Git 托管</strong>。
            若要直接获得分享链接，请优先选择 <strong className="text-foreground">Vercel</strong>。
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {onSwitchToVercel && (
            <Button type="button" size="sm" onClick={onSwitchToVercel}>
              <Rocket className="size-4" />
              改选 Vercel 上线
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canOpen || loading}
            onClick={() => void openRepo()}
          >
            <ExternalLink className="size-4" />
            打开 Gitee 仓库
          </Button>
        </div>

        {!canOpen && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            请先填写上方的 Gitee 用户名与仓库名称。
          </p>
        )}
      </div>
    </div>
  );
}

/** @deprecated 使用 GiteePushResultGuide */
export const GiteePagesEnableGuide = GiteePushResultGuide;
export function buildGiteePagesAdminUrl(username: string, repo: string): string {
  return buildGiteeRepoUrl(username, repo);
}
