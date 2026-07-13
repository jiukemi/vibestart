import type { DeployTarget } from "@/components/deploy/DeployCards";

export interface DeployRecord {
  id: string;
  target: DeployTarget | string;
  projectDir: string;
  success: boolean;
  url: string | null;
  altUrls: string[];
  log: string;
  createdAt: string;
}

export function createDeployRecord(
  input: Omit<DeployRecord, "id" | "createdAt">,
): DeployRecord {
  return {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    url: normalizeDeployShareUrl(input.url),
    altUrls: input.altUrls
      .map((u) => normalizeDeployShareUrl(u))
      .filter((u): u is string => Boolean(u)),
  };
}

function isEdgeoneHost(host: string): boolean {
  const lower = host.toLowerCase();
  return (
    lower.endsWith(".edgeone.cool") ||
    lower.endsWith(".edgeone.app") ||
    lower.endsWith(".edgeone.site")
  );
}

/** 腾讯云预览链接带 eo_token 校验参数（约 3 小时有效） */
export function isEdgeonePreviewTokenUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    if (!isEdgeoneHost(parsed.hostname)) return false;
    return parsed.searchParams.has("eo_token");
  } catch {
    return url.includes("eo_token=");
  }
}

/** 保留 EdgeOne 预览链完整 query；其他平台仅做 trim */
export function normalizeDeployShareUrl(url: string | null): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!isEdgeoneHost(parsed.hostname)) {
      return trimmed;
    }
    // 国内合规预览链需保留 eo_token，勿剥离
    if (!parsed.pathname.endsWith("/") && !parsed.search) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function edgeoneShareUrlHint(url: string | null): string | null {
  if (!url) return null;
  if (isEdgeonePreviewTokenUrl(url)) {
    return "此为预览链接（含校验参数）。请用浏览器完整打开（须含 ?eo_token=），首次访问会自动写入 cookie，约 3 小时有效。过期请点「刷新预览链」。";
  }
  try {
    if (isEdgeoneHost(new URL(url).hostname)) {
      return "裸域名在国内加速区域可能无法直接访问（401）。请用控制台「预览」获取有效链接，或绑定自定义域名长期分享。";
    }
  } catch {
    // ignore
  }
  return null;
}

export function formatDeployTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const DEPLOY_TARGET_LABELS: Record<string, string> = {
  "edgeone-pages": "腾讯云网页托管",
  "cloudflare-pages": "Cloudflare",
  "github-pages": "GitHub Pages",
  vercel: "Vercel",
};
