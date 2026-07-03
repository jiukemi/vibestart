import {
  homeDirHint,
  quitAppHint,
  settingsShortcut,
} from "@/lib/platform-ui";
import type { Platform } from "@/lib/tauri-types";

export interface IdeSyncGuide {
  ide: string;
  title: string;
  /** 能在应用内自动完成的说明 */
  autoNote?: string;
  /** 需要用户手动操作的步骤 */
  manualSteps: string[];
  /** 可选：设置页路径提示 */
  settingsPath?: string;
}

function cursorManualSteps(platform: Platform): string[] {
  const settings = settingsShortcut(platform);
  const quit = quitAppHint(platform);
  return [
    `按 ${settings} 打开设置`,
    "进入 Cursor Settings → Models",
    "确认「Override OpenAI API Key」已开启，Key 与 Base URL 已填充",
    "若开关未开启，请手动打开并保存",
    `按 ${quit} Cursor，再重新打开`,
  ];
}

function claudeCodeManualSteps(platform: Platform): string[] {
  const home = homeDirHint(platform);
  return [
    "若出现 Permission Required / y/n：问是否信任项目文件夹，输入 y 回车",
    `不要在用户主目录 ${home} 启动，应在当前项目目录内启动`,
    "进入后直接输入中文需求，例如「帮我改 index.html」",
    "界面语言无法改成中文；只有 AI 对话内容是中文",
  ];
}

const BASE_GUIDES: Record<
  string,
  Omit<IdeSyncGuide, "manualSteps"> & {
    manualSteps: (platform: Platform) => string[];
  }
> = {
  cursor: {
    ide: "cursor",
    title: "Cursor 额外设置",
    autoNote: "已尝试写入 Key 与 Base URL，并开启「使用自定义 API Key」。",
    settingsPath: "Cursor Settings → Models",
    manualSteps: cursorManualSteps,
  },
  trae: {
    ide: "trae",
    title: "Trae 额外设置",
    autoNote: "已尝试写入 OpenAI 兼容 Key 与 Base URL。",
    manualSteps: (platform) => [
      "打开 Trae 设置 → AI / 模型",
      "确认自定义 API Key 与 Base URL 已生效",
      `完全退出并重启 Trae（${quitAppHint(platform)}）后，在 Chat 中选择 OpenAI 兼容模型`,
    ],
  },
  windsurf: {
    ide: "windsurf",
    title: "Windsurf 额外设置",
    autoNote: "已尝试写入 OpenAI 兼容 Key 与 Base URL。",
    manualSteps: (platform) => [
      "打开 Windsurf Settings → Cascade / Models",
      "确认自定义 API Key 已启用",
      `完全退出并重启 Windsurf（${quitAppHint(platform)}）`,
    ],
  },
  "claude-code": {
    ide: "claude-code",
    title: "Claude Code 终端说明",
    autoNote:
      "Claude Code 界面暂为英文（官方限制），AI 回复已设为中文。启动前会显示中文说明。",
    manualSteps: claudeCodeManualSteps,
  },
  codex: {
    ide: "codex",
    title: "Codex",
    autoNote:
      "AI 中文回复已配置；界面汉化需点 Codex 流程第一步的「一键汉化」，或重新同步 LLM。完全退出后重启 Codex。",
    manualSteps: () => [
      "汉化入口：选择 IDE / LLM 步骤中的 Codex 面板 → 第一步「安装 Codex」旁的「一键汉化」",
      "用 Cmd+Q（macOS）完全退出 Codex，重新打开",
      "若菜单仍为英文：Codex → 设置 → General → Language → 中文（中国）",
      "界面汉化需联网访问 OpenAI；国内若仍无效，属 Codex 客户端已知限制，AI 对话中文不受影响",
    ],
  },
  "tongyi-lingma": {
    ide: "tongyi-lingma",
    title: "通义灵码",
    autoNote: "环境变量已写入 VS Code 配置，但 Lingma 模型需在 UI 中确认。",
    manualSteps: () => [
      "打开 Lingma → 设置 → 模型 → 添加",
      "服务商选「阿里云百炼」，粘贴与向导中相同的 API Key",
      "在对话框选择对应模型后开始编程",
    ],
  },
};

export function getIdeSyncGuide(
  ide: string,
  platform: Platform = "unknown",
): IdeSyncGuide | null {
  const base = BASE_GUIDES[ide];
  if (!base) return null;
  const resolvedPlatform = platform === "unknown" ? "macos" : platform;
  return {
    ide: base.ide,
    title: base.title,
    autoNote: base.autoNote,
    settingsPath: base.settingsPath,
    manualSteps: base.manualSteps(resolvedPlatform),
  };
}
