import { CommandOutput } from "@/components/shared/CommandOutput";
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
} from "@/components/ui/progress";
import type { InstallProgressPayload } from "@/hooks/useInstallProgress";
import { cn } from "@/lib/utils";

interface InstallProgressPanelProps {
  loading?: boolean;
  log?: string | null;
  progress?: InstallProgressPayload | null;
  className?: string;
}

export function InstallProgressPanel({
  loading,
  log,
  progress,
  className,
}: InstallProgressPanelProps) {
  const showProgress = loading || Boolean(progress);
  const mergedLog = [progress?.message, log].filter(Boolean).join("\n\n");

  if (!showProgress && !mergedLog) return null;

  const percent = progress?.percent ?? null;
  const indeterminate = progress?.indeterminate ?? (loading && percent == null);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-muted/40 dark:bg-muted/20",
        className,
      )}
    >
      {showProgress && (
        <div className="space-y-2 border-b border-border px-3 py-3">
          <Progress
            value={indeterminate ? null : percent}
            className="w-full"
          >
            <div className="flex w-full items-center gap-2">
              <ProgressLabel className="min-w-0 flex-1 truncate text-xs text-foreground">
                {progress?.message ?? (loading ? "正在安装…" : "准备中…")}
                {!indeterminate && percent != null ? `（${percent}%）` : ""}
              </ProgressLabel>
            </div>
            <ProgressTrack className="mt-2 h-2">
              <ProgressIndicator
                className={cn(
                  indeterminate &&
                    "w-1/3 animate-[vibestart-progress_1.2s_ease-in-out_infinite]",
                )}
              />
            </ProgressTrack>
          </Progress>
        </div>
      )}
      <CommandOutput
        loading={loading && !mergedLog}
        log={mergedLog || null}
        className="border-0 rounded-none bg-transparent dark:bg-transparent"
      />
    </div>
  );
}
