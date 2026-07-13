import {
  CLOUDFLARE_ACCOUNT_ID_URL_EXAMPLE,
} from "@/components/deploy/CloudflarePanels";

/** 手把手：在 Cloudflare 控制台找到 Account ID */

export function CloudflareAccountIdGuide() {
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 px-3 py-3 text-xs leading-relaxed">
      <p className="font-medium text-foreground">Account ID 怎么填？</p>
      <p className="text-muted-foreground">
        下方输入框<strong className="text-foreground">两种都支持</strong>：直接粘贴
        32 位 ID，或粘贴登录后浏览器地址栏的<strong className="text-foreground">完整链接</strong>
        （会自动识别）。
      </p>

      <div className="space-y-2 text-muted-foreground">
        <p>
          <strong className="text-foreground">步骤 1</strong>：点「打开 Workers 页」，登录 Cloudflare
        </p>
        <p>
          <strong className="text-foreground">步骤 2</strong>：跳转后地址栏会变成类似：
        </p>
        <pre className="overflow-x-auto rounded border border-border bg-background/80 p-2 text-[11px] text-foreground dark:bg-card/80">
          {CLOUDFLARE_ACCOUNT_ID_URL_EXAMPLE}
        </pre>
        <p>
          <strong className="text-foreground">步骤 3</strong>：复制整段链接粘贴到 Account ID 输入框，或只复制中间
          32 位（如 <code className="text-[11px]">1234567890abcdef1234567890abcdef</code>
          ）。也可点「从剪贴板粘贴」。
        </p>
      </div>

      <p className="text-muted-foreground">
        若 Overview 右侧有 Account ID 卡片，点 Copy 后粘贴同样有效。
      </p>
    </div>
  );
}
