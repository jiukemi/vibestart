import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  filterTroubleshootEntries,
  loadTroubleshootEntries,
  type TroubleshootEntry,
} from "@/lib/troubleshoot";

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ol" | "ul" | null = null;
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0 || !listType) return;
    const Tag = listType;
    elements.push(
      <Tag
        key={key++}
        className={cn(
          "my-2 space-y-1 pl-4 text-xs text-muted-foreground",
          listType === "ol" ? "list-decimal" : "list-disc",
        )}
      >
        {listItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Tag>,
    );
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-sm font-semibold text-foreground">
          {trimmed.slice(2)}
        </h2>,
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={key++} className="mt-3 text-xs font-medium text-foreground">
          {trimmed.slice(3)}
        </h3>,
      );
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(olMatch[1]);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(ulMatch[1]);
      continue;
    }

    flushList();
    elements.push(
      <p key={key++} className="text-xs leading-relaxed text-muted-foreground">
        {trimmed}
      </p>,
    );
  }

  flushList();
  return elements;
}

function EntryDetail({ entry }: { entry: TroubleshootEntry }) {
  return (
    <article className="space-y-1">
      {renderMarkdown(entry.content.replace(/^#\s+.+\n?/, ""))}
    </article>
  );
}

export function TroubleshootPanel() {
  const entries = useMemo(() => loadTroubleshootEntries(), []);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    entries[0]?.id ?? null,
  );

  const filtered = useMemo(
    () => filterTroubleshootEntries(entries, query),
    [entries, query],
  );

  const selected =
    filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="flex h-full flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">故障排查</h3>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索问题…"
          className="flex h-8 w-full rounded-lg border border-input bg-background py-1 pr-3 pl-8 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <ul className="max-h-32 space-y-1 overflow-y-auto">
        {filtered.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                selected?.id === entry.id
                  ? "bg-primary/10 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {entry.title}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-2 py-1 text-xs text-muted-foreground">
            未找到匹配条目
          </li>
        )}
      </ul>

      {selected && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border pt-3">
          <EntryDetail entry={selected} />
        </div>
      )}
    </div>
  );
}
