/** 去掉终端 ANSI 颜色码，便于展示 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export interface GitSshTestInterpretation {
  success: boolean;
  summary: string;
  detail: string;
}

export function interpretGitSshTest(
  raw: string,
  provider: "gitee" | "github",
): GitSshTestInterpretation {
  const detail = stripAnsi(raw).trim();
  const lower = detail.toLowerCase();

  if (lower.includes("successfully authenticated")) {
    const host = provider === "gitee" ? "Gitee" : "GitHub";
    return {
      success: true,
      summary: `${host} SSH 已连通，可以 push / pull 代码。`,
      detail,
    };
  }

  if (
    lower.includes("permission denied") ||
    lower.includes("publickey") ||
    lower.includes("authentication failed")
  ) {
    return {
      success: false,
      summary:
        "SSH 认证失败。请确认已在平台「SSH 公钥」页粘贴本机公钥，且用户名与仓库路径正确。",
      detail,
    };
  }

  if (lower.includes("could not resolve") || lower.includes("connection timed out")) {
    return {
      success: false,
      summary: "无法连接服务器，请检查网络后重试。",
      detail,
    };
  }

  return {
    success: false,
    summary: "未能确认 SSH 状态，请查看下方原始输出。",
    detail,
  };
}
