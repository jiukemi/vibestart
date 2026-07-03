export type WizardStepId =
  | "welcome"
  | "choose-goal"
  | "setup-env"
  | "pick-ide"
  | "git-hosting"
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
    description: "从零开始，或已有项目直接部署上线",
  },
  {
    id: "choose-goal",
    title: "你想做什么？",
    description: "用对话选择方向，我们会推荐环境与模板",
  },
  {
    id: "setup-env",
    title: "准备环境",
    description: "检测并一键安装当前方向需要的开发工具",
  },
  {
    id: "pick-ide",
    title: "选择 IDE",
    description: "选择你主要使用的 AI 编程工具",
  },
  {
    id: "llm-api-key",
    title: "LLM API Key",
    description: "获取 API Key、验证连接，并可选同步到已安装的编辑器",
  },
  {
    id: "git-hosting",
    title: "Git 托管",
    description: "Gitee / GitHub 注册、建仓库、SSH；也可跳过仅用 Vercel",
  },
  {
    id: "first-project",
    title: "首个项目",
    description: "选文件夹、选模板，跟着提示词用 AI 从零做起",
  },
  {
    id: "deploy",
    title: "部署上线",
    description: "部署到 Gitee Pages（国内推荐）或 Vercel",
  },
  {
    id: "complete",
    title: "完成",
    description: "恭喜！你已准备好开始 Vibe Coding",
  },
];
