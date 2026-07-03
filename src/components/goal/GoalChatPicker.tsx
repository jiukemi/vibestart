import { useCallback, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  APP_STACK_OPTIONS,
  GOAL_OPTIONS,
  getGoalHint,
  getGoalLabel,
  isGoalSelectionComplete,
} from "@/lib/build-goals";
import type { AppStack, BuildGoal } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

type Phase = "goal" | "app-stack" | "summary";

interface ChatLine {
  role: "assistant" | "user";
  text: string;
}

interface GoalChatPickerProps {
  initialGoal?: BuildGoal | null;
  initialAppStack?: AppStack | null;
  onComplete: (goal: BuildGoal, appStack: AppStack | null) => void;
  /** 切换方向：始终从选项开始，不停在旧 summary */
  mode?: "initial" | "switch";
  /** @deprecated 使用 mode="switch" */
  compact?: boolean;
}

function resolveInitialPhase(
  mode: "initial" | "switch",
  initialGoal: BuildGoal | null,
  initialAppStack: AppStack | null,
): Phase {
  if (mode === "switch") {
    return "goal";
  }
  if (initialGoal === "app" && initialAppStack) return "summary";
  if (initialGoal && initialGoal !== "app") return "summary";
  return "goal";
}

export function GoalChatPicker({
  initialGoal = null,
  initialAppStack = null,
  onComplete,
  mode: modeProp,
  compact = false,
}: GoalChatPickerProps) {
  const mode = modeProp ?? (compact ? "switch" : "initial");

  const [phase, setPhase] = useState<Phase>(() =>
    resolveInitialPhase(mode, initialGoal, initialAppStack),
  );
  const [goal, setGoal] = useState<BuildGoal | null>(
    mode === "switch" ? null : initialGoal,
  );
  const [appStack, setAppStack] = useState<AppStack | null>(
    mode === "switch" ? null : initialAppStack,
  );
  const [lines, setLines] = useState<ChatLine[]>(() => {
    if (mode === "switch" && initialGoal) {
      return [
        {
          role: "assistant",
          text: `当前方向是「${getGoalLabel(initialGoal, initialAppStack)}」。请选择一个新方向（选完后会重置环境安装、模板等项目进度）：`,
        },
      ];
    }
    return [
      {
        role: "assistant",
        text: "你好！我是 VibeStart 向导。先告诉我：你这次最想做什么？",
      },
    ];
  });

  const append = useCallback((user: string, assistant: string) => {
    setLines((prev) => [
      ...prev,
      { role: "user", text: user },
      { role: "assistant", text: assistant },
    ]);
  }, []);

  const pickGoal = (option: (typeof GOAL_OPTIONS)[number]) => {
    setGoal(option.id);
    if (option.id === "app") {
      append(
        option.title,
        "做 App 很好！接下来选开发方式：混合开发上手更快，原生开发性能最好但环境更重。",
      );
      setPhase("app-stack");
      return;
    }
    if (option.id === "explore") {
      append(
        option.title,
        "没问题！零基础建议先从网页开始：选模板 → 用 AI 改代码 → Vercel 部署，30 秒就能分享链接。",
      );
      setAppStack(null);
      setPhase("summary");
      return;
    }
    append(
      option.title,
      option.id === "website"
        ? "网页是最快的 0→1 路径。接下来会帮你装 Git、Node，并推荐 Vercel 部署。"
        : "小程序 / 小游戏需要微信开发者工具。接下来会帮你装 Git、Node，并引导安装开发者工具。",
    );
    setAppStack(null);
    setPhase("summary");
  };

  const pickAppStack = (option: (typeof APP_STACK_OPTIONS)[number]) => {
    setAppStack(option.id);
    append(
      option.title,
      option.id === "hybrid"
        ? "混合开发推荐 Flutter。接下来会安装 Git、Node，并尝试安装 Flutter SDK。"
        : "原生开发需要 Xcode（macOS）和/或 Android Studio。",
    );
    setPhase("summary");
  };

  const canConfirm = isGoalSelectionComplete(goal, appStack);

  const summaryHint = useMemo(
    () => getGoalHint(goal, appStack),
    [goal, appStack],
  );

  const reset = () => {
    setPhase("goal");
    setGoal(null);
    setAppStack(null);
    setLines([
      {
        role: "assistant",
        text: "好的，重新选一次：你这次最想做什么？",
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4 dark:bg-muted/10">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              line.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                line.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground ring-1 ring-border",
              )}
            >
              {line.text}
            </div>
          </div>
        ))}
      </div>

      {phase === "goal" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => pickGoal(option)}
              className={cn(
                "rounded-xl border border-border bg-card p-4 text-left transition-colors",
                "hover:border-primary/40 hover:bg-muted/30",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="text-lg">{option.emoji}</span>
              <p className="mt-1 text-sm font-medium text-foreground">
                {option.title}
                {option.forBeginner && (
                  <span className="ml-1.5 text-xs font-normal text-primary">
                    推荐
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {option.subtitle}
              </p>
            </button>
          ))}
        </div>
      )}

      {phase === "app-stack" && (
        <div className="space-y-2">
          {APP_STACK_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => pickAppStack(option)}
              className={cn(
                "w-full rounded-xl border border-border bg-card p-4 text-left transition-colors",
                "hover:border-primary/40 hover:bg-muted/30",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <p className="text-sm font-medium text-foreground">{option.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      )}

      {phase === "summary" && canConfirm && goal && (
        <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4 dark:bg-primary/10">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="size-4 text-primary" />
            {getGoalLabel(goal, appStack)}
          </p>
          <p className="text-xs text-muted-foreground">{summaryHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onComplete(goal, appStack)}>
              确认{mode === "switch" ? "切换" : ""}，继续向导
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={reset}>
              重新选择
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
