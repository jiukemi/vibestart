import { needsCodexBridge } from "@/lib/codex-bridge";

export interface IdeRegisterGuide {
  signupUrl: string;
  browserTitle: string;
  note: string;
  steps: string[];
  /** 注册页是否依赖海外网络 */
  requiresExternalNetwork?: boolean;
}

export const IDE_REGISTER_GUIDES: Record<string, IdeRegisterGuide> = {
  cursor: {
    signupUrl: "https://authenticator.cursor.sh/sign-up",
    browserTitle: "注册 Cursor · VibeStart",
    note: "无需 GitHub：选择 Continue with Email，用邮箱即可注册。GitHub 登录只是可选项。",
    requiresExternalNetwork: true,
    steps: [
      "打开 Cursor 应用（若未安装，先在上一步一键安装）",
      "点击「Sign Up」或「注册」",
      "选择 **Continue with Email**（用邮箱注册，不要选 GitHub）",
      "输入邮箱，查收验证码并填写",
      "设置密码，完成注册后回到 Cursor 登录",
    ],
  },
  trae: {
    signupUrl: "https://www.trae.com.cn/",
    browserTitle: "注册 Trae · VibeStart",
    note: "Trae 支持手机号或邮箱注册，国内可直接访问。",
    requiresExternalNetwork: false,
    steps: [
      "点击「浏览器打开 Trae 官网」",
      "下载并安装 Trae（若尚未安装）",
      "使用手机号或邮箱注册账号",
      "登录后导入 VS Code / Cursor 配置（可选）",
    ],
  },
  windsurf: {
    signupUrl: "https://windsurf.com/account/register",
    browserTitle: "注册 Windsurf · VibeStart",
    note: "可用 Google 或邮箱注册 Codeium / Windsurf 账号。",
    requiresExternalNetwork: true,
    steps: [
      "点击浏览器打开注册页",
      "选择 Google 或 Email 注册",
      "验证邮箱后下载 Windsurf 客户端",
      "登录即可使用 AI 编程功能",
    ],
  },
  "claude-code": {
    signupUrl: "https://claude.ai/login",
    browserTitle: "注册 Claude · VibeStart",
    note: "Claude Code 需要 Anthropic 账号；国内可能需要稳定网络访问 claude.ai。",
    requiresExternalNetwork: true,
    steps: [
      "在 claude.ai 用邮箱注册 Anthropic 账号",
      "安装 Claude Code：`npm i -g @anthropic-ai/claude-code`",
      "终端运行 `claude` 并按提示登录",
    ],
  },
  codex: {
    signupUrl: "https://developers.openai.com/codex/app",
    browserTitle: "下载 Codex · VibeStart",
    note: "Codex 为 OpenAI 桌面客户端（图形界面）。国产 LLM 走 CC Switch 桥接，无需 OpenAI 账号。",
    requiresExternalNetwork: true,
    steps: [
      "一键安装 Codex 桌面客户端（Homebrew / Microsoft Store / Gitee 镜像）",
      "安装后自动写入中文配置；若界面仍为英文，点「一键汉化」",
      "在「LLM API Key」步骤选择 DeepSeek 等国产模型并配置桥接",
    ],
  },
  "tongyi-lingma": {
    signupUrl: "https://lingma.aliyun.com/download",
    browserTitle: "通义灵码 · VibeStart",
    note: "国内可直接访问，支持 Lingma IDE 或插件方式。",
    requiresExternalNetwork: false,
    steps: [
      "下载 Lingma IDE 或使用 VS Code 插件",
      "用阿里云 / 淘宝账号登录",
      "完成实名认证（使用部分功能时需要）",
    ],
  },
};

export function getIdeRegisterGuide(ideId: string): IdeRegisterGuide {
  return IDE_REGISTER_GUIDES[ideId] ?? IDE_REGISTER_GUIDES.cursor;
}

/** 是否展示 IDE 注册引导（结合网络与 Codex 国产桥接路径） */
export function shouldShowIdeRegisterGuide(
  ideId: string,
  options: {
    llmProvider?: string | null;
    externalReachable?: boolean | null;
    externalChecked?: boolean;
  },
): boolean {
  if (
    ideId === "codex" &&
    needsCodexBridge("codex", options.llmProvider ?? null)
  ) {
    return false;
  }

  const guide = getIdeRegisterGuide(ideId);
  if (guide.requiresExternalNetwork === false) {
    return true;
  }

  if (
    options.externalChecked &&
    options.externalReachable === false &&
    (guide.requiresExternalNetwork ?? true)
  ) {
    return false;
  }

  return true;
}

export function ideRegisterBlockedReason(
  ideId: string,
  options: {
    llmProvider?: string | null;
    externalReachable?: boolean | null;
    externalChecked?: boolean;
  },
): string | null {
  if (
    ideId === "codex" &&
    needsCodexBridge("codex", options.llmProvider ?? null)
  ) {
    return "你选择了国产 LLM + 本地桥接，无需注册 OpenAI。请按下方「Codex 配置清单」顺序完成安装与桥接。";
  }
  if (
    options.externalChecked &&
    options.externalReachable === false &&
    (getIdeRegisterGuide(ideId).requiresExternalNetwork ?? true)
  ) {
    return "当前环境无法稳定访问海外注册页。可配置代理后重试，或改用 Trae / 通义灵码等国内 IDE。";
  }
  return null;
}
