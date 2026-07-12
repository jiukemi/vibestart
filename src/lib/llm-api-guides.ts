export interface LlmApiGuide {
  signupUrl: string;
  apiKeyUrl: string;
  browserTitle: string;
  keyPrefix: string;
  note: string;
  steps: string[];
}

export const LLM_API_GUIDES: Record<string, LlmApiGuide> = {
  deepseek: {
    signupUrl: "https://platform.deepseek.com/sign_up",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    browserTitle: "DeepSeek API · VibeStart",
    keyPrefix: "sk-",
    note: "国内可直接访问，注册后充值少量余额即可调用 API（按量计费，很便宜）。",
    steps: [
      "点击「浏览器打开注册页」，用邮箱或手机号注册 DeepSeek",
      "登录后点击「浏览器打开 API Keys」",
      "点击 **创建 API Key**，复制以 sk- 开头的密钥",
      "粘贴到下方输入框，点击「测试连接」验证",
      "验证通过后，勾选要同步的编辑器并确认同步",
    ],
  },
  tongyi: {
    signupUrl: "https://account.aliyun.com/register/register.htm",
    apiKeyUrl: "https://dashscope.console.aliyun.com/apiKey",
    browserTitle: "通义 DashScope · VibeStart",
    keyPrefix: "sk-",
    note: "需要阿里云账号；新用户通常有免费额度。Key 在「百炼 / DashScope」控制台创建。",
    steps: [
      "注册阿里云账号并完成实名认证（国内服务常规要求）",
      "打开 DashScope API Key 管理页",
      "点击 **创建新的 API-KEY**，复制 sk- 开头的密钥",
      "粘贴到下方并测试连接",
      "通义灵码用户同步后，可能还需在 Lingma 设置 → 模型里确认百炼 Key",
    ],
  },
  zhipu: {
    signupUrl: "https://open.bigmodel.cn/login",
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    browserTitle: "智谱 API · VibeStart",
    keyPrefix: "",
    note: "在智谱开放平台注册，创建 API Key 后按量计费。",
    steps: [
      "浏览器打开智谱开放平台并注册 / 登录",
      "进入 **API Keys** 页面，创建新 Key",
      "复制 Key 粘贴到下方",
      "测试连接成功后，选择要同步的编辑器",
    ],
  },
  kimi: {
    signupUrl: "https://platform.moonshot.cn/register",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    browserTitle: "Kimi / Moonshot · VibeStart",
    keyPrefix: "sk-",
    note: "Moonshot 开放平台，国内可访问，按量计费。",
    steps: [
      "注册 Moonshot 开放平台账号",
      "在 API Keys 页面创建密钥并复制",
      "粘贴到下方输入框并测试",
      "确认同步到已安装的编辑器",
    ],
  },
  openai: {
    signupUrl: "https://platform.openai.com/signup",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    browserTitle: "OpenAI API · VibeStart",
    keyPrefix: "sk-",
    note: "需要能访问 openai.com；按量计费，需绑定支付方式。",
    steps: [
      "注册 OpenAI 账号（可能需要海外手机号）",
      "打开 API Keys 页面，点击 **Create new secret key**",
      "复制 sk- 开头的 Key（只显示一次，请立即保存）",
      "粘贴到下方并测试连接",
    ],
  },
};

export function getLlmApiGuide(providerId: string): LlmApiGuide {
  return LLM_API_GUIDES[providerId] ?? LLM_API_GUIDES.deepseek;
}
