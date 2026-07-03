import { useCallback, useEffect, useState } from "react";
import { FolderCog, MapPin, Pencil } from "lucide-react";

import { ProjectDirBrowser } from "@/components/project/ProjectDirBrowser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOsInfo } from "@/hooks/useOsInfo";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { installBackendLabel } from "@/lib/platform-ui";
import type { ToolsInstallInfo, ToolsInstallMode } from "@/lib/tauri-types";
import { cn } from "@/lib/utils";

interface ToolsInstallDirPickerProps {
  className?: string;
  onSaved?: () => void;
}

export function ToolsInstallDirPicker({
  className,
  onSaved,
}: ToolsInstallDirPickerProps) {
  const { platform } = useOsInfo();
  const [mode, setMode] = useState<ToolsInstallMode>("recommended");
  const [customDir, setCustomDir] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState<ToolsInstallInfo | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { run: loadInfo } = useTauriCommand<ToolsInstallInfo>();
  const { run: saveConfig, loading: saving } = useTauriCommand<void>();

  const refresh = useCallback(async () => {
    try {
      const result = await loadInfo("get_tools_install_info");
      if (result) {
        setInfo(result);
        setMode(result.mode);
        setCustomDir(result.custom_dir);
        setEditing(result.mode === "custom" && !result.custom_dir);
      }
    } catch {
      setInfo(null);
    }
  }, [loadInfo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persist = useCallback(
    async (nextMode: ToolsInstallMode, dir: string | null) => {
      setSaveError(null);
      try {
        await saveConfig("save_tools_install_config", {
          mode: nextMode,
          custom_dir: nextMode === "custom" ? dir : null,
        });
        await refresh();
        onSaved?.();
        if (nextMode === "custom" && dir) {
          setEditing(false);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSaveError(message);
      }
    },
    [onSaved, refresh, saveConfig],
  );

  const selectRecommended = () => {
    setMode("recommended");
    setEditing(false);
    void persist("recommended", null);
  };

  const applyCustomDir = (dir: string) => {
    setCustomDir(dir);
    setMode("custom");
    void persist("custom", dir);
  };

  const backend = installBackendLabel(platform);

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderCog className="size-4" />
          工具安装位置
        </CardTitle>
        <CardDescription>
          与工作区文件夹一样：可用推荐位置，或指定父目录。npm CLI 工具（Claude Code、Vercel
          等）与 GUI 编辑器会按你的选择安装；Git / Node 仍走 {backend} 系统推荐路径。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={selectRecommended}
            disabled={saving}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              mode === "recommended"
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-border hover:bg-muted/50",
            )}
          >
            <p className="text-sm font-medium text-foreground">推荐位置</p>
            <p className="mt-1 text-xs text-muted-foreground">
              npm → {info?.effective_npm_prefix ?? "~/.vibestart/tools/npm"}
              <br />
              GUI → 系统默认（macOS 应用程序 / Windows Programs）
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("custom");
              setEditing(true);
            }}
            disabled={saving}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              mode === "custom"
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-border hover:bg-muted/50",
            )}
          >
            <p className="text-sm font-medium text-foreground">自定义目录</p>
            <p className="mt-1 text-xs text-muted-foreground">
              在其下创建 npm/ 与 apps/ 子目录
            </p>
          </button>
        </div>

        {mode === "custom" && customDir && !editing && (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 dark:bg-emerald-500/10">
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <MapPin className="size-3.5" />
              已选定安装根目录
            </p>
            <p className="break-all font-mono text-sm text-foreground">{customDir}</p>
            <p className="text-xs text-muted-foreground">
              npm CLI → {info?.effective_npm_prefix}
              <br />
              GUI 编辑器 → {info?.effective_gui_dir}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
              更换目录
            </Button>
          </div>
        )}

        {mode === "custom" && editing && (
          <ProjectDirBrowser
            selectedPath={customDir ?? info?.recommended_root ?? null}
            onSelect={applyCustomDir}
          />
        )}

        {info?.git_node_note && (
          <p className="text-xs text-muted-foreground">{info.git_node_note}</p>
        )}

        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}
      </CardContent>
    </Card>
  );
}
