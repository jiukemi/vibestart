import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

export interface InstallProgressPayload {
  phase: string;
  message: string;
  percent: number | null;
  indeterminate: boolean;
}

export function useInstallProgress(active: boolean) {
  const [progress, setProgress] = useState<InstallProgressPayload | null>(
    null,
  );
  const [streamLog, setStreamLog] = useState("");

  const reset = useCallback(() => {
    setProgress(null);
    setStreamLog("");
  }, []);

  useEffect(() => {
    if (!active) {
      reset();
      return;
    }

    reset();
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      unsubs.push(
        await listen<InstallProgressPayload>("install-progress", (event) => {
          if (!cancelled) setProgress(event.payload);
        }),
      );
      unsubs.push(
        await listen<string>("install-log", (event) => {
          if (!cancelled) {
            setStreamLog((prev) =>
              prev ? `${prev}\n${event.payload}` : event.payload,
            );
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
    };
  }, [active, reset]);

  return { progress, streamLog, reset };
}
