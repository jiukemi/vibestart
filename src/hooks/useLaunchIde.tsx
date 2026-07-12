import { useCallback, useState } from "react";

import { LaunchIdeDialog } from "@/components/ide/LaunchIdeDialog";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { IdeLaunchState } from "@/lib/tauri-types";

interface PendingLaunch {
  ide: string;
  projectDir: string | null;
  state: IdeLaunchState;
}

export function useLaunchIde() {
  const { run: runState, loading: stateLoading } =
    useTauriCommand<IdeLaunchState>();
  const { run: runLaunchCmd, loading: launchLoading, error: launchError } =
    useTauriCommand<void>();
  const [pending, setPending] = useState<PendingLaunch | null>(null);

  const runLaunch = useCallback(
    async (ide: string, projectDir: string | null, mode: "new" | "focus") => {
      await runLaunchCmd("launch_ide", {
        ide,
        projectDir: projectDir?.trim() || null,
        mode,
      });
    },
    [runLaunchCmd],
  );

  const launchIde = useCallback(
    async (ide: string, projectDir?: string | null) => {
      const dir = projectDir?.trim() || null;
      try {
        const state = await runState("get_ide_launch_state", { ide });
        if (state?.running) {
          setPending({ ide, projectDir: dir, state });
          return;
        }
        await runLaunch(ide, dir, "new");
      } catch {
        // errors surfaced via launchCommand / stateCommand
      }
    },
    [runLaunch, runState],
  );

  const confirmFocus = useCallback(async () => {
    if (!pending) return;
    const { ide, projectDir } = pending;
    setPending(null);
    try {
      await runLaunch(ide, projectDir, "focus");
    } catch {
      // error on launchCommand
    }
  }, [pending, runLaunch]);

  const confirmNew = useCallback(async () => {
    if (!pending) return;
    const { ide, projectDir } = pending;
    setPending(null);
    try {
      await runLaunch(ide, projectDir, "new");
    } catch {
      // error on launchCommand
    }
  }, [pending, runLaunch]);

  const dialog = (
    <LaunchIdeDialog
      open={pending !== null}
      state={pending?.state ?? null}
      loading={launchLoading}
      error={launchError}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      onUseExisting={confirmFocus}
      onOpenNew={confirmNew}
    />
  );

  return {
    launchIde,
    launching: stateLoading || launchLoading,
    launchError,
    dialog,
  };
}
