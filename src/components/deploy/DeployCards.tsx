import { useState } from "react";
import { ExternalLink, GitBranch, Globe, Rocket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";
import {
  selectableCardClasses,
  selectableGridButtonClassName,
} from "@/lib/selectable-card";
import type { GitProvider } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

export type DeployTarget = "vercel" | "github-pages" | "gitee-pages";

interface DeployCardsProps {
  selected: DeployTarget;
  gitProvider: GitProvider | null;
  onSelect: (target: DeployTarget) => void;
  githubUsername: string;
  giteeUsername: string;
  githubRepoName: string;
  onGithubUsernameChange: (value: string) => void;
  onGiteeUsernameChange: (value: string) => void;
  onGithubRepoChange: (value: string) => void;
  onVercelLogin: () => void;
  vercelLoginLoading?: boolean;
  /** 极速轨：仅展示 Vercel */
  expressMode?: boolean;
  /** 已有项目部署轨：同时展示 Gitee + Vercel，默认国内 Gitee */
  deployOnlyMode?: boolean;
  children?: React.ReactNode;
}

export function DeployCards({
  selected,
  gitProvider,
  onSelect,
  githubUsername,
  giteeUsername,
  githubRepoName,
  onGithubUsernameChange,
  onGiteeUsernameChange,
  onGithubRepoChange,
  onVercelLogin,
  vercelLoginLoading = false,
  expressMode = false,
  deployOnlyMode = false,
  children,
}: DeployCardsProps) {
  const { open: openBrowser, loading: browserLoading } = useOpenInAppBrowser();
  const [browserHint, setBrowserHint] = useState<string | null>(null);
  const showGithub = !expressMode && !deployOnlyMode && gitProvider === "github";
  const showGitee = deployOnlyMode || (!expressMode && gitProvider === "gitee");
  const pagesUsername = showGitee ? giteeUsername : githubUsername;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid gap-4",
          showGithub || showGitee ? "lg:grid-cols-2" : "max-w-xl",
          deployOnlyMode && "lg:grid-cols-2",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect("vercel")}
          className={selectableGridButtonClassName()}
        >
          <Card
            className={selectableCardClasses(
              selected === "vercel",
              "hover:bg-muted/30",
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="size-5 text-primary" />
                Vercel
                {!deployOnlyMode && <Badge>推荐 · 约 30 秒</Badge>}
                {deployOnlyMode && <Badge variant="secondary">海外 / 备选</Badge>}
              </CardTitle>
              <CardDescription>
                零配置静态部署，适合快速分享你的第一个作品。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ol className="list-inside list-decimal space-y-1">
                <li>在下方安装 Vercel CLI（需 Node.js，准备环境步应已完成）</li>
                <li>用邮箱在浏览器注册 Vercel（无需 GitHub）</li>
                <li>注册后在下方登录，完成 CLI 授权（首次部署需要）</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                推荐在<strong className="font-medium text-foreground">系统浏览器（Chrome）</strong>
                注册并完成 CLI 登录。
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={browserLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    void openBrowser(
                      "open_external_browser",
                      {
                        url: "https://vercel.com/signup",
                        title: "注册 Vercel",
                      },
                      "正在打开浏览器…",
                      "external",
                    ).then(() =>
                      setBrowserHint(
                        "已在浏览器打开 Vercel 注册页。注册完成后请点「登录 Vercel」。",
                      ),
                    );
                  }}
                >
                  <ExternalLink className="size-4" />
                  浏览器打开注册
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={vercelLoginLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVercelLogin();
                  }}
                >
                  {vercelLoginLoading ? "启动中…" : "登录 Vercel"}
                </Button>
              </div>
              {browserHint && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{browserHint}</p>
              )}
            </CardContent>
          </Card>
        </button>

        {showGithub && (
          <button
            type="button"
            onClick={() => onSelect("github-pages")}
            className={selectableGridButtonClassName()}
          >
            <Card
              className={selectableCardClasses(
                selected === "github-pages",
                "hover:bg-muted/30",
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="size-5" />
                  GitHub Pages
                  <Badge variant="secondary">学习 Git 发布</Badge>
                </CardTitle>
                <CardDescription>
                  通过 git push 发布到 GitHub Pages。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <DeployRepoFields
                  username={githubUsername}
                  repo={githubRepoName}
                  onUsernameChange={onGithubUsernameChange}
                  onRepoChange={onGithubRepoChange}
                  pagesHost="github.io"
                />
              </CardContent>
            </Card>
          </button>
        )}

        {showGitee && (
          <button
            type="button"
            onClick={() => onSelect("gitee-pages")}
            className={selectableGridButtonClassName()}
          >
            <Card
              className={selectableCardClasses(
                selected === "gitee-pages",
                "hover:bg-muted/30",
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="size-5" />
                  Gitee Pages
                  <Badge variant={deployOnlyMode ? "default" : "secondary"}>
                    {deployOnlyMode ? "国内推荐 · 默认" : "国内推荐"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  推送到 Gitee 后在仓库服务中开启 Pages。国内分享链接更稳定。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {deployOnlyMode && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={browserLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        void openBrowser(
                          "open_external_browser",
                          {
                            url: "https://gitee.com/signup",
                            title: "注册 Gitee",
                          },
                          "正在打开浏览器…",
                          "external",
                        ).then(() =>
                          setBrowserHint(
                            "已在浏览器打开 Gitee 注册页。注册后请新建仓库并填写下方用户名与仓库名。",
                          ),
                        );
                      }}
                    >
                      <ExternalLink className="size-4" />
                      注册 Gitee
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={browserLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        void openBrowser(
                          "open_external_browser",
                          {
                            url: "https://gitee.com/projects/new",
                            title: "新建 Gitee 仓库",
                          },
                          "正在打开浏览器…",
                          "external",
                        );
                      }}
                    >
                      新建仓库
                    </Button>
                  </div>
                )}
                <DeployRepoFields
                  username={giteeUsername}
                  repo={githubRepoName}
                  onUsernameChange={onGiteeUsernameChange}
                  onRepoChange={onGithubRepoChange}
                  pagesHost="gitee.io"
                />
                <p className="text-xs text-muted-foreground">
                  部署后需在 Gitee 仓库 → 服务 → Gitee Pages 手动启动。
                </p>
              </CardContent>
            </Card>
          </button>
        )}
      </div>

      {gitProvider === "skip" && !deployOnlyMode && (
        <p className="text-sm text-muted-foreground">
          你选择了跳过 Git，推荐使用 Vercel 部署。若需 Pages，请回到「Git 托管」步骤配置
          Gitee 或 GitHub。
        </p>
      )}

      {deployOnlyMode && (
        <p className="text-sm text-muted-foreground">
          国内用户推荐 Gitee Pages；需能访问外网时可选 Vercel。部署前请确保已在 Gitee
          创建同名空仓库并配置 SSH。
        </p>
      )}

      {(showGithub || showGitee) && pagesUsername && githubRepoName && (
        <p className="text-xs text-muted-foreground">
          预计 Pages 地址：https://{pagesUsername || "username"}.
          {showGitee ? "gitee.io" : "github.io"}/{githubRepoName || "repo"}/
        </p>
      )}

      {children}
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
          用户名
        </label>
        <input
          id={`deploy-username-${pagesHost}`}
          type="text"
          value={username}
          onChange={(e) => {
            e.stopPropagation();
            onUsernameChange(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
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
          onChange={(e) => {
            e.stopPropagation();
            onRepoChange(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="my-vibe-project"
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
    </>
  );
}
