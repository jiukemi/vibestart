import type { Platform } from "@/lib/tauri-types";

export function isMac(platform: Platform): boolean {
  return platform === "macos";
}

export function isWindows(platform: Platform): boolean {
  return platform === "windows";
}

/** 系统文件管理器名称 */
export function fileManagerLabel(platform: Platform): string {
  return isWindows(platform) ? "资源管理器" : "Finder";
}

/** 打开设置的快捷键说明 */
export function settingsShortcut(platform: Platform): string {
  return isWindows(platform) ? "Ctrl+," : "Cmd+,";
}

/** 完全退出应用的快捷键说明 */
export function quitAppHint(platform: Platform): string {
  return isWindows(platform)
    ? "Alt+F4 或从菜单完全退出"
    : "Cmd+Q 完全退出";
}

/** 一键安装后端说明 */
export function installBackendLabel(platform: Platform): string {
  return isMac(platform) ? "Homebrew" : "winget / npm";
}

/** 用户主目录占位符（Claude Code 等说明） */
export function homeDirHint(platform: Platform): string {
  return isWindows(platform) ? "C:\\Users\\你的用户名" : "~/";
}
