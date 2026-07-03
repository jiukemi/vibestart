import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface VibeStartSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "size-4 border-2",
  md: "size-8 border-2",
  lg: "size-10 border-[3px]",
};

export function VibeStartSpinner({
  className,
  size = "md",
}: VibeStartSpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary/25 border-t-primary",
        sizeClass[size],
        className,
      )}
      role="status"
      aria-label="加载中"
    />
  );
}

interface VibeStartLoadingProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

export function VibeStartLoading({
  message = "加载中…",
  className,
  compact = false,
}: VibeStartLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "py-6" : "py-10",
        className,
      )}
    >
      <VibeStartSpinner size={compact ? "sm" : "md"} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
  visible: boolean;
}

export function LoadingOverlay({ message, visible }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm dark:bg-background/70">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-8 py-6 shadow-sm">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">
          {message ?? "处理中…"}
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          首次安装或检测可能需要 1–3 分钟，请稍候
        </p>
      </div>
    </div>
  );
}
