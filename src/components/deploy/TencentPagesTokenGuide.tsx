import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  TENCENT_API_TOKEN_DOC_URL,
  TENCENT_CLOUD_HOME_URL,
  TENCENT_PAGES_CONSOLE_URL,
} from "@/components/deploy/EdgeOnePanels";
import { cn } from "@/lib/utils";

interface TencentPagesTokenGuideProps {
  browserLoading?: boolean;
  onOpenHome: () => void;
  onOpenConsole: () => void;
  showRegister?: boolean;
  onRegister?: () => void;
  /** 已填 Token 时只显示快捷入口 */
  compact?: boolean;
}

const SETUP_STEPS = [
  {
    title: "注册 / 登录腾讯云",
    detail:
      "没有账号时用微信或 QQ 注册；已有账号直接登录 cloud.tencent.com。",
  },
  {
    title: "打开 Makers（网页托管）控制台",
    detail:
      "点下方「打开网页托管控制台」。若页面不对，可在腾讯云首页搜索「EdgeOne」或「网页托管」进入 Makers。",
  },
  {
    title: "进入「设置」",
    detail:
      "在 Makers 控制台右上角或侧边栏找到「设置」（齿轮图标），点击进入。",
  },
  {
    title: "创建 API Token",
    detail:
      "在设置页找到「默认 API Token」区域 → 点击「创建 API Token」→ 填写描述（如 VibeStart 部署）→ 选择过期时间（建议 1 年）→ 提交。",
  },
  {
    title: "复制 Token 到本页",
    detail:
      "Token 通常只显示一次，请立即复制，粘贴到下方「API Token」输入框。此 Token 仅用于 CLI 部署，不要拼进分享链接。",
  },
  {
    title: "填写项目名称并部署",
    detail:
      "英文项目名，如 my-vibe-project。部署后在控制台点「预览」获取约 3 小时有效的分享链；长期请绑定自定义域名。",
  },
] as const;

export function TencentPagesTokenGuide({
  browserLoading = false,
  onOpenHome,
  onOpenConsole,
  showRegister = true,
  onRegister,
  compact = false,
}: TencentPagesTokenGuideProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={browserLoading}
          onClick={onOpenConsole}
        >
          打开 Makers 控制台
        </Button>
        <a
          href={TENCENT_API_TOKEN_DOC_URL}
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
        控制台<strong className="text-foreground">无法一键跳到</strong>
        Token 创建页。请打开 Makers 后依次点
        <strong className="text-foreground"> 设置 → 默认 API Token → 创建 API Token</strong>
        ，对照下方步骤操作即可。
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
            注册腾讯云
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={browserLoading}
          onClick={onOpenHome}
        >
          打开腾讯云首页
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={browserLoading}
          onClick={onOpenConsole}
        >
          打开 Makers 控制台
        </Button>
        <a
          href={TENCENT_API_TOKEN_DOC_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ExternalLink className="size-4" />
          官方文档
        </a>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        参考：{TENCENT_CLOUD_HOME_URL} · Makers 入口 {TENCENT_PAGES_CONSOLE_URL}
      </p>
    </div>
  );
}
