import { useEffect } from "react";

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
import { WIZARD_STEPS } from "@/lib/steps";

const step = WIZARD_STEPS[0];

const PLATFORM_LABELS: Record<string, string> = {
  macos: "macOS",
  windows: "Windows",
  unknown: "未知",
};

export function WelcomeStep() {
  const { run, loading, error, data } = useTauriCommand<OsInfo>();

  useEffect(() => {
    void run("get_os_info");
  }, [run]);

  return (
    <StepShell title={step.title} description={step.description} hidePrev>
      <Card>
        <CardHeader>
          <CardTitle>系统信息</CardTitle>
          <CardDescription>
            正在检测你的操作系统，以便提供针对性的安装指引。
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
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">平台</dt>
                <dd className="font-medium">
                  {PLATFORM_LABELS[data.platform] ?? data.platform}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">架构</dt>
                <dd className="font-medium">{data.arch}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">版本</dt>
                <dd className="font-medium">{data.version || "—"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        本向导将引导你完成开发环境配置、GitHub 设置、API Key
        配置，并创建你的第一个 Vibe Coding 项目。
      </p>
    </StepShell>
  );
}
