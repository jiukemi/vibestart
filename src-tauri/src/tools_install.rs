use std::fs;
use std::path::{Path, PathBuf};

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
    let paths = resolve_paths(&tools_install_config());
    let bin = npm_bin_dir(&paths.npm_prefix);
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

    candidates
        .into_iter()
        .find(|p| p.is_file())
        .map(|p| p.to_string_lossy().into_owned())
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
