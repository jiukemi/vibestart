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

/** auto = 后端按 URL 决定（默认应用内，OAuth 等外开） */
export type OpenBrowserMode = "in_app" | "external" | "auto";

export function useOpenInAppBrowser() {
  const command = useTauriCommand<string | void>();
  const startLoading = useLoadingStore((s) => s.start);
  const stopLoading = useLoadingStore((s) => s.stop);

  const open = useCallback(
    async (
      cmd: BrowserCommand,
      args: OpenBrowserArgs,
      loadingMessage = "正在打开页面…",
      mode: OpenBrowserMode = "auto",
    ) => {
      startLoading(loadingMessage);
      try {
        if (mode === "external" || cmd === "open_external_browser") {
          await command.run("open_external_browser", { url: args.url });
          return "external" as const;
        }

        if (cmd === "open_builtin_browser") {
          const result = await command.run("open_builtin_browser", {
            url: args.url,
            title: args.title ?? "VibeStart",
            forceInApp: mode === "in_app" ? true : undefined,
          });
          return result === "external" ? ("external" as const) : ("in_app" as const);
        }

        if (cmd === "open_gitee_in_app") {
          await command.run("open_gitee_in_app", { url: args.url });
          return "in_app" as const;
        }

        if (cmd === "open_github_in_app") {
          const result = await command.run("open_github_in_app", { url: args.url });
          return result === "external" ? ("external" as const) : ("in_app" as const);
        }

        await command.run("open_external_browser", { url: args.url });
        return "external" as const;
      } finally {
        stopLoading();
      }
    },
    [command, startLoading, stopLoading],
  );

  /** 向导步骤默认：应用内打开，登录态可保留 */
  const openGuide = useCallback(
    (url: string, title: string, mode: OpenBrowserMode = "auto") =>
      open("open_builtin_browser", { url, title }, "正在打开…", mode),
    [open],
  );

  return {
    open,
    openGuide,
    loading: command.loading,
    error: command.error,
  };
}
