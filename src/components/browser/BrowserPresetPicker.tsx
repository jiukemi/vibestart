import { useCallback, useEffect, useState } from "react";
import { AppWindow, Check, ChevronDown, ChevronUp, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTauriCommand } from "@/hooks/useTauriCommand";
import type { BrowserConfig, BrowserPreset } from "@/lib/tauri-types";
import { selectableCardClasses } from "@/lib/selectable-card";
import { cn } from "@/lib/utils";

const PRESETS: {
  id: BrowserPreset;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
}[] = [
  {
    id: "google_chrome",
    title: "Google Chrome",
    description: "OAuth、GitHub 登录等必须外开时使用（推荐）。",
    icon: Globe,
    recommended: true,
  },
  {
    id: "system_default",
    title: "系统默认浏览器",
    description: "未安装 Chrome 或希望跟随系统默认时使用。",
    icon: AppWindow,
  },
];

interface BrowserPresetPickerProps {
  className?: string;
  /** 向导内嵌：默认折叠 */
  compact?: boolean;
  defaultCollapsed?: boolean;
}

export function BrowserPresetPicker({
  className,
  compact = false,
  defaultCollapsed,
}: BrowserPresetPickerProps) {
  const [preset, setPreset] = useState<BrowserPreset>("google_chrome");
  const [savedPreset, setSavedPreset] = useState<BrowserPreset | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(
    () => defaultCollapsed !== true && !compact,
  );

  const { run: loadConfig } = useTauriCommand<BrowserConfig>();
  const { run: saveConfig, loading: saving } = useTauriCommand<void>();

  const refresh = useCallback(async () => {
    try {
      const result = await loadConfig("get_browser_config");
      if (result?.preset) {
        setPreset(result.preset);
        setSavedPreset(result.preset);
      }
    } catch {
      /* 非 Tauri 环境忽略 */
    }
  }, [loadConfig]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (compact && defaultCollapsed === undefined) {
      setExpanded(false);
    }
  }, [compact, defaultCollapsed]);

  const selectPreset = (next: BrowserPreset) => {
    if (next === preset && next === savedPreset) {
      return;
    }
    setPreset(next);
    setSaveError(null);
    void saveConfig("save_browser_config", { preset: next })
      .then(() => {
        setSavedPreset(next);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setSaveError(message);
      });
  };

  const currentLabel =
    PRESETS.find((p) => p.id === preset)?.title ?? "Google Chrome";

  const body = (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground dark:bg-muted/10">
        <p>
          向导中的链接（Gitee、DeepSeek、Cursor 注册等）均用<strong className="font-medium text-foreground">系统浏览器</strong>
          打开。在此选择 Chrome 或系统默认浏览器。
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PRESETS.map(({ id, title, description, icon: Icon, recommended }) => {
          const isSelected = preset === id;
          const isSaved = savedPreset === id && isSelected;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectPreset(id)}
              className={cn(
                "flex flex-col gap-2 rounded-xl p-3 text-left transition-colors",
                selectableCardClasses(isSelected),
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="size-4 shrink-0 text-primary" />
                {title}
                {recommended && (
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    推荐
                  </span>
                )}
                {isSaved && !saving && (
                  <Check className="ml-auto size-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
              </span>
              <span className="text-xs text-muted-foreground">{description}</span>
            </button>
          );
        })}
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground">正在保存…</p>
      )}
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      {!compact && (
        <p className="text-xs text-muted-foreground">
          若未安装 Chrome，外开时会自动回退到系统默认浏览器。
        </p>
      )}
    </div>
  );

  if (compact && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 dark:bg-muted/10",
          className,
        )}
      >
        <span className="text-muted-foreground">
          外开浏览器：<span className="font-medium text-foreground">{currentLabel}</span>
          <span className="ml-2 text-xs">（OAuth 等受限页用 · 可选）</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <Card size={compact ? "sm" : undefined} className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">系统浏览器偏好</CardTitle>
            <CardDescription>
              向导内链接均用系统浏览器打开；在此选择 Chrome 或系统默认。
            </CardDescription>
          </div>
          {compact && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setExpanded(false)}
              aria-label="收起"
            >
              <ChevronUp className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
