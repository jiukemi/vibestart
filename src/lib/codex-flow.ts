import type { CodexBridgeMode } from "@/lib/codex-bridge";
import type { ToolStatus } from "@/lib/tauri-types";

export type CodexWizardPhase = "pick-ide" | "llm-api-key";

export type CodexFlowStepStatus = "done" | "active" | "pending" | "skipped";

export type CodexFlowAction =
  | "install-codex"
  | "localize-codex"
  | "install-bridge"
  | "start-bridge"
  | "open-cc-switch"
  | "refresh-health";

export interface CodexFlowStep {
  id: string;
  title: string;
  description: string;
  status: CodexFlowStepStatus;
  action?: CodexFlowAction;
  actionLabel?: string;
  secondaryAction?: CodexFlowAction;
  secondaryActionLabel?: string;
}

function toolInstalled(
  toolMap: Map<string, ToolStatus>,
  name: string,
): boolean {
  const t = toolMap.get(name);
  return Boolean(t?.installed && t.meets_minimum);
}

export function computeCodexFlowSteps(input: {
  mode: CodexBridgeMode;
  phase: CodexWizardPhase;
  toolMap: Map<string, ToolStatus>;
  bridgeReady: boolean;
  apiKeyReady: boolean;
  /** 是否已选 LLM（null = IDE 步骤，尚未选模型） */
  llmProvider: string | null;
}): CodexFlowStep[] {
  const { mode, phase, toolMap, bridgeReady, apiKeyReady, llmProvider } =
    input;
  const codexOk = toolInstalled(toolMap, "codex");
  const bridgeToolOk =
    mode === "deepseek-bridge"
      ? toolInstalled(toolMap, "codex-bridge")
      : toolInstalled(toolMap, "cc-switch");

  const steps: Omit<CodexFlowStep, "status">[] = [];

  steps.push({
    id: "install-app",
    title: "安装 Codex 桌面客户端",
    description: codexOk
      ? "Codex.app 已就绪。可点「一键汉化」写入界面中文；同步 LLM 时也会自动写入。"
      : "优先 Homebrew / Microsoft Store；国内网络可尝试 Gitee 镜像。旧版终端 npm 包不算已安装。",
    action: codexOk ? undefined : "install-codex",
    actionLabel: "一键安装 Codex",
    secondaryAction: codexOk ? "localize-codex" : undefined,
    secondaryActionLabel: codexOk ? "一键汉化" : undefined,
  });

  if (llmProvider === "openai" && phase === "llm-api-key") {
    steps.push({
      id: "openai-direct",
      title: "OpenAI 官方 API",
      description: "已选 OpenAI，Codex 直连官方 API，无需本地桥接。验证 Key 后同步到 Codex 即可。",
    });
    return assignStepStatuses(steps, {
      codexOk,
      bridgeToolOk,
      bridgeReady,
      apiKeyReady,
      phase,
      mode,
      llmProvider,
    });
  }

  if (mode === "deepseek-bridge") {
    steps.push({
      id: "install-bridge",
      title: "安装 DeepSeek 桥接包",
      description: bridgeToolOk
        ? "桥接程序已下载到 ~/.vibestart/tools/codex-bridge。"
        : "从 Gitee 镜像下载预构建包，无需访问 GitHub。",
      action: bridgeToolOk ? undefined : "install-bridge",
      actionLabel: "一键安装 DeepSeek 桥",
    });

    if (phase === "pick-ide" || !llmProvider) {
      steps.push({
        id: "await-llm",
        title: "选择 LLM 并填写 Key",
        description:
          "下一步进入「LLM API Key」，选择 DeepSeek 等国产模型并验证 Key 后，回来启动桥接。",
      });
    } else {
      steps.push({
        id: "save-key",
        title: "验证并保存 DeepSeek API Key",
        description: apiKeyReady
          ? "Key 已验证并保存在本机。"
          : "在本页上方选择 DeepSeek，填入 Key 并点「验证 Key」。",
      });
      steps.push({
        id: "start-bridge",
        title: "启动 DeepSeek 桥",
        description: bridgeReady
          ? "本地桥接服务已在 8098 端口运行。"
          : apiKeyReady
            ? "点击启动，保持桥接在后台运行。"
            : "需先完成 Key 验证。",
        action: bridgeReady || !apiKeyReady ? undefined : "start-bridge",
        actionLabel: "启动 DeepSeek 桥",
      });
      steps.push({
        id: "bridge-ready",
        title: "确认桥接就绪",
        description: bridgeReady
          ? "健康检查通过，可同步配置到 Codex。"
          : "启动后点「重新检测」，直到显示桥接就绪。",
        action: bridgeReady ? undefined : "refresh-health",
        actionLabel: "重新检测",
      });
    }
  } else if (mode === "cc-switch") {
    steps.push({
      id: "install-cc-switch",
      title: "安装 CC Switch",
      description: bridgeToolOk
        ? "CC Switch 应用已安装。"
        : "通过 Homebrew / winget 安装桌面应用。",
      action: bridgeToolOk ? undefined : "install-bridge",
      actionLabel: "一键安装 CC Switch",
    });
    steps.push({
      id: "configure-cc-switch",
      title: "配置 Codex 路由",
      description: bridgeReady
        ? "CC Switch 本地路由已响应（15721 端口）。"
        : "打开 CC Switch → 添加国产供应商 → 开启 Codex 路由 → 启用配置。",
      action: bridgeReady ? undefined : "open-cc-switch",
      actionLabel: "打开 CC Switch",
    });
    if (!bridgeReady) {
      steps.push({
        id: "cc-health",
        title: "确认路由就绪",
        description: "完成 CC Switch 配置后，点重新检测。",
        action: "refresh-health",
        actionLabel: "重新检测",
      });
    }
    if (phase === "pick-ide" || !llmProvider) {
      steps.push({
        id: "await-llm",
        title: "选择 LLM 并填写 Key",
        description:
          "若使用国产模型，下一步在「LLM API Key」选择供应商并验证 Key。若选 OpenAI 官方 API，可跳过桥接。",
      });
    }
  }

  return assignStepStatuses(steps, {
    codexOk,
    bridgeToolOk,
    bridgeReady,
    apiKeyReady,
    phase,
    mode,
    llmProvider,
  });
}

function assignStepStatuses(
  steps: Omit<CodexFlowStep, "status">[],
  ctx: {
    codexOk: boolean;
    bridgeToolOk: boolean;
    bridgeReady: boolean;
    apiKeyReady: boolean;
    phase: CodexWizardPhase;
    mode: CodexBridgeMode;
    llmProvider: string | null;
  },
): CodexFlowStep[] {
  const doneFor = (id: string): boolean => {
    switch (id) {
      case "install-app":
        return ctx.codexOk;
      case "install-bridge":
      case "install-cc-switch":
        return ctx.bridgeToolOk;
      case "openai-direct":
        return ctx.apiKeyReady;
      case "await-llm":
        return ctx.phase === "llm-api-key" && ctx.llmProvider != null;
      case "save-key":
        return ctx.apiKeyReady;
      case "start-bridge":
      case "configure-cc-switch":
        return ctx.bridgeReady;
      case "bridge-ready":
      case "cc-health":
        return ctx.bridgeReady;
      default:
        return false;
    }
  };

  let foundActive = false;
  return steps.map((step) => {
    if (doneFor(step.id)) {
      return { ...step, status: "done" as const };
    }
    if (!foundActive) {
      foundActive = true;
      return { ...step, status: "active" as const };
    }
    return { ...step, status: "pending" as const };
  });
}

export function codexFlowSummary(steps: CodexFlowStep[]): string | null {
  const active = steps.find((s) => s.status === "active");
  if (!active) {
    if (steps.every((s) => s.status === "done")) {
      return "Codex 环境已就绪，可进入下一步。";
    }
    return null;
  }
  if (active.action) {
    return `当前步骤：${active.title}`;
  }
  return active.description;
}
