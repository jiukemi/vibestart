use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

/// Resolve pack scaffold directory.
///
/// Lookup order:
/// 1. Bundled resources (`content/packs/{pack_id}/scaffold`) via `tauri.conf.json` bundle.resources
/// 2. `VIBESTART_PACKS_DIR` env var (dev override)
/// 3. `../src/content/packs/{pack_id}/scaffold` relative to cwd (local dev from repo root)
pub fn resolve_pack_scaffold(app: &AppHandle, pack_id: &str) -> Result<PathBuf, String> {
    let resource_path = format!("content/packs/{pack_id}/scaffold");
    if let Ok(path) = app
        .path()
        .resolve(&resource_path, BaseDirectory::Resource)
    {
        if path.exists() {
            return Ok(path);
        }
    }

    if let Ok(dev_root) = std::env::var("VIBESTART_PACKS_DIR") {
        let path = PathBuf::from(dev_root)
            .join(pack_id)
            .join("scaffold");
        if path.exists() {
            return Ok(path);
        }
    }

    let dev_path = PathBuf::from("../src/content/packs")
        .join(pack_id)
        .join("scaffold");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!("Pack scaffold not found for pack_id: {pack_id}"))
}

pub fn init_project(app: &AppHandle, pack_id: &str, target_dir: &str) -> Result<InitProjectResult, String> {
    let scaffold = resolve_pack_scaffold(app, pack_id)?;
    let target = PathBuf::from(target_dir);

    if !target.exists() {
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    }

    let (files_added, files_skipped) = copy_dir_merge(&scaffold, &target)?;

    let message = if files_added.is_empty() && !files_skipped.is_empty() {
        "模板文件已存在，未覆盖你的已有文件".into()
    } else if files_skipped.is_empty() {
        format!("已初始化 {} 个模板文件", files_added.len())
    } else {
        format!(
            "新增 {} 个文件，跳过 {} 个已存在文件（不覆盖）",
            files_added.len(),
            files_skipped.len()
        )
    };

    Ok(InitProjectResult {
        message,
        files_added,
        files_skipped,
    })
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct InitProjectResult {
    pub message: String,
    pub files_added: Vec<String>,
    pub files_skipped: Vec<String>,
}

pub fn home_directory() -> String {
    dirs::home_dir()
        .map(|h| h.to_string_lossy().into_owned())
        .unwrap_or_else(|| "~".into())
}

pub fn default_project_dir() -> String {
    dirs::home_dir()
        .map(|home| home.join("Projects").join("my-first-vibe-project"))
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| "~/Projects/my-first-vibe-project".into())
}

pub fn default_projects_parent() -> String {
    dirs::home_dir()
        .map(|home| {
            let projects = home.join("Projects");
            let _ = fs::create_dir_all(&projects);
            projects.to_string_lossy().into_owned()
        })
        .unwrap_or_else(|| "~/Projects".into())
}

fn sanitize_folder_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("文件夹名称不能为空".into());
    }
    if trimmed.contains(['/', '\\']) || trimmed.contains("..") {
        return Err("文件夹名称不能包含 / 或 ..".into());
    }
    Ok(trimmed.to_string())
}

pub fn create_project_directory(
    parent_dir: Option<&str>,
    folder_name: &str,
) -> Result<String, String> {
    let name = sanitize_folder_name(folder_name)?;
    let parent = parent_dir
        .map(PathBuf::from)
        .filter(|p| !p.as_os_str().is_empty())
        .or_else(|| dirs::home_dir().map(|h| h.join("Projects")))
        .ok_or_else(|| "无法确定父目录".to_string())?;

    fs::create_dir_all(&parent).map_err(|e| e.to_string())?;
    let target = parent.join(&name);

    if !target.exists() {
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    }

    target
        .canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[derive(Debug, serde::Serialize)]
pub struct ProjectDirStatus {
    pub path: String,
    pub exists: bool,
    pub is_empty: bool,
    pub has_index_html: bool,
}

pub fn project_dir_status(dir: &str) -> ProjectDirStatus {
    let path = PathBuf::from(dir);
    let exists = path.is_dir();
    let mut is_empty = true;
    let mut has_index_html = false;

    if exists {
        if let Ok(entries) = fs::read_dir(&path) {
            for entry in entries.flatten() {
                is_empty = false;
                if entry.file_name() == "index.html" {
                    has_index_html = true;
                }
            }
        }
    }

    ProjectDirStatus {
        path: dir.to_string(),
        exists,
        is_empty,
        has_index_html,
    }
}

pub fn reveal_project_dir(dir: &str) -> Result<(), String> {
    let path = PathBuf::from(dir);
    if !path.exists() {
        return Err(format!("目录不存在: {dir}"));
    }

    if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(dir)
            .status()
            .map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(dir)
            .status()
            .map_err(|e| e.to_string())?;
    } else {
        Command::new("xdg-open")
            .arg(dir)
            .status()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LaunchMode {
    New,
    Focus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdeLaunchState {
    pub running: bool,
    pub ide_name: String,
    pub is_cli: bool,
    pub hint: String,
}

pub fn get_ide_launch_state(ide: &str) -> IdeLaunchState {
    let (ide_name, is_cli, app_name, cli_command) = ide_launch_meta(ide);
    let running = if is_cli {
        cli_command.map(cli_process_running).unwrap_or(false)
    } else {
        app_name.map(gui_app_running).unwrap_or(false)
    };

    let hint = if running {
        if is_cli {
            format!("检测到 {ide_name} 可能已在终端中运行。你可以切换到现有窗口，或新开一个。")
        } else {
            format!("检测到 {ide_name} 已在运行。你可以切换到现有窗口，或新开一个。")
        }
    } else {
        String::new()
    };

    IdeLaunchState {
        running,
        ide_name: ide_name.to_string(),
        is_cli,
        hint,
    }
}

fn ide_launch_meta(ide: &str) -> (&'static str, bool, Option<&'static str>, Option<&'static str>) {
    match ide {
        "cursor" => ("Cursor", false, Some("Cursor"), None),
        "trae" => ("Trae", false, Some("Trae"), None),
        "windsurf" => ("Windsurf", false, Some("Windsurf"), None),
        "tongyi-lingma" => ("通义灵码", false, Some("Lingma"), None),
        "claude-code" => ("Claude Code", true, None, Some("claude")),
        "codex" => ("Codex", false, Some("Codex"), None),
        _ => ("Cursor", false, Some("Cursor"), None),
    }
}

pub fn launch_ide(ide: &str, project_dir: Option<&str>, mode: LaunchMode) -> Result<(), String> {
    if mode == LaunchMode::Focus {
        return focus_ide(ide, project_dir);
    }
    launch_ide_new(ide, project_dir)
}

fn launch_ide_new(ide: &str, project_dir: Option<&str>) -> Result<(), String> {
    match ide {
        "cursor" => launch_gui_app_new_instance("Cursor", "cursor"),
        "trae" => launch_gui_app_new_instance("Trae", "trae"),
        "windsurf" => launch_gui_app_new_instance("Windsurf", "windsurf"),
        "tongyi-lingma" => launch_gui_app_new_instance("Lingma", "lingma"),
        "claude-code" => {
            if which_available("claude") {
                let dir = resolve_cli_project_dir(project_dir);
                crate::claude_code::prepare_claude_code_launch(&dir)?;
                launch_interactive_cli("claude", &dir)
            } else {
                Err("未检测到 Claude Code".into())
            }
        }
        "codex" => {
            let dir = resolve_cli_project_dir(project_dir);
            crate::codex_app::launch_codex_app(Some(&dir))
        }
        _ => launch_gui_app_new_instance("Cursor", "cursor"),
    }
}

fn focus_ide(ide: &str, project_dir: Option<&str>) -> Result<(), String> {
    let (ide_name, is_cli, app_name, _) = ide_launch_meta(ide);
    if is_cli {
        focus_cli_terminal(ide_name)?;
        return Ok(());
    }
    if let Some(app) = app_name {
        return launch_gui_app(app, ide_name);
    }
    let _ = project_dir;
    Err(format!("无法切换到 {ide_name}"))
}

fn gui_app_running(app_name: &str) -> bool {
    if cfg!(target_os = "macos") {
        let script = format!(
            "tell application \"System Events\" to (name of processes) contains \"{app_name}\""
        );
        return Command::new("osascript")
            .args(["-e", &script])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true")
            .unwrap_or(false);
    }

    if cfg!(target_os = "windows") {
        return Command::new("tasklist")
            .output()
            .ok()
            .map(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .to_ascii_lowercase()
                    .contains(&app_name.to_ascii_lowercase())
            })
            .unwrap_or(false);
    }

    Command::new("pgrep")
        .arg("-i")
        .arg(app_name)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn cli_process_running(command: &str) -> bool {
    if Command::new("pgrep")
        .arg("-x")
        .arg(command)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
    {
        return true;
    }

    Command::new("pgrep")
        .args(["-fl", command])
        .output()
        .ok()
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false)
}

fn focus_cli_terminal(ide_name: &str) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        let mut focused = false;
        for app in ["iTerm2", "iTerm", "Terminal", "Warp"] {
            if gui_app_running(app) {
                let script = format!("tell application \"{app}\" to activate");
                if Command::new("osascript")
                    .args(["-e", &script])
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false)
                {
                    focused = true;
                }
            }
        }
        if focused {
            return Ok(());
        }
        return Err(format!(
            "未找到正在运行的终端窗口。请手动切换到已打开的 {ide_name}，或选择「新开一个窗口」。"
        ));
    }

    if cfg!(target_os = "windows") {
        return Command::new("cmd")
            .args(["/C", "start", ""])
            .status()
            .map(|_| ())
            .map_err(|e| e.to_string());
    }

    Command::new("xdotool")
        .args(["search", "--class", "terminal", "windowactivate"])
        .status()
        .map(|_| ())
        .map_err(|_| format!("请手动切换到已打开的 {ide_name} 终端窗口"))
}

fn resolve_cli_project_dir(project_dir: Option<&str>) -> String {
    project_dir
        .map(str::trim)
        .filter(|d| !d.is_empty())
        .map(str::to_string)
        .unwrap_or_else(default_project_dir)
}

fn launch_gui_app(app_name: &str, cli_name: &str) -> Result<(), String> {
    launch_gui_app_impl(app_name, cli_name, false)
}

fn launch_gui_app_new_instance(app_name: &str, cli_name: &str) -> Result<(), String> {
    launch_gui_app_impl(app_name, cli_name, true)
}

fn launch_gui_app_impl(app_name: &str, cli_name: &str, new_instance: bool) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        let args: Vec<&str> = if new_instance {
            vec!["-n", "-a", app_name]
        } else {
            vec!["-a", app_name]
        };
        if Command::new("open")
            .args(args)
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Ok(());
        }
    }

    if cfg!(target_os = "windows") {
        if let Some(exe) = crate::env_scan::windows_gui_exe(app_name, cli_name) {
            return Command::new(&exe)
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("无法启动 {app_name}: {e}"));
        }
    }

    if which_available(cli_name) {
        let mut cmd = Command::new(cli_name);
        if new_instance && cfg!(target_os = "macos") && cli_name == "cursor" {
            cmd.arg("-n");
        }
        return cmd
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("无法启动 {app_name}: {e}"));
    }

    Err(format!("未检测到 {app_name}，请先安装"))
}

pub fn open_in_ide(project_dir: &str, ide: &str) -> Result<(), String> {
    match ide {
        "cursor" => open_gui_ide("Cursor", "cursor", project_dir),
        "trae" => open_gui_ide("Trae", "trae", project_dir),
        "windsurf" => open_gui_ide("Windsurf", "windsurf", project_dir),
        "tongyi-lingma" => open_gui_ide("Lingma", "lingma", project_dir),
        "claude-code" => open_in_claude_code(project_dir),
        "codex" => open_in_codex(project_dir),
        _ => open_gui_ide("Cursor", "cursor", project_dir),
    }
}

fn open_gui_ide(app_name: &str, cli_name: &str, project_dir: &str) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        if Command::new("open")
            .args(["-a", app_name, project_dir])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Ok(());
        }
    }

    if cfg!(target_os = "windows") {
        if let Some(exe) = crate::env_scan::windows_gui_exe(app_name, cli_name) {
            return Command::new(&exe)
                .arg(project_dir)
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("无法打开 {app_name}: {e}"));
        }
    }

    if which_available(cli_name) {
        return Command::new(cli_name)
            .arg(project_dir)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("无法打开 {app_name}: {e}"));
    }

    Err(format!(
        "未检测到 {app_name}。请在上一步点击「一键安装 {app_name}」。"
    ))
}

pub fn open_in_cursor(project_dir: &str) -> Result<(), String> {
    open_gui_ide("Cursor", "cursor", project_dir)
}

fn open_in_claude_code(project_dir: &str) -> Result<(), String> {
    if which_available("claude") {
        crate::claude_code::prepare_claude_code_launch(project_dir)?;
        return launch_interactive_cli("claude", project_dir);
    }
    Err("未检测到 Claude Code（claude 命令）。请在上一步点击「一键安装 Claude Code」。".into())
}

fn open_in_codex(project_dir: &str) -> Result<(), String> {
    if crate::codex_app::codex_app_installed() {
        return crate::codex_app::launch_codex_app(Some(project_dir));
    }
    if which_available("codex") {
        return launch_interactive_cli("codex", project_dir);
    }
    Err("未检测到 Codex 桌面客户端。请在一键安装 Codex 或从官方下载页安装。".into())
}

fn which_available(cmd: &str) -> bool {
    resolve_command_path(cmd).is_some()
}

fn resolve_command_path(cmd: &str) -> Option<String> {
    crate::tools_install::resolve_command_in_prefix(cmd).or_else(|| {
        Command::new(if cfg!(target_os = "windows") {
            "where"
        } else {
            "which"
        })
        .arg(cmd)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.lines().next().unwrap_or("").trim().to_string())
        .filter(|s| !s.is_empty())
    })
}

/// Launch CLI-based IDE in a new terminal window so the user stays inside VibeStart flow.
fn launch_interactive_cli(command: &str, project_dir: &str) -> Result<(), String> {
    let cmd_path = resolve_command_path(command).ok_or_else(|| {
        format!("未找到 {command} 命令。请确认已安装并在当前环境可用。")
    })?;

    if cfg!(target_os = "macos") {
        return launch_macos_terminal_cli(&cmd_path, command, project_dir);
    }

    if cfg!(target_os = "windows") {
        return launch_windows_terminal_cli(&cmd_path, command, project_dir);
    }

    Command::new("x-terminal-emulator")
        .args([
            "-e",
            "bash",
            "-lc",
            &format!("cd \"{project_dir}\" && \"{cmd_path}\""),
        ])
        .spawn()
        .map_err(|e| format!("无法启动 {command}: {e}"))?;
    Ok(())
}

/// macOS: write a `.command` script and `open` it so Terminal gets a stable PTY + PATH.
fn launch_macos_terminal_cli(
    cmd_path: &str,
    command: &str,
    project_dir: &str,
) -> Result<(), String> {
    let dir = shell_escape(project_dir);
    let escaped_cmd = cmd_path.replace('\\', "\\\\").replace('"', "\\\"");

    let (extra_args, preamble) = match command {
        "claude" => (
            crate::claude_code::CLAUDE_LAUNCH_ARGS,
            crate::claude_code::CLAUDE_LAUNCH_PREAMBLE,
        ),
        _ => ("", ""),
    };

    let invoke = if extra_args.is_empty() {
        format!("\"{escaped_cmd}\"")
    } else {
        format!("\"{escaped_cmd}\" {extra_args}")
    };

    let script = format!(
        "#!/bin/zsh\n\
         cd {dir} || {{ echo \"无法进入目录: {dir}\"; exec zsh -l; }}\n\
         {preamble}\
         {invoke} || {{\n\
           echo \"\"\n\
           echo \"启动失败。请确认 {command} 已正确安装。\"\n\
           echo \"按 Enter 关闭此窗口…\"\n\
           read\n\
         }}\n\
         echo \"\"\n\
         echo \"{command} 已退出。窗口将保持打开，可直接输入其他命令。\"\n\
         exec zsh -l\n"
    );

    let script_path = std::env::temp_dir().join(format!("vibestart-{command}.command"));
    fs::write(&script_path, script).map_err(|e| format!("无法写入启动脚本: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Command::new("open")
        .arg(&script_path)
        .status()
        .map_err(|e| format!("无法打开 Terminal 启动 {command}: {e}"))?;
    Ok(())
}

/// Windows: write a `.cmd` script with Chinese preamble (Claude Code) and open in cmd.
fn launch_windows_terminal_cli(
    cmd_path: &str,
    command: &str,
    project_dir: &str,
) -> Result<(), String> {
    let (extra_args, preamble) = match command {
        "claude" => (
            crate::claude_code::CLAUDE_LAUNCH_ARGS,
            crate::claude_code::CLAUDE_LAUNCH_PREAMBLE_BAT,
        ),
        _ => ("", ""),
    };

    let invoke = if extra_args.is_empty() {
        format!("\"{cmd_path}\"")
    } else {
        format!("\"{cmd_path}\" {extra_args}")
    };

    let script = format!(
        "@echo off\r\n\
         chcp 65001 >nul\r\n\
         cd /d \"{project_dir}\" || (echo 无法进入目录: {project_dir} & pause & exit /b 1)\r\n\
         {preamble}\
         {invoke} || (echo. & echo 启动失败。请确认 {command} 已正确安装。 & pause)\r\n\
         echo.\r\n\
         echo {command} 已退出。窗口将保持打开，可直接输入其他命令。\r\n"
    );

    let script_path = std::env::temp_dir().join(format!("vibestart-{command}.cmd"));
    fs::write(&script_path, script).map_err(|e| format!("无法写入启动脚本: {e}"))?;

    Command::new("cmd")
        .args([
            "/C",
            "start",
            "",
            "cmd",
            "/k",
            script_path.to_string_lossy().as_ref(),
        ])
        .status()
        .map_err(|e| format!("无法打开命令行启动 {command}: {e}"))?;
    Ok(())
}

fn shell_escape(value: &str) -> String {
    if value.contains(' ') || value.contains('\'') {
        format!("'{}'", value.replace('\'', "'\\''"))
    } else {
        value.to_string()
    }
}

pub fn open_local_preview(project_dir: &str) -> Result<(), String> {
    let index = PathBuf::from(project_dir).join("index.html");
    if !index.exists() {
        return Err("index.html 不存在，请先在 AI 编辑器中完成当前步骤".into());
    }

    let path = index
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();

    if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(&path)
            .status()
            .map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .status()
            .map_err(|e| e.to_string())?;
    } else {
        Command::new("xdg-open")
            .arg(&path)
            .status()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn vercel_login() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("https://vercel.com/login")
            .status();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", "https://vercel.com/login"])
            .status();
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg("https://vercel.com/login")
            .status();
    }

    launch_vercel_login_terminal()
}

fn launch_vercel_login_terminal() -> Result<String, String> {
    let cmd_path = resolve_command_path("vercel").ok_or_else(|| {
        "未找到 vercel 命令。请先在「安装工具」步骤安装 Node.js，并运行 npm i -g vercel。".to_string()
    })?;

    #[cfg(target_os = "macos")]
    {
        let escaped = cmd_path.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            "#!/bin/zsh\n\
             echo \"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\"\n\
             echo \"  VibeStart · Vercel 登录\"\n\
             echo \"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\"\n\
             echo \"\"\n\
             echo \"  1) 已在系统浏览器打开 vercel.com/login（可在此注册/登录）\"\n\
             echo \"  2) 下方 CLI 会打开授权页，按提示完成 OAuth\"\n\
             echo \"  3) 登录成功后回到 VibeStart 点击「开始部署」\"\n\
             echo \"\"\n\
             \"{escaped}\" login || {{\n\
               echo \"\"\n\
               echo \"登录未完成。请确认网络可访问 vercel.com\"\n\
               echo \"按 Enter 关闭…\"\n\
               read\n\
             }}\n\
             echo \"\"\n\
             echo \"完成。按 Enter 关闭此窗口…\"\n\
             read\n"
        );

        let script_path = std::env::temp_dir().join("vibestart-vercel-login.command");
        std::fs::write(&script_path, script).map_err(|e| format!("无法写入启动脚本: {e}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&script_path)
                .map_err(|e| e.to_string())?
                .permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
        }
        std::process::Command::new("open")
            .arg(&script_path)
            .status()
            .map_err(|e| format!("无法打开 Terminal: {e}"))?;
        return Ok("已在系统浏览器打开 Vercel 登录页，并在终端启动 vercel login。请按终端提示完成授权。".into());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "cmd", "/k", &format!("\"{cmd_path}\" login")])
            .spawn()
            .map_err(|e| format!("无法打开命令行: {e}"))?;
        return Ok("已在系统浏览器打开 Vercel 登录页，并在新命令行窗口启动 vercel login。".into());
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new(&cmd_path)
            .arg("login")
            .spawn()
            .map_err(|e| format!("无法启动 vercel login: {e}"))?;
        return Ok("已在系统浏览器打开 Vercel 登录页，并启动 vercel login。".into());
    }

    #[allow(unreachable_code)]
    Ok(String::new())
}

fn copy_dir_merge(src: &Path, dst: &Path) -> Result<(Vec<String>, Vec<String>), String> {
    let mut added = Vec::new();
    let mut skipped = Vec::new();
    copy_dir_merge_inner(src, dst, &mut added, &mut skipped)?;
    Ok((added, skipped))
}

fn copy_dir_merge_inner(
    src: &Path,
    dst: &Path,
    added: &mut Vec<String>,
    skipped: &mut Vec<String>,
) -> Result<(), String> {
    if !src.is_dir() {
        return Err(format!("Scaffold path is not a directory: {}", src.display()));
    }

    fs::create_dir_all(dst).map_err(|e| e.to_string())?;

    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let name = entry.file_name();
        let dst_path = dst.join(&name);
        let rel = name.to_string_lossy().into_owned();

        if file_type.is_dir() {
            copy_dir_merge_inner(&src_path, &dst_path, added, skipped)?;
        } else if dst_path.exists() {
            skipped.push(rel);
        } else {
            if let Some(parent) = dst_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
            added.push(rel);
        }
    }

    Ok(())
}

#[allow(dead_code)]
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Err(format!("Scaffold path is not a directory: {}", src.display()));
    }

    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            fs::create_dir_all(&dst_path).map_err(|e| e.to_string())?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            if let Some(parent) = dst_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
