export interface PackMeta {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  estimatedMinutes: number;
  tags: string[];
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

export function loadPacks(): PackMeta[] {
  return Object.entries(metaModules)
    .map(([path, meta]) => ({
      ...meta,
      id: meta.id || packIdFromPath(path),
    }))
    .sort((a, b) => a.difficulty - b.difficulty);
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
