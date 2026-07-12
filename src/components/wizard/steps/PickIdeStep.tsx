import { Download, RefreshCw, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IdeRegisterGuidePanel } from "@/components/ide/IdeRegisterGuidePanel";
import { CodexBridgePanel } from "@/components/codex/CodexBridgePanel";
import { ToolsInstallDirPicker } from "@/components/tools/ToolsInstallDirPicker";
import { InstallProgressPanel } from "@/components/shared/InstallProgressPanel";
import { LoadingOverlay, VibeStartLoading } from "@/components/shared/VibeStartLoading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StepShell } from "@/components/wizard/StepShell";
import { useOsInfo } from "@/hooks/useOsInfo";
import { installBackendLabel } from "@/lib/platform-ui";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import { useInstallProgress } from "@/hooks/useInstallProgress";
import { getIdeOption, getIdeScanKey, IDE_OPTIONS } from "@/lib/ide";
import { getStepMeta } from "@/lib/wizard-index";
import type { CommandResult, ToolStatus } from "@/lib/tauri-types";
import { useLoadingStore } from "@/stores/loadingStore";
import { useWizardStore } from "@/stores/wizardStore";
import {
  selectableCardClasses,
  selectableGridButtonClassName,
} from "@/lib/selectable-card";

const step = getStepMeta("pick-ide");

export function PickIdeStep() {
  const { platform } = useOsInfo();
  const primaryIde = useWizardStore((s) => s.selections.primaryIde);
  const setSelection = useWizardStore((s) => s.setSelection);
  const selected = primaryIde ?? "cursor";
  const selectedOption = getIdeOption(selected);
  const startLoading = useLoadingStore((s) => s.start);
  const stopLoading = useLoadingStore((s) => s.stop);

  const {
    run: runScan,
    loading: scanLoading,
    data: scanData,
  } = useTauriCommand<ToolStatus[]>();
  const { run: runTool, loading: toolLoading, error: toolError } =
    useTauriCommand<CommandResult>();
  const [installLog, setInstallLog] = useState<string | null>(null);
  const { progress, streamLog } = useInstallProgress(toolLoading);
  const mergedInstallLog = [streamLog, installLog].filter(Boolean).join("\n\n");
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [initialScanDone, setInitialScanDone] = useState(false);

  const rescan = useCallback(async () => {
    startLoading("正在检测已安装的编辑器…");
    try {
      await runScan("scan_environment");
    } finally {
      stopLoading();
    }
  }, [runScan, startLoading, stopLoading]);

  useEffect(() => {
    void (async () => {
      startLoading("正在检测已安装的编辑器…");
      try {
        await runScan("scan_environment");
      } finally {
        setInitialScanDone(true);
        stopLoading();
      }
    })();
  }, [runScan, startLoading, stopLoading]);

  const toolMap = useMemo(
    () => new Map(scanData?.map((tool) => [tool.name, tool]) ?? []),
    [scanData],
  );

  const scanKey = getIdeScanKey(selected);
  const selectedStatus = scanKey ? toolMap.get(scanKey) : undefined;

  const runToolAction = useCallback(
    async (command: "install_tool" | "upgrade_tool" | "uninstall_tool") => {
      const tool = selectedOption.installTool;
      if (!tool) return;
      setInstallLog(null);
      const labels = {
        install_tool: `正在安装 ${selectedOption.name}…`,
        upgrade_tool: `正在检查更新 ${selectedOption.name}…`,
        uninstall_tool: `正在卸载 ${selectedOption.name}…`,
      };
      startLoading(labels[command]);
      try {
        const result = await runTool(command, { tool });
        if (result) setInstallLog(result.log);
        await rescan();
      } finally {
        stopLoading();
      }
    },
    [rescan, runTool, selectedOption, startLoading, stopLoading],
  );

  const installSelectedIde = () => void runToolAction("install_tool");
  const upgradeSelectedIde = () => void runToolAction("upgrade_tool");
  const uninstallSelectedIde = () => {
    setConfirmUninstall(false);
    void runToolAction("uninstall_tool");
  };

  const canProceed = Boolean(
    selectedStatus?.installed && selectedStatus.meets_minimum,
  );
  const isBusy = scanLoading || toolLoading;
  const showInitialLoading = !initialScanDone && !scanData;
  const isCodex = selected === "codex";
  const showIdeInstallCard = !canProceed && initialScanDone && !isCodex;

  return (
    <StepShell
      title={step.title}
      description="默认推荐 Cursor，也可选 Trae、Windsurf、Claude Code、Codex 或通义灵码。"
      nextDisabled={!canProceed || isBusy}
    >
      <ToolsInstallDirPicker onSaved={() => void rescan()} />

      <div className="relative">
        <LoadingOverlay
          visible={isBusy && !showInitialLoading}
          message={
            toolLoading
              ? `正在处理 ${selectedOption.name}…`
              : "正在检测编辑器…"
          }
        />

        {showInitialLoading ? (
          <VibeStartLoading message="正在扫描本机已安装的 AI 编辑器…" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IDE_OPTIONS.map((ide) => {
              const isSelected = selected === ide.id;
              const status = toolMap.get(ide.scanKey);

              return (
                <button
                  key={ide.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setSelection("primaryIde", ide.id)}
                  className={selectableGridButtonClassName(
                    "cursor-pointer disabled:opacity-60",
                  )}
                >
                  <Card
                    size="sm"
                    className={selectableCardClasses(isSelected)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {ide.name}
                        {"default" in ide && ide.default && (
                          <span className="text-xs font-normal text-muted-foreground">
                            默认
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {ide.description}
                      </CardDescription>
                      <p className="text-xs">
                        {status?.installed ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ✅ 已安装
                            {status.version ? ` · ${status.version}` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">未安装</span>
                        )}
                      </p>
                    </CardHeader>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showIdeInstallCard && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">
              安装 {selectedOption.name}
            </CardTitle>
            <CardDescription>
              {selectedOption.id === "tongyi-lingma"
                ? "将打开官方下载页，安装完成后点「重新检测」。"
                : "无需打开终端，在应用内一键安装。"}
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <Button
              type="button"
              onClick={installSelectedIde}
              disabled={isBusy}
            >
              {toolLoading ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {toolLoading
                ? "处理中…"
                : selectedOption.id === "tongyi-lingma"
                  ? "打开下载页"
                  : `一键安装 ${selectedOption.name}`}
            </Button>
          </div>
        </Card>
      )}

      {canProceed && initialScanDone && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">管理 {selectedOption.name}</CardTitle>
            <CardDescription>
              已安装
              {selectedStatus?.version ? ` · ${selectedStatus.version}` : ""}
              。可通过 {installBackendLabel(platform)} 检查更新或卸载。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={upgradeSelectedIde}
            >
              <Upload className="size-4" />
              检查更新
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => setConfirmUninstall(true)}
            >
              <Trash2 className="size-4" />
              卸载
            </Button>
          </CardContent>
        </Card>
      )}

      {(toolLoading || mergedInstallLog || toolError) && (
        <InstallProgressPanel
          loading={toolLoading}
          progress={progress}
          log={mergedInstallLog || toolError}
        />
      )}

      {initialScanDone && !isCodex && (
        <IdeRegisterGuidePanel ideId={selected} beforeLlmStep />
      )}

      {isCodex && initialScanDone && (
        <CodexBridgePanel
          llmProvider={null}
          phase="pick-ide"
          toolMap={toolMap}
          onRescan={rescan}
        />
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void rescan()}
        disabled={isBusy}
      >
        {scanLoading ? "检测中…" : "重新检测编辑器"}
      </Button>

      <Dialog open={confirmUninstall} onOpenChange={setConfirmUninstall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认卸载 {selectedOption.name}？</DialogTitle>
            <DialogDescription>
              将通过系统包管理器卸载。你的项目文件不会删除；卸载后需重新安装才能继续向导。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmUninstall(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={uninstallSelectedIde}
            >
              确认卸载
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StepShell>
  );
}
