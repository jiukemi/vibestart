import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PackSelector } from "@/components/packs/PackSelector";
import { PreviewPane } from "@/components/packs/PreviewPane";
import { PromptStepper } from "@/components/packs/PromptStepper";
import { StepShell } from "@/components/wizard/StepShell";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { PackMeta } from "@/lib/packs";
import { WIZARD_STEPS } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizardStore";

const step = WIZARD_STEPS[6];

export function FirstProjectStep() {
  const packId = useWizardStore((s) => s.selections.packId);
  const projectDir = useWizardStore((s) => s.selections.projectDir);
  const setSelection = useWizardStore((s) => s.setSelection);

  const [initError, setInitError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const initCommand = useTauriCommand<void>();
  const dirCommand = useTauriCommand<string>();

  useEffect(() => {
    if (projectDir) return;
    void dirCommand.run("default_project_dir").then((dir) => {
      if (dir) setSelection("projectDir", dir);
    });
  }, [dirCommand, projectDir, setSelection]);

  useEffect(() => {
    if (packId && projectDir) {
      setInitialized(true);
    }
  }, [packId, projectDir]);

  const handleSelectPack = useCallback(
    async (pack: PackMeta) => {
      setInitError(null);
      setSelection("packId", pack.id);

      let targetDir = projectDir;
      if (!targetDir) {
        targetDir = (await dirCommand.run("default_project_dir")) ?? null;
        if (targetDir) {
          setSelection("projectDir", targetDir);
        }
      }

      if (!targetDir) {
        setInitError("无法确定项目目录");
        return;
      }

      try {
        await initCommand.run("init_project", {
          packId: pack.id,
          targetDir,
        });
        setInitialized(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setInitError(message);
        setInitialized(false);
      }
    },
    [dirCommand, initCommand, projectDir, setSelection],
  );

  const isReady = Boolean(packId && projectDir && initialized);

  return (
    <StepShell
      title={step.title}
      description={step.description}
      nextDisabled={!isReady}
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">选择项目模板</h3>
          <PackSelector
            selectedId={packId}
            onSelect={(pack) => void handleSelectPack(pack)}
            disabled={initCommand.loading}
          />
          {initCommand.loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在初始化项目到 {projectDir ?? "默认目录"}…
            </p>
          )}
          {initError && (
            <p className="text-sm text-destructive">{initError}</p>
          )}
          {projectDir && (
            <p className="text-xs text-muted-foreground">
              项目目录：<code className="text-foreground">{projectDir}</code>
            </p>
          )}
        </section>

        <PreviewPane packId={packId} />

        {packId && projectDir && initialized && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              跟着提示词做（0→1 Vibe Coding）
            </h3>
            <PromptStepper packId={packId} projectDir={projectDir} />
          </section>
        )}
      </div>
    </StepShell>
  );
}
