/** Cloudflare Pages 部署常见错误说明（Wrangler account ID） */

export function CloudflarePagesTroubleGuide() {
  return (
    <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
      <p className="font-medium text-foreground">常见部署失败：Account ID</p>
      <p>
        若日志出现
        <code className="mx-1 text-[11px]">
          Failed to automatically retrieve account IDs
        </code>
        ：使用 API Token 时须填写 Account ID；若已填写仍失败，多为 Token 权限不足或与 Account ID 不属于同一账号。
      </p>
      <p className="font-medium text-foreground">推荐做法（任选其一）</p>
      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
        <li>
          <strong className="text-foreground">粘贴 Workers 页链接</strong>
          ：点「打开 Workers 页」→ 复制地址栏整段链接到 Account ID 输入框
        </li>
        <li>
          <strong className="text-foreground">手动填 32 位 ID</strong>
          ：从链接中间段或 Overview 右侧 Copy
        </li>
        <li>
          <strong className="text-foreground">wrangler login</strong>：点「Cloudflare
          登录」免填 Token 与 Account ID
        </li>
      </ul>
    </div>
  );
}
