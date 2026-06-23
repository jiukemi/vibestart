import { GitBranch, Rocket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DeployTarget = "vercel" | "github-pages";

interface DeployCardsProps {
  selected: DeployTarget;
  onSelect: (target: DeployTarget) => void;
  githubUsername: string;
  githubRepoName: string;
  onGithubUsernameChange: (value: string) => void;
  onGithubRepoChange: (value: string) => void;
  onVercelLogin: () => void;
  vercelLoginLoading?: boolean;
  children?: React.ReactNode;
}

export function DeployCards({
  selected,
  onSelect,
  githubUsername,
  githubRepoName,
  onGithubUsernameChange,
  onGithubRepoChange,
  onVercelLogin,
  vercelLoginLoading = false,
  children,
}: DeployCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("vercel")}
          className="text-left"
        >
          <Card
            className={cn(
              "h-full transition-colors hover:bg-muted/30",
              selected === "vercel" && "ring-2 ring-primary",
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="size-5 text-primary" />
                Vercel
                <Badge>推荐 · 约 30 秒</Badge>
              </CardTitle>
              <CardDescription>
                零配置静态部署，适合快速分享你的第一个作品。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ol className="list-inside list-decimal space-y-1">
                <li>
                  访问{" "}
                  <a
                    href="https://vercel.com/signup"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    vercel.com/signup
                  </a>{" "}
                  注册账号
                </li>
                <li>在终端完成登录（首次部署需要）</li>
              </ol>
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
                {vercelLoginLoading ? "登录中…" : "运行 vercel login"}
              </Button>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => onSelect("github-pages")}
          className="text-left"
        >
          <Card
            className={cn(
              "h-full transition-colors hover:bg-muted/30",
              selected === "github-pages" && "ring-2 ring-primary",
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="size-5" />
                GitHub Pages
                <Badge variant="secondary">学习 Git 发布</Badge>
              </CardTitle>
              <CardDescription>
                通过 git push 发布到 GitHub Pages，适合学习版本控制。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label
                  htmlFor="gh-username"
                  className="text-sm font-medium text-foreground"
                >
                  GitHub 用户名
                </label>
                <input
                  id="gh-username"
                  type="text"
                  value={githubUsername}
                  onChange={(e) => {
                    e.stopPropagation();
                    onGithubUsernameChange(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="your-username"
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="gh-repo"
                  className="text-sm font-medium text-foreground"
                >
                  仓库名称
                </label>
                <input
                  id="gh-repo"
                  type="text"
                  value={githubRepoName}
                  onChange={(e) => {
                    e.stopPropagation();
                    onGithubRepoChange(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="my-vibe-project"
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                部署地址：https://{githubUsername || "username"}.github.io/
                {githubRepoName || "repo"}/
              </p>
            </CardContent>
          </Card>
        </button>
      </div>

      {children}
    </div>
  );
}
