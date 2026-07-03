import { useEffect, useMemo } from "react";
import { Monitor } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { IDE_OPTIONS } from "@/lib/ide";
import type { ToolStatus } from "@/lib/tauri-types";
import { cn } from "@/lib/utils";

interface IdeSyncTargetPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  primaryIde: string | null;
}

export function IdeSyncTargetPicker({
  selected,
  onChange,
  primaryIde,
}: IdeSyncTargetPickerProps) {
  const safeSelected = selected ?? [];
  const { run: runScan, loading, data: scanData } = useTauriCommand<ToolStatus[]>();

  useEffect(() => {
    void runScan("scan_environment");
  }, [runScan]);

  const installedIdes = useMemo(() => {
    const installed = new Set(
      scanData?.filter((t) => t.installed).map((t) => t.name) ?? [],
    );
    return IDE_OPTIONS.filter((ide) => installed.has(ide.scanKey));
  }, [scanData]);

  useEffect(() => {
    if (loading || installedIdes.length === 0) return;
    if (safeSelected.length > 0) return;

    const defaults: string[] = [];
    const primary = primaryIde ?? "cursor";
    if (installedIdes.some((ide) => ide.id === primary)) {
      defaults.push(primary);
    } else {
      defaults.push(installedIdes[0].id);
    }
    onChange(defaults);
  }, [installedIdes, loading, onChange, primaryIde, safeSelected.length]);

  const toggle = (id: string) => {
    if (safeSelected.includes(id)) {
      onChange(safeSelected.filter((x) => x !== id));
    } else {
      onChange([...safeSelected, id]);
    }
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="size-4" />
          同步到哪些编辑器？
        </CardTitle>
        <CardDescription>
          可多选。只显示本机已安装的编辑器；同步前会请你再次确认。
        </CardDescription>
      </CardHeader>
      <div className="px-6 pb-6">
        {loading && (
          <p className="text-sm text-muted-foreground">正在检测已安装的编辑器…</p>
        )}
        {!loading && installedIdes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            暂未检测到已安装的 AI 编辑器。Key 仍会保存在 VibeStart，安装编辑器后可回来同步。
          </p>
        )}
        {!loading && installedIdes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {installedIdes.map((ide) => {
              const checked = safeSelected.includes(ide.id);
              const isPrimary = ide.id === (primaryIde ?? "cursor");
              return (
                <button
                  key={ide.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(ide.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {ide.name}
                  {isPrimary && (
                    <span className="ml-1.5 text-xs opacity-70">主编辑器</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
