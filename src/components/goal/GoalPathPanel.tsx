import { Compass, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getGoalHint, getGoalLabel } from "@/lib/build-goals";
import type { AppStack, BuildGoal } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

interface GoalPathPanelProps {
  buildGoal: BuildGoal | null;
  appStack: AppStack | null;
  onSwitch?: () => void;
  className?: string;
  compact?: boolean;
}

export function GoalPathPanel({
  buildGoal,
  appStack,
  onSwitch,
  className,
  compact = false,
}: GoalPathPanelProps) {
  const label = getGoalLabel(buildGoal, appStack);
  const hint = getGoalHint(buildGoal, appStack);

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          <Compass className="size-4 text-primary" />
          <span className="text-muted-foreground">方向：</span>
          <span className="font-medium text-foreground">{label}</span>
        </div>
        {onSwitch && (
          <Button type="button" variant="ghost" size="sm" onClick={onSwitch}>
            <RefreshCw className="size-3.5" />
            切换
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Compass className="size-4 text-primary" />
          你的方向：{label}
        </CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      {onSwitch && (
        <CardContent className="pt-0">
          <Button type="button" variant="outline" size="sm" onClick={onSwitch}>
            <RefreshCw className="size-3.5" />
            切换方向
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
