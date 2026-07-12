use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct ToolStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub meets_minimum: bool,
}

pub fn scan_all() -> Vec<ToolStatus> {
    vec![
        scan_command("git", &["--version"], parse_prefix_version),
        scan_command("node", &["--version"], |s| {
            s.trim().trim_start_matches('v').to_string()
        }),
        scan_npm(),
        scan_cursor(),
        scan_trae(),
        scan_windsurf(),
        scan_claude_code(),
        scan_codex(),
        scan_codex_bridge(),
        scan_cc_switch(),
        scan_tongyi_lingma(),
        scan_command("vercel", &["--version"], |s| s.trim().to_string()),
        scan_command("flutter", &["--version"], |s| {
            s.lines().next().unwrap_or(s).trim().to_string()
        }),
        scan_wechat_devtools(),
        scan_xcode(),
        scan_android_studio(),
    ]
}

fn scan_command(name: &str, args: &[&str], parse: fn(&str) -> String) -> ToolStatus {
    if let Ok(out) = crate::tools_install::run_tool(name, args) {
        if out.status.success() {
            let raw = String::from_utf8_lossy(&out.stdout).to_string();
            let version = parse(&raw);
            let meets = check_minimum(name, &version);
            return ToolStatus {
                name: name.to_string(),
                installed: true,
                version: Some(version),
                path: crate::tools_install::resolve_tool_executable(name)
                    .map(|p| p.to_string_lossy().into_owned()),
                meets_minimum: meets,
            };
        }
    }

    ToolStatus {
        name: name.to_string(),
        installed: false,
        version: None,
        path: None,
        meets_minimum: false,
    }
}

fn scan_npm() -> ToolStatus {
    if let Some(npm) = crate::tools_install::resolve_system_npm() {
        let path = npm.to_string_lossy().into_owned();
        let mut cmd = crate::tools_install::new_npm_command(&npm);
        cmd.arg("--version");
        crate::tools_install::apply_npm_runtime_env(&mut cmd);
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                let raw = String::from_utf8_lossy(&out.stdout).to_string();
                let version = raw.trim().to_string();
                return ToolStatus {
                    name: "npm".into(),
                    installed: true,
                    version: Some(version),
                    path: Some(path),
                    meets_minimum: true,
                };
            }
        }
    }
    scan_command("npm", &["--version"], |s| s.trim().to_string())
}

fn parse_prefix_version(raw: &str) -> String {
    raw.trim()
        .split_whitespace()
        .nth(2)
        .unwrap_or(raw.trim())
        .to_string()
}

fn check_minimum(name: &str, version: &str) -> bool {
    let parts: Vec<u32> = version
        .split('.')
        .filter_map(|p| p.parse().ok())
        .collect();
    match name {
        "git" => parts.first().copied().unwrap_or(0) >= 2,
        "node" => true,
        _ => true,
    }
}

fn scan_cursor() -> ToolStatus {
    #[cfg(target_os = "windows")]
    return scan_cursor_windows();

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(out) = Command::new("cursor").arg("--version").output() {
            if out.status.success() {
                let raw = String::from_utf8_lossy(&out.stdout).to_string();
                return ToolStatus {
                    name: "cursor".to_string(),
                    installed: true,
                    version: Some(raw.trim().to_string()),
                    path: which_path("cursor"),
                    meets_minimum: true,
                };
            }
        }

        let installed = Path::new("/Applications/Cursor.app").exists()
            || find_gui_in_custom_roots("Cursor", "Cursor.app").is_some();

        ToolStatus {
            name: "cursor".to_string(),
            installed,
            version: None,
            path: if installed {
                which_path("cursor").or_else(|| Some("/Applications/Cursor.app".to_string()))
            } else {
                None
            },
            meets_minimum: installed,
        }
    }
}

#[cfg(target_os = "windows")]
fn scan_cursor_windows() -> ToolStatus {
    let mut version: Option<String> = None;
    let mut path: Option<String> = None;

    if let Some(cli) = crate::tools_install::which_windows_cli("cursor") {
        if let Ok(out) = crate::tools_install::run_executable(&cli, &["--version"]) {
            if out.status.success() {
                version = Some(String::from_utf8_lossy(&out.stdout).trim().to_string());
            }
        }
        if path.is_none() {
            path = gui_exe_from_electron_cli(&cli, "Cursor")
                .map(|p| p.to_string_lossy().into_owned());
        }
    }

    if path.is_none() {
        path = resolve_windows_cursor_path()
            .or_else(|| find_gui_in_custom_roots("Cursor", "Cursor.exe"));
    }

    let installed = path.is_some() || version.is_some();

    ToolStatus {
        name: "cursor".into(),
        installed,
        version,
        path,
        meets_minimum: installed,
    }
}

/// Electron 系 IDE：`.../resources/app/bin/*.cmd` → 安装根目录下的 `Cursor.exe`
#[cfg(target_os = "windows")]
fn gui_exe_from_electron_cli(cli: &std::path::Path, app_name: &str) -> Option<std::path::PathBuf> {
    let root = cli
        .parent()? // bin
        .parent()? // app
        .parent()? // resources
        .parent()?; // install root (e.g. D:\cursor)
    let exe = root.join(format!("{app_name}.exe"));
    if exe.is_file() {
        return Some(exe);
    }
    None
}

#[cfg(target_os = "windows")]
fn which_windows_exe(name: &str) -> Option<std::path::PathBuf> {
    let output = crate::tools_install::new_subprocess("where").arg(name).output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(std::path::PathBuf::from)
        .find(|p| p.is_file())
}

fn scan_trae() -> ToolStatus {
    scan_gui_ide("trae", "Trae", "trae", &["/Applications/Trae.app"])
}

fn scan_windsurf() -> ToolStatus {
    scan_gui_ide(
        "windsurf",
        "Windsurf",
        "windsurf",
        &["/Applications/Windsurf.app"],
    )
}

fn scan_tongyi_lingma() -> ToolStatus {
    scan_gui_ide(
        "tongyi-lingma",
        "Lingma",
        "lingma",
        &["/Applications/Lingma.app", "/Applications/通义灵码.app"],
    )
}

fn scan_gui_ide(name: &str, app_name: &str, cli: &str, mac_paths: &[&str]) -> ToolStatus {
    #[cfg(target_os = "windows")]
    if let Some(cli_path) = crate::tools_install::which_windows_cli(cli) {
        if let Ok(out) = crate::tools_install::run_executable(&cli_path, &["--version"]) {
            if out.status.success() {
                let raw = String::from_utf8_lossy(&out.stdout).to_string();
                return ToolStatus {
                    name: name.to_string(),
                    installed: true,
                    version: Some(raw.lines().next().unwrap_or("").trim().to_string()),
                    path: which_path(cli),
                    meets_minimum: true,
                };
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    if let Ok(out) = Command::new(cli).arg("--version").output() {
        if out.status.success() {
            let raw = String::from_utf8_lossy(&out.stdout).to_string();
            return ToolStatus {
                name: name.to_string(),
                installed: true,
                version: Some(raw.lines().next().unwrap_or("").trim().to_string()),
                path: which_path(cli),
                meets_minimum: true,
            };
        }
    }

    let installed_path = if cfg!(target_os = "macos") {
        mac_paths
            .iter()
            .find(|p| Path::new(p).exists())
            .map(|p| (*p).to_string())
            .or_else(|| find_gui_in_custom_roots(app_name, &format!("{app_name}.app")))
    } else if cfg!(target_os = "windows") {
        resolve_windows_gui_path(app_name, name)
            .or_else(|| find_gui_in_custom_roots(app_name, &format!("{app_name}.exe")))
    } else {
        None
    };

    let installed = installed_path.is_some();

    ToolStatus {
        name: name.to_string(),
        installed,
        version: None,
        path: installed_path.or_else(|| which_path(cli)),
        meets_minimum: installed,
    }
}

#[cfg(target_os = "windows")]
fn resolve_windows_cursor_path() -> Option<String> {
    resolve_windows_gui_path("Cursor", "cursor")
}

#[cfg(not(target_os = "windows"))]
fn resolve_windows_cursor_path() -> Option<String> {
    None
}

#[cfg(target_os = "windows")]
fn resolve_windows_gui_path(app_name: &str, folder_name: &str) -> Option<String> {
    use std::path::PathBuf;
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let base = PathBuf::from(&local);
        let folder = folder_name.to_lowercase();
        candidates.extend([
            base.join("Programs").join(&folder).join(format!("{app_name}.exe")),
            base.join("Programs").join(app_name).join(format!("{app_name}.exe")),
            base.join(&folder).join(format!("{app_name}.exe")),
            base.join(app_name).join(format!("{app_name}.exe")),
        ]);
    }
    if let Ok(pf) = std::env::var("ProgramFiles") {
        candidates.push(PathBuf::from(pf).join(app_name).join(format!("{app_name}.exe")));
    }
    if std::env::consts::ARCH != "x86_64" {
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(pf86).join(app_name).join(format!("{app_name}.exe")));
        }
    }
    if let Some(p) = candidates.into_iter().find(|p| p.exists()) {
        return Some(p.to_string_lossy().into_owned());
    }
    if let Some(p) = which_windows_exe(&format!("{app_name}.exe")) {
        return Some(p.to_string_lossy().into_owned());
    }
    if let Some(cli) = crate::tools_install::which_windows_cli(folder_name) {
        if let Some(exe) = gui_exe_from_electron_cli(&cli, app_name) {
            return Some(exe.to_string_lossy().into_owned());
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
pub fn windows_gui_exe(_app_name: &str, _folder_name: &str) -> Option<String> {
    None
}

#[cfg(target_os = "windows")]
pub fn windows_gui_exe(app_name: &str, folder_name: &str) -> Option<String> {
    resolve_windows_gui_path(app_name, folder_name)
}

#[cfg(not(target_os = "windows"))]
fn resolve_windows_gui_path(_app_name: &str, _folder_name: &str) -> Option<String> {
    None
}

fn scan_claude_code() -> ToolStatus {
    scan_named_cli("claude-code", "claude", &["--version"])
}

fn scan_codex() -> ToolStatus {
    if let Some(path) = crate::codex_app::codex_app_path() {
        let version = crate::codex_app::codex_app_version(&path);
        return ToolStatus {
            name: "codex".to_string(),
            installed: true,
            version,
            path: Some(path),
            meets_minimum: true,
        };
    }

    ToolStatus {
        name: "codex".to_string(),
        installed: false,
        version: None,
        path: None,
        meets_minimum: false,
    }
}

fn scan_codex_bridge() -> ToolStatus {
    let dir = match crate::config::vibestart_dir() {
        Ok(d) => d.join("tools").join("codex-bridge"),
        Err(_) => {
            return ToolStatus {
                name: "codex-bridge".to_string(),
                installed: false,
                version: None,
                path: None,
                meets_minimum: false,
            };
        }
    };
    let server = dir.join("dist").join("server.js");
    let installed = server.is_file();
    ToolStatus {
        name: "codex-bridge".to_string(),
        installed,
        version: if installed {
            Some("installed".into())
        } else {
            None
        },
        path: if installed {
            Some(dir.to_string_lossy().into())
        } else {
            None
        },
        meets_minimum: installed,
    }
}

fn scan_cc_switch() -> ToolStatus {
    let (installed, path) = if cfg!(target_os = "macos") {
        let app = Path::new("/Applications/CC Switch.app");
        (app.exists(), app.exists().then(|| app.to_string_lossy().into()))
    } else if cfg!(target_os = "windows") {
        let mut candidates: Vec<std::path::PathBuf> = Vec::new();
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(
                std::path::PathBuf::from(local)
                    .join("Programs")
                    .join("CC Switch")
                    .join("CC Switch.exe"),
            );
        }
        candidates.push(std::path::PathBuf::from(
            r"C:\Program Files\CC Switch\CC Switch.exe",
        ));
        let found = candidates.into_iter().find(|p| p.is_file());
        (
            found.is_some(),
            found.map(|p| p.to_string_lossy().into()),
        )
    } else {
        (false, None)
    };

    ToolStatus {
        name: "cc-switch".to_string(),
        installed,
        version: None,
        path,
        meets_minimum: installed,
    }
}

fn scan_named_cli(name: &str, cmd: &str, args: &[&str]) -> ToolStatus {
    if let Some(path) = crate::tools_install::resolve_command_in_prefix(cmd) {
        let path = std::path::PathBuf::from(path);
        if let Ok(out) = crate::tools_install::run_executable(&path, args) {
            if out.status.success() {
                let raw = String::from_utf8_lossy(&out.stdout).to_string();
                let version = raw.lines().next().unwrap_or("").trim().to_string();
                return ToolStatus {
                    name: name.to_string(),
                    installed: true,
                    version: if version.is_empty() {
                        None
                    } else {
                        Some(version)
                    },
                    path: Some(path.to_string_lossy().into_owned()),
                    meets_minimum: true,
                };
            }
        }
    }

    if let Ok(out) = crate::tools_install::run_tool(cmd, args) {
        if out.status.success() {
            let raw = String::from_utf8_lossy(&out.stdout).to_string();
            let version = raw.lines().next().unwrap_or("").trim().to_string();
            return ToolStatus {
                name: name.to_string(),
                installed: true,
                version: if version.is_empty() {
                    None
                } else {
                    Some(version)
                },
                path: which_path(cmd),
                meets_minimum: true,
            };
        }
    }

    ToolStatus {
        name: name.to_string(),
        installed: false,
        version: None,
        path: None,
        meets_minimum: false,
    }
}

fn scan_wechat_devtools() -> ToolStatus {
    let mut paths: Vec<String> = if cfg!(target_os = "macos") {
        vec![
            "/Applications/wechatwebdevtools.app".into(),
            "/Applications/微信开发者工具.app".into(),
        ]
    } else if cfg!(target_os = "windows") {
        vec![
            r"C:\Program Files (x86)\Tencent\微信web开发者工具".into(),
            r"C:\Program Files\Tencent\微信web开发者工具".into(),
        ]
    } else {
        vec![]
    };

    #[cfg(target_os = "windows")]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(format!(r"{local}\微信开发者工具"));
            paths.push(format!(r"{local}\微信web开发者工具"));
        }
        if let Ok(user) = std::env::var("USERPROFILE") {
            paths.push(format!(r"{user}\AppData\Local\微信开发者工具"));
            paths.push(format!(r"{user}\AppData\Local\微信web开发者工具"));
        }
    }

    let found = paths.iter().find(|p| Path::new(p.as_str()).exists());
    ToolStatus {
        name: "wechat-devtools".into(),
        installed: found.is_some(),
        version: None,
        path: found.cloned(),
        meets_minimum: found.is_some(),
    }
}

fn scan_xcode() -> ToolStatus {
    if cfg!(target_os = "macos") {
        let xcode_app = Path::new("/Applications/Xcode.app");
        if xcode_app.exists() {
            return ToolStatus {
                name: "xcode".into(),
                installed: true,
                version: Command::new("xcodebuild")
                    .arg("-version")
                    .output()
                    .ok()
                    .and_then(|o| {
                        String::from_utf8(o.stdout)
                            .ok()
                            .map(|s| s.lines().next().unwrap_or("").to_string())
                    }),
                path: Some(xcode_app.to_string_lossy().into_owned()),
                meets_minimum: true,
            };
        }
    }
    ToolStatus {
        name: "xcode".into(),
        installed: false,
        version: None,
        path: None,
        meets_minimum: false,
    }
}

fn scan_android_studio() -> ToolStatus {
    let paths: &[&str] = if cfg!(target_os = "macos") {
        &["/Applications/Android Studio.app"]
    } else if cfg!(target_os = "windows") {
        &[
            r"C:\Program Files\Android\Android Studio",
            r"C:\Program Files (x86)\Android\Android Studio",
        ]
    } else {
        &[]
    };
    let found = paths.iter().find(|p| Path::new(p).exists());
    ToolStatus {
        name: "android-studio".into(),
        installed: found.is_some(),
        version: None,
        path: found.map(|p| (*p).to_string()),
        meets_minimum: found.is_some(),
    }
}

fn which_path(cmd: &str) -> Option<String> {
    crate::tools_install::resolve_command_in_prefix(cmd)
        .or_else(|| {
            crate::tools_install::which_in_system_path(cmd)
                .map(|p| p.to_string_lossy().into_owned())
        })
}

fn find_gui_in_custom_roots(app_name: &str, file_name: &str) -> Option<String> {
    for root in crate::tools_install::gui_search_roots() {
        let direct = root.join(file_name);
        if direct.exists() {
            return Some(direct.to_string_lossy().into_owned());
        }
        let nested = root.join(app_name).join(file_name);
        if nested.exists() {
            return Some(nested.to_string_lossy().into_owned());
        }
        let lower = root.join(app_name.to_lowercase()).join(file_name);
        if lower.exists() {
            return Some(lower.to_string_lossy().into_owned());
        }
    }
    None
}
