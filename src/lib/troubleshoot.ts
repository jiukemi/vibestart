export interface TroubleshootEntry {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

const troubleshootModules = import.meta.glob("../content/troubleshoot/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function idFromPath(path: string): string {
  const match = path.match(/troubleshoot\/([^.]+)\.md$/);
  return match?.[1] ?? path;
}

function titleFromContent(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? fallback;
}

function keywordsFromEntry(id: string, content: string): string[] {
  const base = id.replace(/-/g, " ");
  const title = titleFromContent(content, id);
  return [id, base, title, ...title.split(/\s+/), ...content.split(/\s+/).slice(0, 20)];
}

export function loadTroubleshootEntries(): TroubleshootEntry[] {
  return Object.entries(troubleshootModules)
    .map(([path, content]) => {
      const id = idFromPath(path);
      const trimmed = content.trim();
      return {
        id,
        title: titleFromContent(trimmed, id),
        keywords: keywordsFromEntry(id, trimmed),
        content: trimmed,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
}

export function filterTroubleshootEntries(
  entries: TroubleshootEntry[],
  query: string,
): TroubleshootEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(q) ||
      entry.id.toLowerCase().includes(q) ||
      entry.content.toLowerCase().includes(q) ||
      entry.keywords.some((kw) => kw.toLowerCase().includes(q)),
  );
}
