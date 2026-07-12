use serde::Serialize;
use std::path::Path;
use std::process::Command;

use crate::config::ToolsInstallMode;
use crate::install_progress;
use crate::os::Platform;
use crate::tools_install::{self, ResolvedToolsPaths};
use tauri::AppHandle;

#[derive(Debug, Serialize)]
pub struct CommandResult {
    pub success: bool,
    pub log: String,
}

#[derive(Clone, Copy)]
enum ToolAction {
    Install,
    Upgrade,
    Uninstall,
}

pub fn install_tool(tool: &str, app: Option<&AppHandle>) -> CommandResult {
    install_progress::begin(app, tool);
    let result = run_for_tool(tool, ToolAction::Install, app);
    install_progress::finish(app, result.success);
    result
}

pub fn upgrade_tool(tool: &str, app: Option<&AppHandle>) -> CommandResult {
    install_progress::begin(app, tool);
    let result = run_for_tool(tool, ToolAction::Upgrade, app);
    install_progress::finish(app, result.success);
    result
}

pub fn uninstall_tool(tool: &str, app: Option<&AppHandle>) -> CommandResult {
    install_progress::emit(app, "start", &format!("开始卸载 {tool}…"), None);
    let result = run_for_tool(tool, ToolAction::Uninstall, app);
    install_progress::finish(app, result.success);
    result
}

fn run_for_tool(tool: &str, action: ToolAction, app: Option<&AppHandle>) -> CommandResult {
    let config = tools_install::tools_install_config();
    let paths = tools_install::resolve_paths(&config);
    if let Err(e) = tools_install::ensure_install_dirs(&paths) {
        return CommandResult {
            success: false,
            log: e,
        };
    }

    let platform = crate::os::detect().platform;
    let location_note = install_location_note(&paths);

    let (program, static_args): (&str, Vec<&str>) = match (tool, action, &platform) {
        ("git", ToolAction::Install, Platform::Macos) => ("brew", vec!["install", "git"]),
        ("node", ToolAction::Install, Platform::Macos) => ("brew", vec!["install", "node"]),
        ("cursor", ToolAction::Install, Platform::Macos) => {
            ("brew", vec!["install", "--cask", "cursor"])
        }
        ("trae", ToolAction::Install, Platform::Macos) => {
            ("brew", vec!["install", "--cask", "trae"])
        }
        ("windsurf", ToolAction::Install, Platform::Macos) => {
            ("brew", vec!["install", "--cask", "windsurf"])
        }
        ("git", ToolAction::Upgrade, Platform::Macos) => ("brew", vec!["upgrade", "git"]),
        ("node", ToolAction::Upgrade, Platform::Macos) => ("brew", vec!["upgrade", "node"]),
        ("cursor", ToolAction::Upgrade, Platform::Macos) => {
            ("brew", vec!["upgrade", "--cask", "cursor"])
        }
        ("trae", ToolAction::Upgrade, Platform::Macos) => {
            ("brew", vec!["upgrade", "--cask", "trae"])
        }
        ("windsurf", ToolAction::Upgrade, Platform::Macos) => {
            ("brew", vec!["upgrade", "--cask", "windsurf"])
        }
        ("git", ToolAction::Uninstall, Platform::Macos) => ("brew", vec!["uninstall", "git"]),
        ("node", ToolAction::Uninstall, Platform::Macos) => ("brew", vec!["uninstall", "node"]),
        ("cursor", ToolAction::Uninstall, Platform::Macos) => {
            ("brew", vec!["uninstall", "--cask", "cursor"])
        }
        ("trae", ToolAction::Uninstall, Platform::Macos) => {
            ("brew", vec!["uninstall", "--cask", "trae"])
        }
        ("windsurf", ToolAction::Uninstall, Platform::Macos) => {
            ("brew", vec!["uninstall", "--cask", "windsurf"])
        }
        ("git", ToolAction::Install, Platform::Windows) => (
            "winget",
            vec!["install", "-e", "--id", "Git.Git", "--accept-package-agreements"],
        ),
        ("node", ToolAction::Install, Platform::Windows) => (
            "winget",
            vec![
                "install",
                "-e",
                "--id",
                "OpenJS.NodeJS.LTS",
                "--accept-package-agreements",
            ],
        ),
        ("cursor", ToolAction::Install, Platform::Windows) => (
            "winget",
            vec![
                "install",
                "-e",
                "--id",
                "Cursor.Cursor",
                "--accept-package-agreements",
            ],
        ),
        ("trae", ToolAction::Install, Platform::Windows) => (
            "winget",
            vec![
                "install",
                "-e",
                "--id",
                "ByteDance.Trae",
                "--accept-package-agreements",
            ],
        ),
        ("windsurf", ToolAction::Install, Platform::Windows) => (
            "winget",
            vec![
                "install",
                "-e",
                "--id",
                "Codeium.Windsurf",
                "--accept-package-agreements",
            ],
        ),
        ("git", ToolAction::Upgrade, Platform::Windows) => (
            "winget",
            vec!["upgrade", "-e", "--id", "Git.Git", "--accept-package-agreements"],
        ),
        ("node", ToolAction::Upgrade, Platform::Windows) => (
            "winget",
            vec![
                "upgrade",
                "-e",
                "--id",
                "OpenJS.NodeJS.LTS",
                "--accept-package-agreements",
            ],
        ),
        ("cursor", ToolAction::Upgrade, Platform::Windows) => (
            "winget",
            vec![
                "upgrade",
                "-e",
                "--id",
                "Cursor.Cursor",
                "--accept-package-agreements",
            ],
        ),
        ("trae", ToolAction::Upgrade, Platform::Windows) => (
            "winget",
            vec![
                "upgrade",
                "-e",
                "--id",
                "ByteDance.Trae",
                "--accept-package-agreements",
            ],
        ),
        ("windsurf", ToolAction::Upgrade, Platform::Windows) => (
            "winget",
            vec![
                "upgrade",
                "-e",
                "--id",
                "Codeium.Windsurf",
                "--accept-package-agreements",
            ],
        ),
        ("git", ToolAction::Uninstall, Platform::Windows) => {
            ("winget", vec!["uninstall", "-e", "--id", "Git.Git"])
        }
        ("node", ToolAction::Uninstall, Platform::Windows) => (
            "winget",
            vec!["uninstall", "-e", "--id", "OpenJS.NodeJS.LTS"],
        ),
        ("cursor", ToolAction::Uninstall, Platform::Windows) => (
            "winget",
            vec!["uninstall", "-e", "--id", "Cursor.Cursor"],
        ),
        ("trae", ToolAction::Uninstall, Platform::Windows) => (
            "winget",
            vec!["uninstall", "-e", "--id", "ByteDance.Trae"],
        ),
        ("windsurf", ToolAction::Uninstall, Platform::Windows) => (
            "winget",
            vec!["uninstall", "-e", "--id", "Codeium.Windsurf"],
        ),
        ("claude-code", ToolAction::Install, _) => (
            "npm",
            vec!["install", "-g", "@anthropic-ai/claude-code"],
        ),
        ("claude-code", ToolAction::Upgrade, _) => (
            "npm",
            vec!["install", "-g", "@anthropic-ai/claude-code"],
        ),
        ("claude-code", ToolAction::Uninstall, _) => (
            "npm",
            vec!["uninstall", "-g", "@anthropic-ai/claude-code"],
        ),
        ("codex", ToolAction::Install, _) => {
            return crate::codex_app::install_codex_app(app);
        }
        ("codex", ToolAction::Upgrade, _) => {
            return crate::codex_app::upgrade_codex_app(app);
        }
        ("codex", ToolAction::Uninstall, _) => {
            return crate::codex_app::uninstall_codex_app(app);
        }
        ("cc-switch", ToolAction::Install, Platform::Macos) => {
            ("brew", vec!["install", "--cask", "cc-switch"])
        }
        ("cc-switch", ToolAction::Upgrade, Platform::Macos) => {
            ("brew", vec!["upgrade", "--cask", "cc-switch"])
        }
        ("cc-switch", ToolAction::Uninstall, Platform::Macos) => {
            ("brew", vec!["uninstall", "--cask", "cc-switch"])
        }
        ("cc-switch", ToolAction::Install, Platform::Windows) => (
            "winget",
            vec![
                "install",
                "-e",
                "--id",
                "farion1231.CC-Switch",
                "--accept-package-agreements",
            ],
        ),
        ("cc-switch", ToolAction::Upgrade, Platform::Windows) => (
            "winget",
            vec![
                "upgrade",
                "-e",
                "--id",
                "farion1231.CC-Switch",
                "--accept-package-agreements",
            ],
        ),
        ("cc-switch", ToolAction::Uninstall, Platform::Windows) => (
            "winget",
            vec!["uninstall", "-e", "--id", "farion1231.CC-Switch"],
        ),
        ("codex-bridge", ToolAction::Install, _) => {
            return crate::codex_bridge::install_deepseek_bridge(app);
        }
        ("codex-bridge", ToolAction::Upgrade, _) => {
            return crate::codex_bridge::install_deepseek_bridge(app);
        }
        ("codex-bridge", ToolAction::Uninstall, _) => {
            return CommandResult {
                success: false,
                log: "请手动删除 ~/.vibestart/tools/codex-bridge 目录以卸载 DeepSeek 桥。".into(),
            };
        }
        ("vercel", ToolAction::Install, _) => ("npm", vec!["install", "-g", "vercel"]),
        ("vercel", ToolAction::Upgrade, _) => ("npm", vec!["install", "-g", "vercel"]),
        ("vercel", ToolAction::Uninstall, _) => ("npm", vec!["uninstall", "-g", "vercel"]),
        ("flutter", ToolAction::Install, Platform::Macos) => {
            ("brew", vec!["install", "--cask", "flutter"])
        }
        ("flutter", ToolAction::Upgrade, Platform::Macos) => {
            ("brew", vec!["upgrade", "--cask", "flutter"])
        }
        ("flutter", ToolAction::Uninstall, Platform::Macos) => {
            ("brew", vec!["uninstall", "--cask", "flutter"])
        }
        ("flutter", ToolAction::Install, Platform::Windows) => (
            "winget",
            vec![
                "install",
                "-e",
                "--id",
                "Google.Flutter",
                "--accept-package-agreements",
            ],
        ),
        ("flutter", ToolAction::Upgrade, Platform::Windows) => (
            "winget",
            vec![
                "upgrade",
                "-e",
                "--id",
                "Google.Flutter",
                "--accept-package-agreements",
            ],
        ),
        ("flutter", ToolAction::Uninstall, Platform::Windows) => (
            "winget",
            vec!["uninstall", "-e", "--id", "Google.Flutter"],
        ),
        ("wechat-devtools", ToolAction::Install, _) => {
            return open_download_page(
                "https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html",
                "微信开发者工具",
            );
        }
        ("wechat-devtools", ToolAction::Upgrade, _) => {
            return open_download_page(
                "https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html",
                "微信开发者工具",
            );
        }
        ("wechat-devtools", ToolAction::Uninstall, _) => {
            return CommandResult {
                success: false,
                log: "请从应用程序文件夹手动卸载微信开发者工具。".into(),
            };
        }
        ("android-studio", ToolAction::Install, Platform::Macos) => (
            "brew",
            vec!["install", "--cask", "android-studio"],
        ),
        ("android-studio", ToolAction::Upgrade, Platform::Macos) => (
            "brew",
            vec!["upgrade", "--cask", "android-studio"],
        ),
        ("android-studio", ToolAction::Uninstall, Platform::Macos) => (
            "brew",
            vec!["uninstall", "--cask", "android-studio"],
        ),
        ("android-studio", ToolAction::Install, Platform::Windows) => (
            "winget",
            vec![
                "install",
                "-e",
                "--id",
                "Google.AndroidStudio",
                "--accept-package-agreements",
            ],
        ),
        ("android-studio", ToolAction::Upgrade, Platform::Windows) => (
            "winget",
            vec![
                "upgrade",
                "-e",
                "--id",
                "Google.AndroidStudio",
                "--accept-package-agreements",
            ],
        ),
        ("android-studio", ToolAction::Uninstall, Platform::Windows) => (
            "winget",
            vec!["uninstall", "-e", "--id", "Google.AndroidStudio"],
        ),
        ("xcode", ToolAction::Install, Platform::Macos) => {
            return open_download_page(
                "macappstore://apps.apple.com/app/xcode/id497799835",
                "Xcode（App Store）",
            );
        }
        ("xcode", ToolAction::Upgrade, Platform::Macos) => {
            return open_download_page(
                "macappstore://apps.apple.com/app/xcode/id497799835",
                "Xcode（App Store）",
            );
        }
        ("xcode", ToolAction::Uninstall, _) => {
            return CommandResult {
                success: false,
                log: "请从 App Store / 应用程序文件夹手动管理 Xcode。".into(),
            };
        }
        ("tongyi-lingma", ToolAction::Install, _) => {
            return open_download_page(
                "https://lingma.aliyun.com/download",
                "通义灵码 Lingma IDE",
            );
        }
        ("tongyi-lingma", ToolAction::Upgrade, _) => {
            return open_download_page(
                "https://lingma.aliyun.com/download",
                "通义灵码 Lingma IDE",
            );
        }
        ("tongyi-lingma", ToolAction::Uninstall, _) => {
            let log = if cfg!(target_os = "windows") {
                "通义灵码请从「设置 → 应用 → 已安装的应用」中卸载 Lingma。\n\
                 常见路径：%LOCALAPPDATA%\\Programs\\Lingma"
            } else {
                "通义灵码请从「应用程序」文件夹手动拖到废纸篓卸载。\n\
                 macOS: /Applications/Lingma.app 或 通义灵码.app"
            };
            return CommandResult {
                success: false,
                log: log.into(),
            };
        }
        _ => {
            return CommandResult {
                success: false,
                log: format!("暂不支持在此系统执行该操作: {tool}"),
            };
        }
    };

    let mut args: Vec<String> = static_args.iter().map(|s| s.to_string()).collect();
    if program == "npm" {
        apply_npm_prefix(&mut args, &paths);
    } else {
        apply_custom_install_location(tool, action, &mut args, &paths);
    }

    let mut result = run_command_with_paths(app, program, &args, &paths, &location_note);
    if program == "npm" && matches!(action, ToolAction::Install | ToolAction::Upgrade) {
        if let Some(cli) = npm_cli_for_tool(tool) {
            result = verify_npm_cli_install(cli, &paths, result);
        }
    }
    result
}

fn install_location_note(paths: &ResolvedToolsPaths) -> String {
    match paths.mode {
        ToolsInstallMode::Recommended => format!(
            "【安装位置 · 推荐】\nnpm CLI → {}\nGUI 编辑器 → 系统默认位置",
            paths.npm_prefix.display()
        ),
        ToolsInstallMode::Custom => format!(
            "【安装位置 · 自定义】\nnpm CLI → {}\nGUI 编辑器 → {}",
            paths.npm_prefix.display(),
            paths.gui_apps_dir.display()
        ),
    }
}

fn apply_npm_prefix(args: &mut Vec<String>, paths: &ResolvedToolsPaths) {
    if args.is_empty() {
        return;
    }
    let cmd = args[0].as_str();
    if cmd != "install" && cmd != "uninstall" {
        return;
    }
    // Keep `-g`: `npm install --prefix DIR -g PKG` links binaries into DIR/bin.
    // Without `-g`, npm only adds a local dependency and leaves bin/ empty.
    let prefix = paths.npm_prefix.to_string_lossy().into_owned();
    args.insert(1, prefix);
    args.insert(1, "--prefix".into());
}

fn npm_cli_for_tool(tool: &str) -> Option<&'static str> {
    match tool {
        "claude-code" => Some("claude"),
        "vercel" => Some("vercel"),
        _ => None,
    }
}

fn verify_npm_cli_install(
    cli: &str,
    paths: &ResolvedToolsPaths,
    mut result: CommandResult,
) -> CommandResult {
    if !result.success {
        return result;
    }

    let Some(path) = tools_install::resolve_cli_command(cli) else {
        result.success = false;
        result.log.push_str(&format!(
            "\n\n安装未完成：未在 {} 找到 {cli} 可执行文件。\n\
             请确认 Node.js / npm 可用后重试。",
            tools_install::npm_bin_dir(&paths.npm_prefix).display()
        ));
        return result;
    };

    match Command::new(&path).arg("--version").output() {
        Ok(out) if out.status.success() => {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            result.log.push_str(&format!(
                "\n\n✓ {cli} 已就绪\n  路径: {}\n  版本: {version}\n",
                path.display()
            ));
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            result.success = false;
            result.log.push_str(&format!(
                "\n\n已安装但无法运行 {cli}（{}）: {err}\n",
                path.display()
            ));
        }
        Err(e) => {
            result.success = false;
            result.log.push_str(&format!("\n\n已安装但无法运行 {cli}: {e}\n"));
        }
    }

    result
}

fn apply_custom_install_location(
    tool: &str,
    action: ToolAction,
    args: &mut Vec<String>,
    paths: &ResolvedToolsPaths,
) {
    if paths.system_gui_install || !matches!(action, ToolAction::Install) {
        return;
    }

    let gui_tools = [
        "cursor", "trae", "windsurf", "flutter", "android-studio", "tongyi-lingma",
    ];
    if !gui_tools.contains(&tool) {
        return;
    }

    if cfg!(target_os = "macos")
        && args.first().map(String::as_str) == Some("install")
        && args.iter().any(|a| a == "--cask")
    {
        args.push("--appdir".into());
        args.push(paths.gui_apps_dir.to_string_lossy().into_owned());
        return;
    }

    if cfg!(target_os = "windows") && args.first().map(String::as_str) == Some("install") {
        if let Some(folder) = winget_location_folder(tool) {
            let loc = paths.gui_apps_dir.join(folder);
            let _ = std::fs::create_dir_all(&loc);
            args.push("--location".into());
            args.push(loc.to_string_lossy().into_owned());
        }
    }
}

fn winget_location_folder(tool: &str) -> Option<&'static str> {
    match tool {
        "cursor" => Some("Cursor"),
        "trae" => Some("Trae"),
        "windsurf" => Some("Windsurf"),
        "flutter" => Some("Flutter"),
        "android-studio" => Some("Android Studio"),
        _ => None,
    }
}

fn prepend_path(cmd: &mut Command, extra: &Path) {
    let extra = extra.to_string_lossy();
    if cfg!(target_os = "windows") {
        if let Ok(path) = std::env::var("PATH") {
            cmd.env("PATH", format!("{extra};{path}"));
        } else {
            cmd.env("PATH", extra.as_ref());
        }
    } else if let Ok(path) = std::env::var("PATH") {
        cmd.env("PATH", format!("{extra}:{path}"));
    } else {
        cmd.env("PATH", extra.as_ref());
    }
}

fn run_command_with_paths(
    app: Option<&AppHandle>,
    program: &str,
    args: &[String],
    paths: &ResolvedToolsPaths,
    location_note: &str,
) -> CommandResult {
    install_progress::emit(
        app,
        "run",
        &format!("正在执行 {program}…"),
        Some(15),
    );
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();

    let mut cmd = if program == "npm" {
        match tools_install::resolve_system_npm() {
            Some(p) => tools_install::new_npm_command(&p),
            None => {
                let hint = "未找到 npm。请先安装 Node.js（向导内一键安装或 winget install OpenJS.NodeJS.LTS），\
                     安装完成后点击「重新检测」；若已安装仍报错，请重启 VibeStart 或查看右侧故障排查「npm 未找到」。";
                return CommandResult {
                    success: false,
                    log: format!("{location_note}\n\n{hint}"),
                };
            }
        }
    } else {
        Command::new(program)
    };
    cmd.args(&arg_refs);
    if program == "npm" {
        tools_install::apply_npm_runtime_env(&mut cmd);
    }

    match cmd.output() {
        Ok(output) => {
            let body = format!(
                "$ {program} {}\n\n{}{}",
                arg_refs.join(" "),
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            let log = if location_note.is_empty() {
                body
            } else {
                format!("{location_note}\n\n{body}")
            };
            CommandResult {
                success: output.status.success(),
                log,
            }
        }
        Err(error) => {
            let detail = if program == "npm" {
                format!(
                    "无法执行 npm: {error}\n\n\
                     若提示「不是有效的 Win32 应用程序 (193)」，多为误选了无扩展名的 npm 脚本；\
                     请重启 VibeStart 后重试，或见故障排查「npm 未找到」。"
                )
            } else {
                format!("无法执行 {program}: {error}")
            };
            CommandResult {
                success: false,
                log: format!("{location_note}\n\n{detail}"),
            }
        }
    }
}

fn open_download_page(url: &str, name: &str) -> CommandResult {
    let opened = if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(url)
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    } else if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", "", url])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    } else {
        Command::new("xdg-open")
            .arg(url)
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    };

    if opened {
        CommandResult {
            success: true,
            log: format!(
                "已在浏览器打开 {name} 官方下载页：\n{url}\n\n请完成下载安装后，点击「重新检测编辑器」。"
            ),
        }
    } else {
        CommandResult {
            success: false,
            log: format!("无法打开浏览器，请手动访问：{url}"),
        }
    }
}

pub fn run_command(program: &str, args: &[&str]) -> CommandResult {
    match Command::new(program).args(args).output() {
        Ok(output) => {
            let log = format!(
                "$ {program} {}\n\n{}{}",
                args.join(" "),
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            CommandResult {
                success: output.status.success(),
                log,
            }
        }
        Err(error) => CommandResult {
            success: false,
            log: format!("无法执行 {program}: {error}"),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ToolsInstallConfig;

    #[test]
    fn npm_prefix_keeps_global_flag_for_bin_links() {
        let paths = tools_install::resolve_paths(&ToolsInstallConfig::default());
        let mut args = vec![
            "install".into(),
            "-g".into(),
            "@openai/codex".into(),
        ];
        apply_npm_prefix(&mut args, &paths);
        assert_eq!(
            args,
            vec![
                "install",
                "--prefix",
                paths.npm_prefix.to_string_lossy().as_ref(),
                "-g",
                "@openai/codex",
            ]
        );
    }
}
