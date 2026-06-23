use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Macos,
    Windows,
    Unknown,
}

#[derive(Debug, Serialize)]
pub struct OsInfo {
    pub platform: Platform,
    pub arch: String,
    pub version: String,
}

pub fn detect() -> OsInfo {
    let arch = std::env::consts::ARCH.to_string();
    let platform = if cfg!(target_os = "macos") {
        Platform::Macos
    } else if cfg!(target_os = "windows") {
        Platform::Windows
    } else {
        Platform::Unknown
    };
    let version = match platform {
        Platform::Macos => run_sw_vers().unwrap_or_default(),
        Platform::Windows => run_win_ver().unwrap_or_default(),
        Platform::Unknown => String::new(),
    };
    OsInfo {
        platform,
        arch,
        version,
    }
}

fn run_sw_vers() -> Option<String> {
    std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
}

fn run_win_ver() -> Option<String> {
    std::process::Command::new("cmd")
        .args(["/C", "ver"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
}
