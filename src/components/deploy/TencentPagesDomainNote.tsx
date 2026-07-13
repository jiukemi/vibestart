import { ExternalLink } from "lucide-react";

import { TENCENT_DOMAIN_DOC_URL } from "@/components/deploy/EdgeOnePanels";

export function TencentPagesDomainNote() {
  return (
    <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
      <p className="font-medium text-foreground">关于默认域名（重要）</p>
      <p>
        Makers 会分配<strong className="text-foreground">项目域名 / 部署域名</strong>
        （如 <code className="text-[11px]">*.edgeone.cool</code>
        ），但在<strong className="text-foreground">中国大陆加速区域</strong>
        下，为保障内容合规，访客须使用控制台或 CLI 生成的
        <strong className="text-foreground">预览链接</strong>（含校验参数，约
        <strong className="text-foreground"> 3 小时</strong>
        有效）。直接打开不带校验信息的裸链可能返回 401。
      </p>
      <p>
        需要<strong className="text-foreground">长期对外分享</strong>：请在 Makers
        控制台「域名管理」绑定<strong className="text-foreground">自定义域名</strong>
        （CNAME + HTTPS）。详见
        <a
          href={TENCENT_DOMAIN_DOC_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-1 inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
        >
          官方域名说明
          <ExternalLink className="size-3" />
        </a>
      </p>
      <p className="text-muted-foreground">
        预览链接过期后：在部署记录或部署结果处点「刷新预览链」自动重新生成；也可在 Makers
        控制台项目概览右上角点「预览」。首次分享须复制<strong className="text-foreground">完整链接</strong>
        （含 <code className="text-[11px]">?eo_token=</code>），浏览器会自动写入 cookie。
      </p>
    </div>
  );
}
