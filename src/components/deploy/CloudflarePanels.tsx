export const CLOUDFLARE_SIGNUP_URL = "https://dash.cloudflare.com/sign-up";
export const CLOUDFLARE_DASHBOARD_URL = "https://dash.cloudflare.com/";
/** 登录后跳转到 Workers & Pages（地址栏会出现 /{AccountID}/workers-and-pages） */
export const CLOUDFLARE_PAGES_OVERVIEW_URL =
  "https://dash.cloudflare.com/?to=/:account/workers-and-pages";
/** My Profile → API Tokens（个人账号创建 Wrangler 用 Token） */
export const CLOUDFLARE_API_TOKENS_URL =
  "https://dash.cloudflare.com/profile/api-tokens";
export const CLOUDFLARE_PAGES_URL = "https://developers.cloudflare.com/pages/";
/** Pages Direct Upload / CI 官方 Token 创建说明 */
export const CLOUDFLARE_API_TOKEN_DOC_URL =
  "https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/#generate-an-api-token";

/** 示例：登录跳转后地址栏形如 https://dash.cloudflare.com/74ec0fa9.../workers-and-pages */
export const CLOUDFLARE_ACCOUNT_ID_URL_EXAMPLE =
  "https://dash.cloudflare.com/74ec0fa9f8bd165464ebbe22e95441fe/workers-and-pages";

const ACCOUNT_ID_RE = /^[a-f0-9]{32}$/i;

/** 从 32 位 ID 或完整 dash.cloudflare.com 链接解析 Account ID */
export function parseCloudflareAccountId(input: string | null | undefined): string | null {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) return null;
  if (ACCOUNT_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const tryUrl = (raw: string) => {
    try {
      const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      if (!url.hostname.includes("cloudflare.com")) return null;
      for (const segment of url.pathname.split("/").filter(Boolean)) {
        if (ACCOUNT_ID_RE.test(segment)) {
          return segment.toLowerCase();
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  const fromUrl = tryUrl(trimmed);
  if (fromUrl) return fromUrl;

  const embedded = trimmed.match(/\b([a-f0-9]{32})\b/i);
  return embedded ? embedded[1].toLowerCase() : null;
}

/** 已知 Account ID 时直达 Workers 页；否则走官方跳转链接 */
export function buildCloudflareWorkersPagesUrl(accountId?: string | null): string {
  const parsed = parseCloudflareAccountId(accountId);
  if (parsed) {
    return `https://dash.cloudflare.com/${parsed}/workers-and-pages`;
  }
  return CLOUDFLARE_PAGES_OVERVIEW_URL;
}

export function buildCloudflarePagesUrl(projectName: string): string {
  const name = projectName.trim() || "your-project";
  return `https://${name}.pages.dev/`;
}
