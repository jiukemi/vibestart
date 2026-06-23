export type WizardStepId =
  | "welcome"
  | "health-check"
  | "install-tools"
  | "pick-ide"
  | "github-setup"
  | "llm-api-key"
  | "first-project"
  | "deploy"
  | "complete";

export interface WizardStep {
  id: WizardStepId;
  title: string;
  description: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "welcome",
    title: "欢迎",
    description: "了解你的系统环境，开始 VibeStart 向导",
  },
  {
    id: "health-check",
    title: "环境检测",
    description: "检查开发工具是否已安装并满足最低版本要求",
  },
  {
    id: "install-tools",
    title: "安装工具",
    description: "按平台指引安装缺失的开发工具",
  },
  {
    id: "pick-ide",
    title: "选择 IDE",
    description: "选择你主要使用的 AI 编程工具",
  },
  {
    id: "github-setup",
    title: "GitHub 配置",
    description: "注册账号、创建仓库并配置 SSH 密钥",
  },
  {
    id: "llm-api-key",
    title: "LLM API Key",
    description: "配置大模型 API 密钥，用于 AI 辅助开发",
  },
  {
    id: "first-project",
    title: "首个项目",
    description: "使用模板创建你的第一个项目",
  },
  {
    id: "deploy",
    title: "部署上线",
    description: "将项目部署到 Vercel 或 GitHub Pages",
  },
  {
    id: "complete",
    title: "完成",
    description: "恭喜！你已准备好开始 Vibe Coding",
  },
];
