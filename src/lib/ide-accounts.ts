export interface IdeRegisterGuide {
  signupUrl: string;
  browserTitle: string;
  note: string;
  steps: string[];
}

export const IDE_REGISTER_GUIDES: Record<string, IdeRegisterGuide> = {
  cursor: {
    signupUrl: "https://authenticator.cursor.sh/sign-up",
    browserTitle: "注册 Cursor · VibeStart",
    note: "无需 GitHub：选择 Continue with Email，用邮箱即可注册。GitHub 登录只是可选项。",
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
    steps: [
      "点击应用内「打开 Trae 官网」",
      "下载并安装 Trae（若尚未安装）",
      "使用手机号或邮箱注册账号",
      "登录后导入 VS Code / Cursor 配置（可选）",
    ],
  },
  windsurf: {
    signupUrl: "https://windsurf.com/account/register",
    browserTitle: "注册 Windsurf · VibeStart",
    note: "可用 Google 或邮箱注册 Codeium / Windsurf 账号。",
    steps: [
      "点击应用内打开注册页",
      "选择 Google 或 Email 注册",
      "验证邮箱后下载 Windsurf 客户端",
      "登录即可使用 AI 编程功能",
    ],
  },
  "claude-code": {
    signupUrl: "https://claude.ai/login",
    browserTitle: "注册 Claude · VibeStart",
    note: "Claude Code 需要 Anthropic 账号；国内可能需要稳定网络访问 claude.ai。",
    steps: [
      "在 claude.ai 用邮箱注册 Anthropic 账号",
      "安装 Claude Code：`npm i -g @anthropic-ai/claude-code`",
      "终端运行 `claude` 并按提示登录",
    ],
  },
  codex: {
    signupUrl: "https://platform.openai.com/signup",
    browserTitle: "注册 OpenAI · VibeStart",
    note: "Codex CLI 需要 OpenAI 账号与 API 访问权限。",
    steps: [
      "注册 OpenAI 账号",
      "安装 Codex CLI：`npm i -g @openai/codex`",
      "按官方文档配置 API Key",
    ],
  },
  "tongyi-lingma": {
    signupUrl: "https://lingma.aliyun.com/download",
    browserTitle: "通义灵码 · VibeStart",
    note: "国内可直接访问，支持 Lingma IDE 或插件方式。",
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
