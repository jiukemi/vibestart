import { Monitor, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IdeLaunchState } from "@/lib/tauri-types";

interface LaunchIdeDialogProps {
  open: boolean;
  state: IdeLaunchState | null;
  loading?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onUseExisting: () => void;
  onOpenNew: () => void;
}

export function LaunchIdeDialog({
  open,
  state,
  loading = false,
  error,
  onOpenChange,
  onUseExisting,
  onOpenNew,
}: LaunchIdeDialogProps) {
  const Icon = state?.isCli ? Terminal : Monitor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5 text-primary" />
            {state?.ideName ?? "编辑器"} 已在运行
          </DialogTitle>
          <DialogDescription>
            {state?.hint ??
              "检测到编辑器已在运行。你可以切换到现有窗口，或新开一个。"}
          </DialogDescription>
        </DialogHeader>

        {state?.isCli && (
          <p className="text-xs text-muted-foreground">
            终端类工具（如 Claude Code）通常不需要同时开多个窗口。建议优先使用现有窗口。
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onUseExisting}
          >
            使用现有窗口
          </Button>
          <Button type="button" disabled={loading} onClick={onOpenNew}>
            {loading ? "启动中…" : "新开一个窗口"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
