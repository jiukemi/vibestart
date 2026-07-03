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
        scan_command("npm", &["--version"], |s| s.trim().to_string()),
        scan_cursor(),
        scan_trae(),
        scan_windsurf(),
        scan_claude_code(),
        scan_codex(),
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
    match Command::new(name).args(args).output() {
        Ok(out) if out.status.success() => {
            let raw = String::from_utf8_lossy(&out.stdout).to_string();
            let version = parse(&raw);
            let meets = check_minimum(name, &version);
            ToolStatus {
                name: name.to_string(),
                installed: true,
                version: Some(version),
                path: which_path(name),
                meets_minimum: meets,
            }
        }
        _ => ToolStatus {
            name: name.to_string(),
            installed: false,
            version: None,
            path: None,
            meets_minimum: false,
        },
    }
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
        "node" => parts.first().copied().unwrap_or(0) >= 18,
        _ => true,
    }
}

fn scan_cursor() -> ToolStatus {
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

    let installed = if cfg!(target_os = "macos") {
        Path::new("/Applications/Cursor.app").exists()
            || find_gui_in_custom_roots("Cursor", "Cursor.app").is_some()
    } else if cfg!(target_os = "windows") {
        std::env::var("LOCALAPPDATA")
            .map(|local| {
                Path::new(&local)
                    .join("Programs")
                    .join("cursor")
                    .join("Cursor.exe")
                    .exists()
            })
            .unwrap_or(false)
            || resolve_windows_cursor_path().is_some()
            || find_gui_in_custom_roots("Cursor", "Cursor.exe").is_some()
    } else {
        false
    };

    ToolStatus {
        name: "cursor".to_string(),
        installed,
        version: None,
        path: if installed {
            which_path("cursor").or_else(resolve_windows_cursor_path).or_else(|| {
                if cfg!(target_os = "macos") {
                    Some("/Applications/Cursor.app".to_string())
                } else {
                    None
                }
            })
        } else {
            None
        },
        meets_minimum: installed,
    }
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
    let local = std::env::var("LOCALAPPDATA").ok()?;
    let base = PathBuf::from(&local);
    let folder = folder_name.to_lowercase();
    let candidates = [
        base.join("Programs").join(&folder).join(format!("{app_name}.exe")),
        base.join("Programs").join(app_name).join(format!("{app_name}.exe")),
        base.join(&folder).join(format!("{app_name}.exe")),
        base.join(app_name).join(format!("{app_name}.exe")),
    ];
    candidates
        .into_iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().into_owned())
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
    scan_named_cli("codex", "codex", &["--version"])
}

fn scan_named_cli(name: &str, cmd: &str, args: &[&str]) -> ToolStatus {
    if let Some(path) = crate::tools_install::resolve_command_in_prefix(cmd) {
        if let Ok(out) = Command::new(&path).args(args).output() {
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
                    path: Some(path),
                    meets_minimum: true,
                };
            }
        }
    }

    if let Ok(out) = Command::new(cmd).args(args).output() {
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
    let paths: Vec<String> = if cfg!(target_os = "macos") {
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
    crate::tools_install::resolve_command_in_prefix(cmd).or_else(|| {
        Command::new(if cfg!(target_os = "windows") {
            "where"
        } else {
            "which"
        })
        .arg(cmd)
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.lines().next().map(|line| line.trim().to_string()))
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
