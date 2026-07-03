import { GoalChatPicker } from "@/components/goal/GoalChatPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWizardStore, type AppStack, type BuildGoal } from "@/stores/wizardStore";

interface GoalSwitcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalSwitcherDialog({ open, onOpenChange }: GoalSwitcherDialogProps) {
  const buildGoal = useWizardStore((s) => s.selections.buildGoal);
  const appStack = useWizardStore((s) => s.selections.appStack);
  const switchBuildGoal = useWizardStore((s) => s.switchBuildGoal);

  const handleComplete = (goal: BuildGoal, stack: AppStack | null) => {
    switchBuildGoal(goal, stack, { navigateToSetup: true });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>切换开发方向</DialogTitle>
          <DialogDescription>
            更换方向后会重置「准备环境」及之后的进度，并打开环境安装步骤。项目文件夹可保留，但需重新选模板。
          </DialogDescription>
        </DialogHeader>
        {open && (
          <GoalChatPicker
            key={`${buildGoal}-${appStack}-${open}`}
            mode="switch"
            initialGoal={buildGoal}
            initialAppStack={appStack}
            onComplete={handleComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
