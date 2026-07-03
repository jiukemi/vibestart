import { useEffect } from "react";
import { Rocket, Route, Sparkles, Upload } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepShell } from "@/components/wizard/StepShell";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { OsInfo } from "@/lib/tauri-types";
import { expressStepCount } from "@/lib/wizard-flow";
import { applyDeployOnlyDefaults, isDeployOnlyIntent } from "@/lib/wizard-intent";
import { getStepMeta } from "@/lib/wizard-index";
import { selectableCardClasses } from "@/lib/selectable-card";
import { useWizardStore, type UserIntent, type WizardTrack } from "@/stores/wizardStore";
import { cn } from "@/lib/utils";

const step = getStepMeta("welcome");

const PLATFORM_LABELS: Record<string, string> = {
  macos: "macOS",
  windows: "Windows",
  unknown: "未知",
};

const INTENTS: {
  id: UserIntent;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  bullets: string[];
}[] = [
  {
    id: "fresh",
    title: "从零开始",
    subtitle: "还没项目，跟着向导装环境、用 AI 做 demo",
    icon: Sparkles,
    bullets: ["检测并安装开发工具", "选模板 + 提示词做第一个作品", "完成后可部署分享"],
  },
  {
    id: "deploy-only",
    title: "已有项目，直接部署",
    subtitle: "环境 elsewhere 已就绪，只想上线",
    icon: Upload,
    bullets: [
      "选已有项目文件夹（需含 index.html）",
      "默认 Gitee Pages，国内访问更稳",
      "也可改选 Vercel",
      "约 3 步完成",
    ],
  },
];

const TRACKS: {
  id: WizardTrack;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  bullets: string[];
}[] = [
  {
    id: "express",
    title: "极速轨（推荐新手）",
    subtitle: "今晚做出可分享的网页",
    icon: Rocket,
    bullets: [
      "准备环境 + 确认 AI 编辑器（Cursor / Claude Code）",
      "跳过 Git 配置，默认 DeepSeek + Vercel",
      "约 6 步走完",
    ],
  },
  {
    id: "full",
    title: "完整轨",
    subtitle: "系统学习全流程",
    icon: Route,
    bullets: [
      "自选 AI 编辑器与 LLM",
      "可选 Gitee / GitHub 与 Pages",
      "适合小程序 / App 方向",
    ],
  },
];

export function WelcomeStep() {
  const userIntent = useWizardStore((s) => s.selections.userIntent);
  const wizardTrack = useWizardStore((s) => s.selections.wizardTrack);
  const buildGoal = useWizardStore((s) => s.selections.buildGoal);
  const setSelection = useWizardStore((s) => s.setSelection);
  const { run, loading, error, data } = useTauriCommand<OsInfo>();

  useEffect(() => {
    void run("get_os_info");
  }, [run]);

  const deployOnly = isDeployOnlyIntent(userIntent);
  const visibleSteps = expressStepCount({ buildGoal, userIntent });

  const handleIntentChange = (intent: UserIntent) => {
    if (intent === "deploy-only") {
      applyDeployOnlyDefaults(setSelection);
      return;
    }
    setSelection("userIntent", "fresh");
  };

  return (
    <StepShell title={step.title} description={step.description} hidePrev>
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">
            你想怎么开始？
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {INTENTS.map((intent) => {
              const Icon = intent.icon;
              const selected = userIntent === intent.id;
              return (
                <button
                  key={intent.id}
                  type="button"
                  onClick={() => handleIntentChange(intent.id)}
                  className="text-left"
                >
                  <Card
                    className={cn(
                      selectableCardClasses(selected, "h-full"),
                      selected && "ring-2 ring-primary/30",
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="size-4 text-primary" />
                        {intent.title}
                      </CardTitle>
                      <CardDescription>{intent.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                        {intent.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
          {deployOnly && (
            <p className="mt-2 text-xs text-muted-foreground">
              部署轨约 {visibleSteps} 步；跳过环境安装与 AI 配置，默认使用 Gitee Pages（国内推荐）。
            </p>
          )}
        </div>

        {!deployOnly && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">
            选择向导模式
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {TRACKS.map((track) => {
              const Icon = track.icon;
              const selected = wizardTrack === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setSelection("wizardTrack", track.id)}
                  className="text-left"
                >
                  <Card
                    className={cn(
                      selectableCardClasses(selected, "h-full"),
                      selected && "ring-2 ring-primary/30",
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="size-4 text-primary" />
                        {track.title}
                      </CardTitle>
                      <CardDescription>{track.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                        {track.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
          {wizardTrack === "express" && (
            <p className="mt-2 text-xs text-muted-foreground">
              极速轨当前约 {visibleSteps} 步；IDE / Git 可在完成后从工作台补开。
            </p>
          )}
        </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">系统信息</CardTitle>
            <CardDescription>
              检测操作系统，以便提供针对性安装指引。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <p className="text-sm text-muted-foreground">正在获取系统信息…</p>
            )}
            {error && (
              <p className="text-sm text-destructive">获取失败：{error}</p>
            )}
            {data && (
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">平台</dt>
                  <dd className="font-medium">
                    {PLATFORM_LABELS[data.platform] ?? data.platform}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">架构</dt>
                  <dd className="font-medium">{data.arch}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">版本</dt>
                  <dd className="font-medium">{data.version || "—"}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </StepShell>
  );
}
