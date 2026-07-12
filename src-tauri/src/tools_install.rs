use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::config::{load_config, save_config, ToolsInstallConfig, ToolsInstallMode};

#[derive(Debug, Clone, Serialize)]
pub struct ToolsInstallInfo {
    pub mode: String,
    pub custom_dir: Option<String>,
    pub recommended_root: String,
    pub effective_npm_prefix: String,
    pub effective_gui_dir: String,
    pub git_node_note: String,
}

#[derive(Debug, Clone)]
pub struct ResolvedToolsPaths {
    pub mode: ToolsInstallMode,
    pub npm_prefix: PathBuf,
    pub gui_apps_dir: PathBuf,
    pub system_gui_install: bool,
}

pub fn recommended_tools_root() -> PathBuf {
    dirs::home_dir()
        .map(|h| h.join(".vibestart").join("tools"))
        .unwrap_or_else(|| PathBuf::from(".vibestart/tools"))
}

pub fn default_custom_tools_parent() -> String {
    recommended_tools_root()
        .to_string_lossy()
        .into_owned()
}

pub fn tools_install_config() -> ToolsInstallConfig {
    load_config().tools_install.unwrap_or_default()
}

pub fn save_tools_install_config(config: ToolsInstallConfig) -> Result<(), String> {
    if config.mode == ToolsInstallMode::Custom {
        let dir = config
            .custom_dir
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .ok_or("自定义模式需要选择安装目录")?;
        let path = PathBuf::from(dir);
        if !path.is_absolute() {
            return Err("安装目录必须是绝对路径".into());
        }
    }

    let paths = resolve_paths(&config);
    ensure_install_dirs(&paths)?;

    let mut app = load_config();
    app.tools_install = Some(config);
    save_config(&app)
}

pub fn resolve_paths(config: &ToolsInstallConfig) -> ResolvedToolsPaths {
    match config.mode {
        ToolsInstallMode::Recommended => {
            let npm_prefix = recommended_tools_root().join("npm");
            let (gui_apps_dir, system_gui_install) = if cfg!(target_os = "macos") {
                (PathBuf::from("/Applications"), true)
            } else if cfg!(target_os = "windows") {
                let local = std::env::var("LOCALAPPDATA")
                    .map(PathBuf::from)
                    .unwrap_or_else(|_| recommended_tools_root());
                (local.join("Programs"), true)
            } else {
                (recommended_tools_root().join("apps"), false)
            };
            ResolvedToolsPaths {
                mode: ToolsInstallMode::Recommended,
                npm_prefix,
                gui_apps_dir,
                system_gui_install,
            }
        }
        ToolsInstallMode::Custom => {
            let root = config
                .custom_dir
                .as_ref()
                .filter(|s| !s.trim().is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(recommended_tools_root);
            ResolvedToolsPaths {
                mode: ToolsInstallMode::Custom,
                npm_prefix: root.join("npm"),
                gui_apps_dir: root.join("apps"),
                system_gui_install: false,
            }
        }
    }
}

pub fn ensure_install_dirs(paths: &ResolvedToolsPaths) -> Result<(), String> {
    fs::create_dir_all(&paths.npm_prefix)
        .map_err(|e| format!("无法创建 npm 目录 {}: {e}", paths.npm_prefix.display()))?;
    fs::create_dir_all(npm_bin_dir(&paths.npm_prefix))
        .map_err(|e| format!("无法创建 npm bin 目录: {e}"))?;
    if !paths.system_gui_install {
        fs::create_dir_all(&paths.gui_apps_dir)
            .map_err(|e| format!("无法创建应用目录 {}: {e}", paths.gui_apps_dir.display()))?;
    }
    Ok(())
}

pub fn npm_bin_dir(prefix: &Path) -> PathBuf {
    prefix.join("bin")
}

pub fn get_tools_install_info() -> ToolsInstallInfo {
    let config = tools_install_config();
    let paths = resolve_paths(&config);
    let git_node_note = if config.mode == ToolsInstallMode::Custom {
        "Git 与 Node.js 仍安装到系统推荐位置（便于全局使用）；npm 命令行工具与 GUI 编辑器会安装到你指定的目录。"
            .into()
    } else if cfg!(target_os = "windows") {
        "Git / Node 由 winget 安装到系统位置；npm CLI 安装到 %USERPROFILE%\\.vibestart\\tools\\npm；GUI 编辑器安装到 %LOCALAPPDATA%\\Programs。"
            .into()
    } else if cfg!(target_os = "macos") {
        "Git / Node 由 Homebrew 安装到系统位置；npm CLI 安装到 ~/.vibestart/tools/npm；GUI 编辑器安装到「应用程序」。"
            .into()
    } else {
        "Git / Node 使用系统包管理器；npm CLI 与 GUI 编辑器按上方选择安装。".into()
    };

    ToolsInstallInfo {
        mode: match config.mode {
            ToolsInstallMode::Recommended => "recommended".into(),
            ToolsInstallMode::Custom => "custom".into(),
        },
        custom_dir: config.custom_dir.clone(),
        recommended_root: default_custom_tools_parent(),
        effective_npm_prefix: paths.npm_prefix.to_string_lossy().into_owned(),
        effective_gui_dir: paths.gui_apps_dir.to_string_lossy().into_owned(),
        git_node_note,
    }
}

pub fn extra_path_prefixes() -> Vec<PathBuf> {
    let paths = resolve_paths(&tools_install_config());
    vec![npm_bin_dir(&paths.npm_prefix)]
}

pub fn resolve_command_in_prefix(cmd: &str) -> Option<String> {
    resolve_command_in_dir(cmd, &npm_bin_dir(&resolve_paths(&tools_install_config()).npm_prefix))
        .map(|p| p.to_string_lossy().into_owned())
}

fn resolve_command_in_dir(cmd: &str, bin: &Path) -> Option<PathBuf> {
    if !bin.is_dir() {
        return None;
    }

    let candidates = if cfg!(target_os = "windows") {
        vec![
            bin.join(format!("{cmd}.cmd")),
            bin.join(format!("{cmd}.exe")),
            bin.join(cmd),
        ]
    } else {
        vec![bin.join(cmd)]
    };

    candidates.into_iter().find(|p| p.is_file())
}

/// 系统 PATH 中的可执行文件（where / which）
pub fn which_in_system_path(cmd: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    if cmd == "npm" {
        return which_npm_on_windows();
    }

    let probe = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    Command::new(probe)
        .arg(cmd)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| {
            s.lines()
                .find(|line| !line.trim().is_empty())
                .map(|line| PathBuf::from(line.trim()))
        })
        .filter(|p| p.is_file())
}

/// Windows：`where npm` 首行常为无扩展名 Unix 脚本，直接 CreateProcess 会报 os error 193
#[cfg(target_os = "windows")]
fn which_npm_on_windows() -> Option<PathBuf> {
    let output = Command::new("where").arg("npm").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut cmd_paths = Vec::new();
    let mut exe_paths = Vec::new();
    for line in stdout.lines() {
        let p = PathBuf::from(line.trim());
        if !p.is_file() {
            continue;
        }
        match p.extension().and_then(|e| e.to_str()) {
            Some("cmd") => cmd_paths.push(p),
            Some("exe") => exe_paths.push(p),
            _ => {}
        }
    }
    cmd_paths.into_iter().next().or_else(|| exe_paths.into_iter().next())
}

#[cfg(not(target_os = "windows"))]
fn which_npm_on_windows() -> Option<PathBuf> {
    None
}

const WINDOWS_NPM_NAMES: &[&str] = &["npm.cmd", "npm.exe"];

#[cfg(target_os = "windows")]
fn windows_node_install_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(pf) = std::env::var("ProgramFiles") {
        dirs.push(PathBuf::from(pf).join("nodejs"));
    }
    dirs.push(PathBuf::from(r"C:\Program Files\nodejs"));
    // x86_64 主机优先 64 位 Node；仅非 x64 再查 Program Files (x86)
    if std::env::consts::ARCH != "x86_64" {
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            dirs.push(PathBuf::from(pf86).join("nodejs"));
        }
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        dirs.push(PathBuf::from(local).join("Programs").join("nodejs"));
    }
    dirs
}

#[cfg(not(target_os = "windows"))]
fn windows_node_install_dirs() -> Vec<PathBuf> {
    vec![]
}

fn sibling_executable(dir: &Path, base_names: &[&str]) -> Option<PathBuf> {
    for name in base_names {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

/// Node.js 可执行文件（winget 安装后当前进程 PATH 可能未刷新，需探测常见目录）
pub fn resolve_system_node() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Some(node) = which_node_exe_on_windows() {
            return Some(node);
        }
        for dir in windows_node_install_dirs() {
            if let Some(p) = sibling_executable(&dir, &["node.exe"]) {
                return Some(p);
            }
        }
        return None;
    }

    #[cfg(not(target_os = "windows"))]
    {
        which_in_system_path("node").or_else(|| {
            for dir in windows_node_install_dirs() {
                if let Some(p) = sibling_executable(&dir, &["node.exe", "node"]) {
                    return Some(p);
                }
            }
            None
        })
    }
}

#[cfg(target_os = "windows")]
fn which_node_exe_on_windows() -> Option<PathBuf> {
    let output = Command::new("where").arg("node").output().ok()?;
    if !output.status.success() {
        return None;
    }
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let p = PathBuf::from(line.trim());
        if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("exe") {
            return Some(p);
        }
    }
    None
}

/// 系统 npm（随 Node 安装）
pub fn resolve_system_npm() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return which_npm_on_windows().or_else(|| {
            resolve_system_node()
                .and_then(|node| node.parent().map(Path::to_path_buf))
                .and_then(|dir| sibling_executable(&dir, WINDOWS_NPM_NAMES))
        }).or_else(|| {
            for dir in windows_node_install_dirs() {
                if let Some(p) = sibling_executable(&dir, WINDOWS_NPM_NAMES) {
                    return Some(p);
                }
            }
            None
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        which_in_system_path("npm").or_else(|| {
            resolve_system_node()
                .and_then(|node| node.parent().map(Path::to_path_buf))
                .and_then(|dir| sibling_executable(&dir, &["npm", "npm.cmd"]))
        })
    }
}

/// 构造可执行的 npm 进程（Windows 上 .cmd 须经 cmd /C，否则 os error 193）
pub fn new_npm_command(npm_path: &Path) -> Command {
    #[cfg(target_os = "windows")]
    {
        match npm_path.extension().and_then(|e| e.to_str()) {
            Some("cmd") | Some("bat") => {
                let mut cmd = Command::new("cmd");
                cmd.arg("/C").arg(npm_path);
                return cmd;
            }
            Some("exe") => {}
            _ => {
                let mut cmd = Command::new("cmd");
                cmd.arg("/C").arg(npm_path);
                return cmd;
            }
        }
    }
    Command::new(npm_path)
}

pub fn npm_command_process() -> Result<Command, String> {
    let path = resolve_system_npm().ok_or_else(|| {
        "无法执行 npm: 未找到 npm。请先安装 Node.js，完成后点击「重新检测」或重启 VibeStart；\
         详见故障排查「npm 未找到 / Vercel CLI 安装失败」。"
            .to_string()
    })?;
    Ok(new_npm_command(&path))
}

/// Vercel / Claude 等：先查 VibeStart npm 前缀，再查系统 PATH
pub fn resolve_cli_command(cmd: &str) -> Option<PathBuf> {
    resolve_command_in_dir(cmd, &npm_bin_dir(&resolve_paths(&tools_install_config()).npm_prefix))
        .or_else(|| which_in_system_path(cmd))
}

pub fn npm_command() -> Result<PathBuf, String> {
    resolve_system_npm().ok_or_else(|| {
        "无法执行 npm: 未找到 npm。请先安装 Node.js，完成后点击「重新检测」或重启 VibeStart；\
         详见故障排查「npm 未找到 / Vercel CLI 安装失败」。"
            .into()
    })
}

/// 为 npm 子进程注入 Node 目录与 VibeStart npm bin（Windows / macOS 通用）
pub fn apply_npm_runtime_env(cmd: &mut Command) {
    if let Some(node) = resolve_system_node() {
        if let Some(dir) = node.parent() {
            prepend_path_env(cmd, dir);
        }
    }
    let paths = resolve_paths(&tools_install_config());
    prepend_path_env(cmd, &npm_bin_dir(&paths.npm_prefix));
    crate::mirrors::apply_npm_registry(cmd);
}

fn prepend_path_env(cmd: &mut Command, extra: &Path) {
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

pub fn gui_install_location(app_folder: &str) -> Option<PathBuf> {
    let paths = resolve_paths(&tools_install_config());
    if paths.system_gui_install {
        return None;
    }
    Some(paths.gui_apps_dir.join(app_folder))
}

pub fn gui_search_roots() -> Vec<PathBuf> {
    let paths = resolve_paths(&tools_install_config());
    let mut roots = Vec::new();
    if !paths.system_gui_install {
        roots.push(paths.gui_apps_dir.clone());
    }
    roots
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SaveToolsInstallModeArg {
    Recommended,
    Custom,
}

impl From<SaveToolsInstallModeArg> for ToolsInstallMode {
    fn from(value: SaveToolsInstallModeArg) -> Self {
        match value {
            SaveToolsInstallModeArg::Recommended => ToolsInstallMode::Recommended,
            SaveToolsInstallModeArg::Custom => ToolsInstallMode::Custom,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recommended_has_npm_prefix_under_vibestart() {
        let paths = resolve_paths(&ToolsInstallConfig::default());
        assert!(paths
            .npm_prefix
            .to_string_lossy()
            .contains(".vibestart"));
    }
}
