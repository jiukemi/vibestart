import { useCallback, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LayoutDashboard,
  PartyPopper,
  RotateCcw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepShell } from "@/components/wizard/StepShell";
import { getBackendProvider, supportsBackendAssist } from "@/lib/backend-assist";
import { getIdeOption } from "@/lib/ide";
import { getPackMeta } from "@/lib/packs";
import { getStepMeta } from "@/lib/wizard-index";
import { useWizardStore } from "@/stores/wizardStore";

const step = getStepMeta("complete");

export function CompleteStep() {
  const selections = useWizardStore((s) => s.selections);
  const enterHome = useWizardStore((s) => s.enterHome);
  const resetForNewProject = useWizardStore((s) => s.resetForNewProject);
  const [copied, setCopied] = useState(false);

  const { deployUrl, packId, projectDir, primaryIde, buildGoal, backendAssistEnabled, backendProviderId } = selections;
  const packMeta = packId ? getPackMeta(packId) : null;
  const backendProvider = getBackendProvider(backendProviderId);
  const ide = getIdeOption(primaryIde ?? "cursor");

  const copyUrl = useCallback(async () => {
    if (!deployUrl) return;
    await navigator.clipboard.writeText(deployUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [deployUrl]);

  return (
    <StepShell title={step.title} description={step.description} hideNext>
      <div className="space-y-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <PartyPopper className="size-6 text-primary" />
              恭喜，你完成了 0→1 Vibe Coding！
            </CardTitle>
            <CardDescription>
              从选模板、写代码到部署上线 —— 你已经走通完整流程。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {packMeta && (
                <div>
                  <dt className="text-muted-foreground">项目模板</dt>
                  <dd className="font-medium text-foreground">{packMeta.title}</dd>
                </div>
              )}
              {projectDir && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">项目位置</dt>
                  <dd className="break-all font-medium text-foreground">
                    {projectDir}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">主编辑器</dt>
                <dd className="font-medium text-foreground">{ide.name}</dd>
              </div>
              {supportsBackendAssist(buildGoal) && backendAssistEnabled && backendProvider && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">进阶后端</dt>
                  <dd className="font-medium text-foreground">
                    {backendProvider.name} — 在工作台继续跟着接入步骤完成云端能力
                  </dd>
                </div>
              )}
            </dl>

            {deployUrl ? (
              <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-start">
                <div className="flex-1 space-y-3">
                  <p className="text-sm font-medium text-foreground">你的网站地址</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={deployUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all text-sm text-primary underline-offset-4 hover:underline"
                    >
                      {deployUrl}
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void copyUrl()}
                    >
                      {copied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copied ? "已复制" : "复制链接"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    分享给朋友，让他们看看你的第一个作品吧！
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <QRCodeSVG value={deployUrl} size={120} />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    扫码访问
                  </p>
                </div>
              </div>
            ) : (
              <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                未记录部署地址。你可以从左侧导航回到「部署上线」步骤，或进入工作台后再部署。
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" size="lg" onClick={enterHome}>
            <LayoutDashboard className="size-4" />
            进入工作台
          </Button>
          <Button type="button" variant="outline" onClick={resetForNewProject}>
            <RotateCcw className="size-4" />
            再做一次（重新选模板）
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          工作台可快速打开项目、启动编辑器、重新部署，并随时回到向导调整配置。
        </p>
      </div>
    </StepShell>
  );
}
