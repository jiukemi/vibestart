import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, FolderOpen } from "lucide-react";

import { ProjectDirBrowser } from "@/components/project/ProjectDirBrowser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { ProjectDirStatus } from "@/lib/tauri-types";
import { cn } from "@/lib/utils";

interface ProjectDirPickerProps {
  value: string | null;
  onChange: (dir: string) => void;
  onDirChanged?: () => void;
  className?: string;
}

export function ProjectDirPicker({
  value,
  onChange,
  onDirChanged,
  className,
}: ProjectDirPickerProps) {
  const [editing, setEditing] = useState(!value);
  const [status, setStatus] = useState<ProjectDirStatus | null>(null);

  const { run: runStatus } = useTauriCommand<ProjectDirStatus>();
  const { run: runReveal, loading: revealing } = useTauriCommand<void>();

  const refreshStatus = useCallback(
    async (dir: string) => {
      try {
        const result = await runStatus("project_dir_status", { dir });
        if (result) setStatus(result);
      } catch {
        setStatus(null);
      }
    },
    [runStatus],
  );

  useEffect(() => {
    if (value) {
      void refreshStatus(value);
      setEditing(false);
    } else {
      setStatus(null);
      setEditing(true);
    }
  }, [value, refreshStatus]);

  const applyDir = useCallback(
    (dir: string) => {
      onChange(dir);
      onDirChanged?.();
      setEditing(false);
      void refreshStatus(dir);
    },
    [onChange, onDirChanged, refreshStatus],
  );

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4" />
          第一步：选择项目文件夹
        </CardTitle>
        <CardDescription>
          在下方浏览你的个人目录，选好后即可选模板。模板文件只会补充缺失项，不会覆盖已有文件。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {value && !editing ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 dark:bg-emerald-500/10">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                工作区已选定
              </p>
              <p className="mt-1 break-all font-mono text-sm text-foreground">
                {value}
              </p>
              {status && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {status.has_index_html
                    ? "已有 index.html，选模板时不会覆盖"
                    : status.is_empty
                      ? "空文件夹，选模板后会补充 starter 文件"
                      : "含其他文件，选模板只补充缺失文件"}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" />
                更换文件夹
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={revealing}
                onClick={() => void runReveal("reveal_project_dir", { dir: value })}
              >
                <FolderOpen className="size-4" />
                在访达中打开
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              接下来在下方选择项目模板即可，无需再创建文件夹。
            </p>
          </div>
        ) : (
          <ProjectDirBrowser
            selectedPath={value}
            onSelect={applyDir}
          />
        )}
      </CardContent>
    </Card>
  );
}
