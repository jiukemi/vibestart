import type { AppStack, BuildGoal } from "@/stores/wizardStore";

export type PackPlatform = "website" | "explore" | "miniprogram" | "app";
export type ScaffoldKind = "html" | "miniprogram" | "minigame" | "flutter" | "guide";

export interface PackMeta {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  estimatedMinutes: number;
  tags: string[];
  /** 适用的开发方向；缺省为网页模板 */
  platforms?: PackPlatform[];
  /** App 方向下的子类型；缺省表示 hybrid + native 均可 */
  appStacks?: AppStack[];
  scaffoldKind?: ScaffoldKind;
  /** 告诉用户预览 vs 空白项目的区别 */
  kickoffHint?: string;
  /** 完成后的目标描述 */
  goalDescription?: string;
  /** 第一步可直接复制给 AI 的开场提示词 */
  starterPrompt?: string;
  /** 预览区说明（非 HTML 模板） */
  previewHint?: string;
  /** 是否包含可选的后端进阶教程 */
  hasBackendTutorial?: boolean;
}

export interface PackPrompt {
  step: number;
  slug: string;
  title: string;
  content: string;
}

const STEP_TITLES: Record<string, string> = {
  structure: "搭建结构",
  content: "填充内容",
  style: "美化样式",
  polish: "润色打磨",
  logic: "交互逻辑",
  layout: "页面布局",
  native: "原生工程",
};

const metaModules = import.meta.glob("../content/packs/*/meta.json", {
  eager: true,
  import: "default",
}) as Record<string, PackMeta>;

const previewModules = import.meta.glob("../content/packs/*/preview.html", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const promptModules = import.meta.glob("../content/packs/*/prompts/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function packIdFromPath(path: string): string {
  const match = path.match(/packs\/([^/]+)\//);
  return match?.[1] ?? "";
}

const DEFAULT_PLATFORMS: PackPlatform[] = ["website", "explore"];

export function loadPacks(): PackMeta[] {
  return Object.entries(metaModules)
    .map(([path, meta]) => ({
      ...meta,
      id: meta.id || packIdFromPath(path),
      platforms: meta.platforms ?? DEFAULT_PLATFORMS,
      scaffoldKind: meta.scaffoldKind ?? "html",
    }))
    .sort((a, b) => a.difficulty - b.difficulty);
}

export function getPacksForGoal(
  buildGoal: BuildGoal | null,
  appStack: AppStack | null,
): PackMeta[] {
  const all = loadPacks();
  const effective = !buildGoal || buildGoal === "explore" ? "website" : buildGoal;

  if (effective === "website") {
    return all.filter((p) =>
      (p.platforms ?? DEFAULT_PLATFORMS).some(
        (pl) => pl === "website" || pl === "explore",
      ),
    );
  }

  if (effective === "miniprogram") {
    return all.filter((p) => (p.platforms ?? []).includes("miniprogram"));
  }

  if (effective === "app") {
    return all.filter((p) => {
      if (!(p.platforms ?? []).includes("app")) return false;
      if (p.appStacks?.length && appStack) {
        return p.appStacks.includes(appStack);
      }
      return true;
    });
  }

  return all;
}

export function getPackMeta(packId: string): PackMeta | null {
  return loadPacks().find((p) => p.id === packId) ?? null;
}

export function getPreviewUrl(packId: string): string | null {
  const entry = Object.entries(previewModules).find(([path]) =>
    path.includes(`/packs/${packId}/`),
  );
  return entry?.[1] ?? null;
}

export function loadPrompts(packId: string): PackPrompt[] {
  return Object.entries(promptModules)
    .filter(([path]) => path.includes(`/packs/${packId}/prompts/`))
    .map(([path, content]) => {
      const match = path.match(/(\d+)-([^.]+)\.md$/);
      const step = match ? Number.parseInt(match[1], 10) : 0;
      const slug = match?.[2] ?? "step";
      return {
        step,
        slug,
        title: STEP_TITLES[slug] ?? slug,
        content: content.trim(),
      };
    })
    .sort((a, b) => a.step - b.step);
}

export function difficultyLabel(level: number): string {
  if (level <= 1) return "入门";
  if (level === 2) return "进阶";
  return "挑战";
}

export function scaffoldPreviewLabel(kind: ScaffoldKind): string {
  switch (kind) {
    case "miniprogram":
      return "微信开发者工具中预览（小程序 / 小游戏）";
    case "minigame":
      return "微信开发者工具 · 小游戏模式预览";
    case "flutter":
      return "flutter run 或 IDE 热重载预览";
    case "guide":
      return "按 README 在 Xcode / Android Studio 中打开";
    default:
      return "本地预览 index.html";
  }
}
