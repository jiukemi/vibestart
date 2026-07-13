import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  CLOUDFLARE_API_TOKEN_DOC_URL,
  CLOUDFLARE_DASHBOARD_URL,
  CLOUDFLARE_PAGES_OVERVIEW_URL,
} from "@/components/deploy/CloudflarePanels";
import { cn } from "@/lib/utils";

interface CloudflarePagesTokenGuideProps {
  browserLoading?: boolean;
  onOpenDashboard: () => void;
  onOpenApiTokens: () => void;
  onOpenPagesOverview?: () => void;
  showRegister?: boolean;
  onRegister?: () => void;
  compact?: boolean;
}

const SETUP_STEPS = [
  {
    title: "注册 / 登录 Cloudflare",
    detail:
      "打开 dash.cloudflare.com，用邮箱注册并验证；已有账号直接登录。",
  },
  {
    title: "复制 Account ID（重要）",
    detail:
      "点「打开 Workers 页」登录后，地址栏会出现 dash.cloudflare.com/【32位】/workers-and-pages。可粘贴整段链接到输入框（自动识别），或只复制中间 32 位。",
  },
  {
    title: "进入 API Tokens 页面",
    detail:
      "头像 → My Profile → API Tokens → Create Token → Custom token → Get started。",
  },
  {
    title: "设置 Token 权限",
    detail:
      "Account → Cloudflare Pages → Edit；Account Resources 选 Include → All accounts。Create Token 后复制到下方。",
  },
  {
    title: "创建并复制 Token",
    detail:
      "Account Resources 选 Include → All accounts。Create Token 后密钥只显示一次，立即粘贴到下方。",
  },
  {
    title: "填写 Account ID + 项目名称并部署",
    detail:
      "Account ID 与 Token 都填好后部署；或改用「Cloudflare 登录」走 wrangler OAuth。",
  },
] as const;

export function CloudflarePagesTokenGuide({
  browserLoading = false,
  onOpenDashboard,
  onOpenApiTokens,
  onOpenPagesOverview,
  showRegister = true,
  onRegister,
  compact = false,
}: CloudflarePagesTokenGuideProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {onOpenPagesOverview && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={browserLoading}
            onClick={onOpenPagesOverview}
          >
            查 Account ID
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={browserLoading}
          onClick={onOpenApiTokens}
        >
          打开 API Tokens 页
        </Button>
        <a
          href={CLOUDFLARE_API_TOKEN_DOC_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ExternalLink className="size-4" />
          官方文档
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        按 Cloudflare 官方 CI 文档，Wrangler 需要
        <strong className="text-foreground"> CLOUDFLARE_API_TOKEN </strong>
        与
        <strong className="text-foreground"> CLOUDFLARE_ACCOUNT_ID</strong>
        。仅 Pages → Edit 权限且未填 Account ID 时，常见错误为
        <code className="mx-1 text-[11px]">Failed to retrieve account IDs</code>
        。
      </p>

      <ol className="space-y-3 text-sm">
        {SETUP_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium text-foreground">{step.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        {showRegister && onRegister && (
          <Button type="button" size="sm" disabled={browserLoading} onClick={onRegister}>
            <ExternalLink className="size-4" />
            注册 Cloudflare
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={browserLoading}
          onClick={onOpenDashboard}
        >
          打开 Cloudflare 控制台
        </Button>
        {onOpenPagesOverview && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={browserLoading}
            onClick={onOpenPagesOverview}
          >
            查 Account ID
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={browserLoading}
          onClick={onOpenApiTokens}
        >
          打开 API Tokens 页
        </Button>
        <a
          href={CLOUDFLARE_API_TOKEN_DOC_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ExternalLink className="size-4" />
          官方文档
        </a>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        参考：{CLOUDFLARE_DASHBOARD_URL} · Account ID 见 {CLOUDFLARE_PAGES_OVERVIEW_URL}
      </p>
    </div>
  );
}
