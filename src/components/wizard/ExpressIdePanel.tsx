import { Download, Monitor, RefreshCw, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getIdeOption, getIdeScanKey, IDE_OPTIONS } from "@/lib/ide";
import {
  selectableCardClasses,
  selectableGridButtonClassName,
} from "@/lib/selectable-card";
import type { ToolStatus } from "@/lib/tauri-types";
import { useWizardStore } from "@/stores/wizardStore";

/** 极速轨精简可选：GUI IDE + 终端 AI */
const EXPRESS_IDE_IDS = ["cursor", "claude-code", "trae"] as const;

export function isPrimaryIdeReady(
  primaryIde: string | null | undefined,
  scanData: ToolStatus[] | undefined,
): boolean {
  if (!scanData) return false;
  const scanKey = getIdeScanKey(primaryIde ?? "cursor");
  if (!scanKey) return false;
  const status = scanData.find((t) => t.name === scanKey);
  return Boolean(status?.installed && status.meets_minimum);
}

interface ExpressIdePanelProps {
  scanData: ToolStatus[] | undefined;
  scanLoading: boolean;
  onInstall: (installToolId: string) => Promise<void>;
  installBusy: boolean;
}

export function ExpressIdePanel({
  scanData,
  scanLoading,
  onInstall,
  installBusy,
}: ExpressIdePanelProps) {
  const primaryIde = useWizardStore((s) => s.selections.primaryIde);
  const setSelection = useWizardStore((s) => s.setSelection);
  const selected = primaryIde ?? "cursor";
  const selectedOption = getIdeOption(selected);
  const scanKey = getIdeScanKey(selected);
  const status = scanKey
    ? scanData?.find((t) => t.name === scanKey)
    : undefined;
  const ready = isPrimaryIdeReady(selected, scanData);

  const expressOptions = IDE_OPTIONS.filter((ide) =>
    (EXPRESS_IDE_IDS as readonly string[]).includes(ide.id),
  );

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="size-4 text-primary" />
          用什么写代码？（必需）
        </CardTitle>
        <CardDescription>
          极速轨省略完整「选择 IDE」步骤，但仍需一款 AI 编辑器来写代码。
          Claude Code 是终端工具，会在<strong className="text-foreground">系统终端</strong>
          中打开（交互界面，当前版本暂不内嵌在 VibeStart 窗口里）。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {expressOptions.map((ide) => {
            const isSelected = selected === ide.id;
            const key = getIdeScanKey(ide.id);
            const ideStatus = key
              ? scanData?.find((t) => t.name === key)
              : undefined;
            const ideReady = Boolean(
              ideStatus?.installed && ideStatus.meets_minimum,
            );

            return (
              <button
                key={ide.id}
                type="button"
                onClick={() => setSelection("primaryIde", ide.id)}
                className={selectableGridButtonClassName()}
              >
                <Card
                  size="sm"
                  className={selectableCardClasses(isSelected, "h-full text-left")}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-1.5 text-sm">
                      {ide.id === "claude-code" ? (
                        <Terminal className="size-3.5" />
                      ) : (
                        <Monitor className="size-3.5" />
                      )}
                      {ide.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {ide.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs">
                      {scanLoading ? (
                        <span className="text-muted-foreground">检测中…</span>
                      ) : ideReady ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✅ 已安装
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          未安装
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {!ready && !scanLoading && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 dark:bg-muted/20">
            <p className="text-sm text-muted-foreground">
              请先安装 <strong className="text-foreground">{selectedOption.name}</strong>
              {selected === "claude-code"
                ? "（npm 全局安装，完成后在「首个项目」里一键打开终端）"
                : "（安装完成后用它在项目文件夹里写代码）"}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={installBusy}
              onClick={() => void onInstall(selectedOption.installTool)}
            >
              {installBusy ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              一键安装 {selectedOption.name}
            </Button>
          </div>
        )}

        {ready && (
          <p className="text-sm text-muted-foreground">
            ✅ {selectedOption.name} 已就绪
            {status?.version ? ` · ${status.version}` : ""}
            {selected === "claude-code"
              ? " — 写代码时在「首个项目」点击「打开 Claude Code」"
              : " — 写代码时在「首个项目」点击「在编辑器中打开」"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
