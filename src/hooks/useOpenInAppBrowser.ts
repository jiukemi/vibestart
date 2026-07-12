import { useCallback } from "react";

import { useTauriCommand } from "@/hooks/useTauriCommand";
import { useLoadingStore } from "@/stores/loadingStore";

type BrowserCommand =
  | "open_builtin_browser"
  | "open_external_browser"
  | "open_github_in_app"
  | "open_gitee_in_app";

interface OpenBrowserArgs {
  url: string;
  title?: string;
}

/** @deprecated 内置浏览器已停用，保留类型兼容旧调用 */
export type OpenBrowserMode = "in_app" | "external" | "auto";

/** 向导内打开链接 — 统一走系统浏览器（WebView 在 Windows 上不稳定） */
export function useOpenInAppBrowser() {
  const command = useTauriCommand<string | void>();
  const startLoading = useLoadingStore((s) => s.start);
  const stopLoading = useLoadingStore((s) => s.stop);

  const openExternal = useCallback(
    async (url: string, loadingMessage = "正在用系统浏览器打开…") => {
      startLoading(loadingMessage);
      try {
        await command.run("open_external_browser", { url });
        return "external" as const;
      } finally {
        stopLoading();
      }
    },
    [command, startLoading, stopLoading],
  );

  const open = useCallback(
    async (
      _cmd: BrowserCommand,
      args: OpenBrowserArgs,
      loadingMessage = "正在用系统浏览器打开…",
      _mode?: OpenBrowserMode,
    ) => openExternal(args.url, loadingMessage),
    [openExternal],
  );

  const openGuide = useCallback(
    (url: string, _title?: string, _mode?: OpenBrowserMode) =>
      openExternal(url, "正在用系统浏览器打开…"),
    [openExternal],
  );

  return {
    open,
    openGuide,
    openExternal,
    loading: command.loading,
    error: command.error,
  };
}
