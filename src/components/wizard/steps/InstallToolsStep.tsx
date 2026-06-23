import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepShell } from "@/components/wizard/StepShell";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { OsInfo, ToolStatus } from "@/lib/tauri-types";
import { WIZARD_STEPS } from "@/lib/steps";

const step = WIZARD_STEPS[2];

const MACOS_GUIDE = [
  "安装 Homebrew（若未安装）：",
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
  "安装 Git：brew install git",
  "安装 Node.js：brew install node",
  "安装 Cursor：brew install --cask cursor",
];

const WINDOWS_GUIDE = [
  "安装 winget（Windows 10/11 通常已内置）",
  "安装 Git：winget install Git.Git",
  "安装 Node.js：winget install OpenJS.NodeJS.LTS",
  "安装 Cursor：winget install Cursor.Cursor",
];

export function InstallToolsStep() {
  const { run: runOs } = useTauriCommand<OsInfo>();
  const { run: runScan, loading: scanLoading, data: scanData } =
    useTauriCommand<ToolStatus[]>();
  const [platform, setPlatform] = useState<string>("unknown");

  const rescan = useCallback(async () => {
    await runScan("scan_environment");
  }, [runScan]);

  useEffect(() => {
    void (async () => {
      const info = await runOs("get_os_info");
      if (info) setPlatform(info.platform);
      await runScan("scan_environment");
    })();
  }, [runOs, runScan]);

  const guide =
    platform === "macos"
      ? MACOS_GUIDE
      : platform === "windows"
        ? WINDOWS_GUIDE
        : ["请根据你的操作系统手动安装 Git、Node.js 和 Cursor。"];

  const missingTools =
    scanData?.filter((t) => !t.installed || !t.meets_minimum) ?? [];

  return (
    <StepShell title={step.title} description={step.description}>
      <Card>
        <CardHeader>
          <CardTitle>
            {platform === "macos"
              ? "macOS 安装指引（Homebrew）"
              : platform === "windows"
                ? "Windows 安装指引（winget）"
                : "安装指引"}
          </CardTitle>
          <CardDescription>
            在终端中运行以下命令安装缺失的工具。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-2 text-sm text-foreground">
            {guide.map((line, i) => (
              <li key={i} className={line.startsWith("/") || line.startsWith("brew") || line.startsWith("winget") ? "font-mono text-xs" : ""}>
                {line}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {missingTools.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>待安装工具</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {missingTools.map((t) => (
                <li key={t.name} className="capitalize">
                  {t.name}
                  {!t.installed ? "（未安装）" : "（版本过低）"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void rescan()}
          disabled={scanLoading}
        >
          {scanLoading ? "扫描中…" : "重新扫描"}
        </Button>
        {scanData && missingTools.length === 0 && (
          <span className="text-sm text-muted-foreground">
            ✅ 所有工具已就绪
          </span>
        )}
      </div>
    </StepShell>
  );
}
