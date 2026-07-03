import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface CommandOutputProps {
  log?: string | null;
  loading?: boolean;
  className?: string;
}

export function CommandOutput({ log, loading, className }: CommandOutputProps) {
  if (!loading && !log) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/40 dark:bg-muted/20",
        className,
      )}
    >
      <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        {loading ? "正在执行…" : "执行日志"}
      </div>
      <ScrollArea className="h-40">
        <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
          {loading && !log ? "请稍候，命令在应用内运行中…" : log}
        </pre>
      </ScrollArea>
    </div>
  );
}
