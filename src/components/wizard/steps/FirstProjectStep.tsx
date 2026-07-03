import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { PenpotPrototypePanel } from "@/components/design/PenpotPrototypePanel";
import { BackendAssistPanel } from "@/components/backend/BackendAssistPanel";
import { GoalPathPanel } from "@/components/goal/GoalPathPanel";
import { GoalSwitcherDialog } from "@/components/goal/GoalSwitcherDialog";
import { PackSelector } from "@/components/packs/PackSelector";
import { PreviewPane } from "@/components/packs/PreviewPane";
import { PromptStepper } from "@/components/packs/PromptStepper";
import { ProjectDirPicker } from "@/components/project/ProjectDirPicker";
import { StepShell } from "@/components/wizard/StepShell";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { supportsBackendAssist } from "@/lib/backend-assist";
import { getGoalHint } from "@/lib/build-goals";
import { getPackMeta, getPacksForGoal } from "@/lib/packs";
import type { InitProjectResult } from "@/lib/tauri-types";
import type { PackMeta } from "@/lib/packs";
import { getStepMeta } from "@/lib/wizard-index";
import { useWizardStore } from "@/stores/wizardStore";

const step = getStepMeta("first-project");

export function FirstProjectStep() {
  const packId = useWizardStore((s) => s.selections.packId);
  const projectDir = useWizardStore((s) => s.selections.projectDir);
  const buildGoal = useWizardStore((s) => s.selections.buildGoal);
  const appStack = useWizardStore((s) => s.selections.appStack);
  const setSelection = useWizardStore((s) => s.setSelection);

  const [initError, setInitError] = useState<string | null>(null);
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [goalSwitchOpen, setGoalSwitchOpen] = useState(false);

  const initCommand = useTauriCommand<InitProjectResult>();

  useEffect(() => {
    setInitialized(false);
    setInitError(null);
    setInitMessage(null);
  }, [buildGoal, appStack, packId]);

  const availablePacks = useMemo(
    () => getPacksForGoal(buildGoal, appStack),
    [buildGoal, appStack],
  );

  const handleProjectDirChange = useCallback(
    (dir: string) => {
      setSelection("projectDir", dir);
      setInitError(null);
      setInitialized(false);
    },
    [setSelection],
  );

  const handleSelectPack = useCallback(
    async (pack: PackMeta) => {
      setInitError(null);
      setInitMessage(null);
      setSelection("packId", pack.id);

      if (!projectDir) {
        setInitError("请先创建或选择项目文件夹");
        return;
      }

      try {
        const result = await initCommand.run("init_project", {
          packId: pack.id,
          targetDir: projectDir,
        });
        if (result) {
          setInitMessage(result.message);
          setInitialized(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setInitError(message);
        setInitialized(false);
      }
    },
    [initCommand, projectDir, setSelection],
  );

  const isReady = Boolean(packId && projectDir && initialized);
  const packMeta = packId ? getPackMeta(packId) : null;
  const canSelectPack = Boolean(projectDir);
  const showBackendAssist = supportsBackendAssist(buildGoal);

  return (
    <StepShell
      title={step.title}
      description={step.description}
      nextDisabled={!isReady}
    >
      <div className="space-y-6">
        <GoalPathPanel
          buildGoal={buildGoal}
          appStack={appStack}
          compact
          onSwitch={() => setGoalSwitchOpen(true)}
        />

        {buildGoal && buildGoal !== "website" && buildGoal !== "explore" && (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {getGoalHint(buildGoal, appStack)}
          </p>
        )}

        <ProjectDirPicker
          value={projectDir}
          onChange={handleProjectDirChange}
          onDirChanged={() => setInitialized(false)}
        />

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">选择项目模板</h3>
          {!canSelectPack && (
            <p className="text-sm text-muted-foreground">
              选好工作区文件夹后，再选模板。
            </p>
          )}
          {packMeta?.kickoffHint && canSelectPack && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 dark:bg-primary/10">
              <p className="text-sm font-medium text-foreground">怎么用这个模板？</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {packMeta.kickoffHint}
              </p>
              {packMeta.goalDescription && (
                <p className="mt-2 text-xs text-muted-foreground">
                  目标：{packMeta.goalDescription}
                </p>
              )}
            </div>
          )}
          <PackSelector
            key={`${buildGoal ?? "none"}-${appStack ?? "none"}`}
            packs={availablePacks}
            selectedId={packId}
            onSelect={(pack) => void handleSelectPack(pack)}
            disabled={initCommand.loading || !canSelectPack}
          />
          {initCommand.loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在初始化项目到 {projectDir}…
            </p>
          )}
          {initMessage && !initError && (
            <p className="text-sm text-muted-foreground">{initMessage}</p>
          )}
          {initError && (
            <p className="text-sm text-destructive">{initError}</p>
          )}
        </section>

        <PreviewPane packId={packId} />

        <PenpotPrototypePanel />

        {showBackendAssist && (
          <BackendAssistPanel
            buildGoal={buildGoal}
            appStack={appStack}
            defaultCollapsed
          />
        )}

        {packId && projectDir && initialized && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              跟着提示词做（0→1 Vibe Coding）
            </h3>
            <PromptStepper packId={packId} projectDir={projectDir} />
          </section>
        )}
      </div>
      <GoalSwitcherDialog
        open={goalSwitchOpen}
        onOpenChange={setGoalSwitchOpen}
      />
    </StepShell>
  );
}
