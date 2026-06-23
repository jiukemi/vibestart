import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepShell } from "@/components/wizard/StepShell";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { ToolStatus } from "@/lib/tauri-types";
import { WIZARD_STEPS } from "@/lib/steps";
import { cn } from "@/lib/utils";

const step = WIZARD_STEPS[1];

function statusIcon(tool: ToolStatus): { icon: string; label: string } {
  if (!tool.installed) {
    return { icon: "❌", label: "未安装" };
  }
  if (!tool.meets_minimum) {
    return { icon: "⚠️", label: "版本过低" };
  }
  return { icon: "✅", label: "正常" };
}

function ToolCard({ tool }: { tool: ToolStatus }) {
  const { icon, label } = statusIcon(tool);

  return (
    <Card size="sm">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="capitalize">{tool.name}</CardTitle>
        <span className="text-lg" title={label} aria-label={label}>
          {icon}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={tool.installed ? "secondary" : "destructive"}
            className="capitalize"
          >
            {tool.installed ? "已安装" : "未安装"}
          </Badge>
          {tool.installed && !tool.meets_minimum && (
            <Badge variant="outline">版本不满足最低要求</Badge>
          )}
        </div>
        {tool.version && (
          <p className="text-xs text-muted-foreground">版本：{tool.version}</p>
        )}
        {tool.path && (
          <p className={cn("truncate text-xs text-muted-foreground")}>
            路径：{tool.path}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function HealthCheckStep() {
  const { run, loading, error, data } = useTauriCommand<ToolStatus[]>();

  useEffect(() => {
    void run("scan_environment");
  }, [run]);

  return (
    <StepShell title={step.title} description={step.description}>
      {loading && (
        <p className="text-sm text-muted-foreground">正在扫描开发环境…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">扫描失败：{error}</p>
      )}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      )}
    </StepShell>
  );
}
