/**
 * Codex 国产模型桥接 — 前端常量与类型（实现见 docs/CODEX-BRIDGE.md）
 */

export type CodexBridgeMode = "cc-switch" | "deepseek-bridge" | "none";

export interface CodexBridgeOption {
  id: CodexBridgeMode;
  title: string;
  description: string;
  recommended?: boolean;
  /** 仅支持 DeepSeek 时显示为限制提示 */
  providerLimit?: string;
  defaultPort: number;
  healthPath: string;
}

export const CODEX_BRIDGE_OPTIONS: CodexBridgeOption[] = [
  {
    id: "cc-switch",
    title: "CC Switch 路由",
    description:
      "支持 DeepSeek、Kimi、通义、智谱等多家。稳定，社区验证最多。需安装 CC Switch 并开启 Codex 路由。",
    recommended: true,
    defaultPort: 15721,
    healthPath: "/",
  },
  {
    id: "deepseek-bridge",
    title: "DeepSeek 专用桥",
    description:
      "步骤更少，仅适合 DeepSeek。其他国产模型请选 CC Switch。",
    providerLimit: "deepseek",
    defaultPort: 8098,
    healthPath: "/health",
  },
];

export const CC_SWITCH_INSTALL = {
  windows: {
    program: "winget",
    args: ["install", "-e", "--id", "farion1231.CC-Switch"],
  },
  macos: {
    program: "brew",
    args: ["install", "--cask", "cc-switch"],
  },
} as const;

/** 图文步骤 ID，供 CodexBridgePanel 渲染 */
export const CC_SWITCH_GUIDE_STEPS = [
  {
    id: "install",
    title: "安装并打开 CC Switch",
    body: "点击「一键安装」，或从 ccswitch.io 下载。安装后打开应用。",
  },
  {
    id: "provider",
    title: "添加国产供应商",
    body: "进入 Codex 标签 → 「+」→ 选择 DeepSeek / Kimi / 通义等 → 填入 API Key → 保存。",
  },
  {
    id: "routing",
    title: "开启本地路由",
    body: "设置 → 路由 → 打开总开关 → 在「路由启用」中打开 Codex。",
  },
  {
    id: "enable",
    title: "启用供应商",
    body: "在供应商列表中点击「启用」你刚添加的配置。",
  },
  {
    id: "restart",
    title: "重启 Codex",
    body: "完全退出 Codex 终端窗口，回到 VibeStart 工作台点击「启动编辑器」。",
  },
] as const;

export const DEEPSEEK_BRIDGE_GUIDE_STEPS = [
  {
    id: "install",
    title: "安装并启动 DeepSeek 桥",
    body: "点击「一键安装」，按终端提示启动 bridge（保持运行）。",
  },
  {
    id: "health",
    title: "确认桥接就绪",
    body: "VibeStart 健康检查通过后即可继续。",
  },
  {
    id: "launch",
    title: "启动 Codex",
    body: "在工作台选择项目目录，点击「启动编辑器」。",
  },
] as const;

/** 需要桥接的 LLM Provider（OpenAI 官方直连，无需桥） */
export const CODEX_BRIDGE_LLM_PROVIDERS = [
  "deepseek",
  "kimi",
  "tongyi",
  "zhipu",
] as const;

export function needsCodexBridge(
  primaryIde: string | null | undefined,
  llmProvider: string | null | undefined,
): boolean {
  if (primaryIde !== "codex") return false;
  if (!llmProvider || llmProvider === "openai") return false;
  return (CODEX_BRIDGE_LLM_PROVIDERS as readonly string[]).includes(
    llmProvider,
  );
}

export function bridgeOptionForProvider(
  provider: string | null | undefined,
): CodexBridgeMode {
  if (provider === "deepseek") return "deepseek-bridge"; // 用户仍可改选 cc-switch
  if (
    provider &&
    (CODEX_BRIDGE_LLM_PROVIDERS as readonly string[]).includes(provider)
  ) {
    return "cc-switch";
  }
  return "none";
}
