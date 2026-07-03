import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Folder,
  LayoutGrid,
  List,
  Loader2,
  FolderPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { DirectoryListing } from "@/lib/tauri-types";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "grid";

interface ProjectDirBrowserProps {
  selectedPath: string | null;
  onSelect: (path: string) => void;
  className?: string;
}

export function ProjectDirBrowser({
  selectedPath,
  onSelect,
  className,
}: ProjectDirBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [highlightPath, setHighlightPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("新建文件夹");
  const containerRef = useRef<HTMLDivElement>(null);

  const { run: runList, loading: listingLoading } =
    useTauriCommand<DirectoryListing>();
  const { run: runHome } = useTauriCommand<string>();
  const { run: runCreate, loading: creating } =
    useTauriCommand<{ name: string; path: string }>();

  const loadDirectory = useCallback(
    async (path?: string) => {
      setError(null);
      try {
        let target = path;
        if (!target) {
          target = (await runHome("home_directory")) ?? undefined;
        }
        if (!target) return;
        const result = await runList("list_directory", { path: target });
        if (result) {
          setListing(result);
          setHighlightPath((prev) =>
            prev && result.entries.some((e) => e.path === prev)
              ? prev
              : result.path,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    },
    [runHome, runList],
  );

  useEffect(() => {
    void loadDirectory(selectedPath ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const openFolder = (path: string) => {
    setHighlightPath(path);
    void loadDirectory(path);
  };

  const goUp = () => {
    if (listing?.parent) void loadDirectory(listing.parent);
  };

  const confirmSelection = () => {
    const path = highlightPath ?? listing?.path;
    if (path) onSelect(path);
  };

  const handleCreateFolder = async () => {
    if (!listing) return;
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const created = await runCreate("create_subdirectory", {
        parentPath: listing.path,
        folderName: name,
      });
      if (created) {
        setNewFolderOpen(false);
        setNewFolderName("新建文件夹");
        setContextMenu(null);
        await loadDirectory(listing.path);
        setHighlightPath(created.path);
        onSelect(created.path);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const activePath = highlightPath ?? listing?.path ?? null;

  return (
    <div className={cn("space-y-2", className)} ref={containerRef}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!listing?.parent || listingLoading}
          onClick={goUp}
          title="上一级"
        >
          <ArrowUp className="size-4" />
        </Button>
        <p className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/30 px-2 py-1.5 font-mono text-xs text-foreground dark:bg-muted/20">
          {listing?.path ?? "加载中…"}
        </p>
        <div className="flex rounded-lg border border-border p-0.5">
          <Button
            type="button"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("list")}
            title="列表"
          >
            <List className="size-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("grid")}
            title="图标"
          >
            <LayoutGrid className="size-4" />
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!activePath || listingLoading}
          onClick={confirmSelection}
        >
          <Check className="size-4" />
          使用此文件夹
        </Button>
      </div>

      <div
        className="relative min-h-[220px] rounded-xl border border-border bg-background"
        onContextMenu={onContextMenu}
      >
        {listingLoading && (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            读取目录…
          </div>
        )}

        {!listingLoading && listing && (
          <>
            <button
              type="button"
              onClick={() => setHighlightPath(listing.path)}
              onDoubleClick={() => openFolder(listing.path)}
              className={cn(
                "flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                activePath === listing.path && "bg-primary/10",
              )}
            >
              <Folder className="size-4 shrink-0 text-primary" />
              <span className="font-medium">当前文件夹（点选后按「使用此文件夹」）</span>
            </button>

            {listing.entries.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                此目录下没有子文件夹。右键可新建文件夹。
              </p>
            ) : viewMode === "list" ? (
              <ul className="max-h-[280px] overflow-auto py-1">
                {listing.entries.map((entry) => (
                  <li key={entry.path}>
                    <button
                      type="button"
                      onClick={() => setHighlightPath(entry.path)}
                      onDoubleClick={() => openFolder(entry.path)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                        activePath === entry.path && "bg-primary/10",
                      )}
                    >
                      <Folder className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                      <span className="truncate">{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid max-h-[280px] grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 overflow-auto p-3">
                {listing.entries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => setHighlightPath(entry.path)}
                    onDoubleClick={() => openFolder(entry.path)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border border-transparent p-2 text-center text-xs transition-colors hover:bg-muted/50",
                      activePath === entry.path && "border-primary/40 bg-primary/10",
                    )}
                  >
                    <Folder className="size-8 text-amber-500 dark:text-amber-400" />
                    <span className="line-clamp-2 w-full break-all">{entry.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {contextMenu && (
          <div
            className="fixed z-50 min-w-[140px] rounded-lg border border-border bg-popover py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setContextMenu(null);
                setNewFolderOpen(true);
              }}
            >
              <FolderPlus className="size-4" />
              新建文件夹
            </button>
          </div>
        )}
      </div>

      {newFolderOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 dark:bg-muted/20">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="h-9 min-w-[160px] flex-1 rounded-lg border border-input bg-background px-3 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateFolder();
              if (e.key === "Escape") setNewFolderOpen(false);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={creating || !newFolderName.trim()}
            onClick={() => void handleCreateFolder()}
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : "创建"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setNewFolderOpen(false)}
          >
            取消
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        单击选中 · 双击进入子文件夹 · 右键新建文件夹 · 选好后点「使用此文件夹」
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
