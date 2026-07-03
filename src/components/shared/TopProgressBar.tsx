import { useIsAppLoading, useLoadingMessage } from "@/stores/loadingStore";
import { cn } from "@/lib/utils";

export function TopProgressBar() {
  const active = useIsAppLoading();
  const message = useLoadingMessage();

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100]">
      <div
        className="h-0.5 w-full overflow-hidden bg-primary/10"
        role="progressbar"
        aria-label={message ?? "加载中"}
      >
        <div
          className={cn(
            "h-full w-1/3 bg-gradient-to-r from-primary via-violet-500 to-primary",
            "animate-[vibestart-progress_1.2s_ease-in-out_infinite]",
          )}
        />
      </div>
      {message && (
        <p className="sr-only" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
