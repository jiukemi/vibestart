/** 面向小白的展示名，不出现 EdgeOne 等产品术语 */
export const TENCENT_PAGES_NAME = "腾讯云网页托管";

export const TENCENT_CLOUD_HOME_URL = "https://cloud.tencent.com/";
export const TENCENT_CLOUD_REGISTER_URL = "https://cloud.tencent.com/register";
/** 控制台入口（不保证直达 API Token 页，需按步骤手动切换 Tab） */
export const TENCENT_PAGES_CONSOLE_URL =
  "https://console.cloud.tencent.com/edgeone/pages";
export const TENCENT_API_TOKEN_DOC_URL =
  "https://cloud.tencent.com/document/product/1552/127422";
export const TENCENT_DOMAIN_DOC_URL =
  "https://cloud.tencent.com/document/product/1552/127403";

/** 部署前提示 */
export function tencentPagesDeployUrlHint(projectName: string): string {
  const name = projectName.trim();
  if (!name) {
    return "部署后请使用 CLI 或控制台「预览」生成的链接（国内默认域名约 3 小时有效）；长期分享请绑定自定义域名。";
  }
  return `项目「${name}」部署后，在 Makers 控制台点「预览」获取有效链接；长期访问请在「域名管理」绑定自定义域名。`;
}

/** @deprecated 仅兼容旧引用 */
export function buildTencentPagesUrl(projectName: string): string {
  const name = projectName.trim() || "your-project";
  return `https://${name}.edgeone.app/`;
}

/** @deprecated 仅兼容旧引用 */
export const EDGEONE_CONSOLE_URL = TENCENT_PAGES_CONSOLE_URL;
export const EDGEONE_PAGES_URL = TENCENT_PAGES_CONSOLE_URL;
export const buildEdgeOneUrl = buildTencentPagesUrl;
