import { useEffect, useState } from "react";

import { GoalChatPicker } from "@/components/goal/GoalChatPicker";
import { GoalPathPanel } from "@/components/goal/GoalPathPanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { StepShell } from "@/components/wizard/StepShell";
import { isGoalSelectionComplete } from "@/lib/build-goals";
import { getStepMeta } from "@/lib/wizard-index";
import {
  useWizardStore,
  type AppStack,
  type BuildGoal,
} from "@/stores/wizardStore";

const step = getStepMeta("choose-goal");

export function ChooseGoalStep() {
  const buildGoal = useWizardStore((s) => s.selections.buildGoal);
  const appStack = useWizardStore((s) => s.selections.appStack);
  const wizardTrack = useWizardStore((s) => s.selections.wizardTrack);
  const switchBuildGoal = useWizardStore((s) => s.switchBuildGoal);
  const [confirmed, setConfirmed] = useState(() =>
    isGoalSelectionComplete(buildGoal, appStack),
  );
  const [editing, setEditing] = useState(
    () => !isGoalSelectionComplete(buildGoal, appStack),
  );
  const [downstreamReset, setDownstreamReset] = useState(false);

  useEffect(() => {
    if (isGoalSelectionComplete(buildGoal, appStack)) {
      setConfirmed(true);
    }
  }, [buildGoal, appStack]);

  const handleComplete = (goal: BuildGoal, stack: AppStack | null) => {
    const changed = switchBuildGoal(goal, stack);
    if (changed) {
      setDownstreamReset(true);
    }
    setConfirmed(true);
    setEditing(false);
  };

  const canProceed =
    confirmed &&
    !editing &&
    isGoalSelectionComplete(buildGoal, appStack);
  const needsFullTrack =
    buildGoal === "miniprogram" || buildGoal === "app";

  return (
    <StepShell
      title={step.title}
      description={step.description}
      nextDisabled={!canProceed}
      nextLabel="下一步：准备环境"
    >
      {needsFullTrack && wizardTrack === "full" && (
        <Card className="border-border bg-muted/20">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            小程序 / App 使用<strong className="text-foreground">完整轨</strong>
            （含 IDE、Git 等步骤）。若只想先练网页，可切换为「还不确定，先试试」。
          </CardContent>
        </Card>
      )}

      {downstreamReset && confirmed && !editing && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            方向已更新。请重新完成<strong className="text-foreground">准备环境</strong>
            、<strong className="text-foreground">首个项目</strong>
            {wizardTrack === "express" ? "与部署" : "等后续步骤"}（此前进度已重置）。
          </CardContent>
        </Card>
      )}

      {buildGoal && confirmed && !editing ? (
        <div className="space-y-3">
          <GoalPathPanel buildGoal={buildGoal} appStack={appStack} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(true);
              setConfirmed(false);
              setDownstreamReset(false);
            }}
          >
            重新选择方向
          </Button>
        </div>
      ) : (
        <GoalChatPicker
          key={confirmed && editing ? "switch" : "initial"}
          mode={confirmed && editing ? "switch" : "initial"}
          initialGoal={buildGoal}
          initialAppStack={appStack}
          onComplete={handleComplete}
        />
      )}
    </StepShell>
  );
}
