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
  const stateCommand = useTauriCommand<IdeLaunchState>();
  const launchCommand = useTauriCommand<void>();
  const [pending, setPending] = useState<PendingLaunch | null>(null);

  const runLaunch = useCallback(
    async (ide: string, projectDir: string | null, mode: "new" | "focus") => {
      await launchCommand.run("launch_ide", {
        ide,
        projectDir: projectDir?.trim() || null,
        mode,
      });
    },
    [launchCommand],
  );

  const launchIde = useCallback(
    async (ide: string, projectDir?: string | null) => {
      const dir = projectDir?.trim() || null;
      try {
        const state = await stateCommand.run("get_ide_launch_state", { ide });
        if (state?.running) {
          setPending({ ide, projectDir: dir, state });
          return;
        }
        await runLaunch(ide, dir, "new");
      } catch {
        // errors surfaced via launchCommand / stateCommand
      }
    },
    [runLaunch, stateCommand],
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
      loading={launchCommand.loading}
      error={launchCommand.error}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      onUseExisting={confirmFocus}
      onOpenNew={confirmNew}
    />
  );

  return {
    launchIde,
    launching: stateCommand.loading || launchCommand.loading,
    launchError: launchCommand.error,
    dialog,
  };
}
