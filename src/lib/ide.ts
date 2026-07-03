export const IDE_OPTIONS = [
  {
    id: "cursor",
    name: "Cursor",
    description: "AI 原生 IDE，默认推荐",
    default: true,
    installTool: "cursor",
    promptLabel: "Cursor",
    scanKey: "cursor",
  },
  {
    id: "trae",
    name: "Trae",
    description: "字节跳动 AI IDE，国内热门",
    installTool: "trae",
    promptLabel: "Trae",
    scanKey: "trae",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    description: "Codeium 出品的 Agentic IDE",
    installTool: "windsurf",
    promptLabel: "Windsurf",
    scanKey: "windsurf",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic 命令行 AI 编程助手（CC）",
    installTool: "claude-code",
    promptLabel: "Claude Code",
    scanKey: "claude-code",
  },
  {
    id: "codex",
    name: "Codex",
    description: "OpenAI Codex 桌面客户端（图形界面，推荐）",
    installTool: "codex",
    promptLabel: "Codex",
    scanKey: "codex",
  },
  {
    id: "tongyi-lingma",
    name: "通义灵码",
    description: "阿里云 Lingma IDE，国产主流",
    installTool: "tongyi-lingma",
    promptLabel: "通义灵码",
    scanKey: "tongyi-lingma",
  },
] as const;

export type IdeId = (typeof IDE_OPTIONS)[number]["id"];

export function getIdeOption(id: string) {
  return IDE_OPTIONS.find((ide) => ide.id === id) ?? IDE_OPTIONS[0];
}

export function getIdeScanKey(id: string): string | undefined {
  return getIdeOption(id).scanKey;
}
