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
    } else {
        false
    };

    ToolStatus {
        name: "cursor".to_string(),
        installed,
        version: None,
        path: if installed {
            which_path("cursor").or_else(|| {
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

fn which_path(cmd: &str) -> Option<String> {
    Command::new(if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    })
    .arg(cmd)
    .output()
    .ok()
    .and_then(|o| String::from_utf8(o.stdout).ok())
    .map(|s| s.lines().next()?.trim().to_string())
}
