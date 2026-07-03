use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::config::vibestart_dir;
use crate::os::{self, Platform};

const EMBEDDED: &str = include_str!("../resources/mirrors.json");

pub const DEFAULT_NPM_REGISTRY: &str = "https://registry.npmmirror.com";

#[derive(Debug, Clone, Deserialize)]
pub struct MirrorsManifest {
    pub version: u32,
    #[serde(default = "default_npm_registry")]
    pub npm_registry: String,
    #[serde(default)]
    pub gitee_release_base: String,
    #[serde(default)]
    pub artifacts: Artifacts,
}

fn default_npm_registry() -> String {
    DEFAULT_NPM_REGISTRY.to_string()
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Artifacts {
    #[serde(default)]
    pub codex_bridge_prebuilt: CodexBridgePrebuilt,
    #[serde(default)]
    pub codex_bridge_source: CodexBridgeSource,
    #[serde(default)]
    pub cc_switch: CcSwitchMirrors,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CodexBridgePrebuilt {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub tag: String,
    #[serde(default)]
    pub windows_x86_64: String,
    #[serde(default)]
    pub macos_aarch64: String,
    #[serde(default)]
    pub macos_x86_64: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CodexBridgeSource {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub tag: String,
    #[serde(default)]
    pub all: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CcSwitchMirrors {
    #[serde(default)]
    pub windows_x86_64: String,
    #[serde(default)]
    pub macos_universal: String,
}

pub fn load_mirrors() -> MirrorsManifest {
    if let Ok(raw) = fs::read_to_string(mirror_override_path()) {
        if let Ok(m) = serde_json::from_str(&raw) {
            return m;
        }
    }
    serde_json::from_str(EMBEDDED).unwrap_or_else(|_| MirrorsManifest {
        version: 1,
        npm_registry: DEFAULT_NPM_REGISTRY.to_string(),
        gitee_release_base: String::new(),
        artifacts: Artifacts::default(),
    })
}

fn mirror_override_path() -> PathBuf {
    vibestart_dir()
        .map(|d| d.join("mirrors.override.json"))
        .unwrap_or_else(|_| PathBuf::from(".vibestart/mirrors.override.json"))
}

pub fn npm_registry() -> String {
    load_mirrors().npm_registry
}

pub fn apply_npm_registry(cmd: &mut Command) {
    let registry = npm_registry();
    cmd.env("npm_config_registry", &registry);
}

pub fn platform_artifact_key() -> &'static str {
    let info = os::detect();
    match info.platform {
        Platform::Windows => "windows_x86_64",
        Platform::Macos if info.arch == "aarch64" => "macos_aarch64",
        Platform::Macos => "macos_x86_64",
        Platform::Unknown => "all",
    }
}

pub fn codex_bridge_prebuilt_url() -> Option<String> {
    let m = load_mirrors();
    if m.gitee_release_base.is_empty() || m.gitee_release_base.contains("YOUR_GITEE_USER") {
        return None;
    }
    let art = &m.artifacts.codex_bridge_prebuilt;
    let file = match platform_artifact_key() {
        "windows_x86_64" => &art.windows_x86_64,
        "macos_aarch64" => &art.macos_aarch64,
        "macos_x86_64" => &art.macos_x86_64,
        _ => return None,
    };
    if file.is_empty() {
        return None;
    }
    Some(format!(
        "{}/{}/{}",
        m.gitee_release_base.trim_end_matches('/'),
        art.tag,
        file
    ))
}

pub fn codex_bridge_source_url() -> Option<String> {
    let m = load_mirrors();
    if m.gitee_release_base.is_empty() || m.gitee_release_base.contains("YOUR_GITEE_USER") {
        return None;
    }
    let art = &m.artifacts.codex_bridge_source;
    if art.all.is_empty() {
        return None;
    }
    Some(format!(
        "{}/{}/{}",
        m.gitee_release_base.trim_end_matches('/'),
        art.tag,
        art.all
    ))
}

pub fn cc_switch_mirror_url() -> Option<String> {
    let m = load_mirrors();
    if m.gitee_release_base.is_empty() || m.gitee_release_base.contains("YOUR_GITEE_USER") {
        return None;
    }
    let art = &m.artifacts.cc_switch;
    let file = match platform_artifact_key() {
        "windows_x86_64" => &art.windows_x86_64,
        "macos_aarch64" | "macos_x86_64" => &art.macos_universal,
        _ => return None,
    };
    if file.is_empty() {
        return None;
    }
    Some(format!(
        "{}/cc-switch-latest/{}",
        m.gitee_release_base.trim_end_matches('/'),
        file
    ))
}

pub fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("下载客户端初始化失败: {e}"))?;

    let mut resp = client
        .get(url)
        .send()
        .map_err(|e| format!("下载失败 ({url}): {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("下载失败 HTTP {}: {url}", resp.status()));
    }

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }

    let mut file =
        fs::File::create(dest).map_err(|e| format!("无法写入 {}: {e}", dest.display()))?;
    resp.copy_to(&mut file)
        .map_err(|e| format!("写入文件失败: {e}"))?;
    Ok(())
}

pub fn extract_zip(archive: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("创建目录失败: {e}"))?;
    let archive_str = archive.to_string_lossy();
    let dest_str = dest.to_string_lossy();

    let output = Command::new("tar")
        .args(["-xf", archive_str.as_ref(), "-C", dest_str.as_ref()])
        .output()
        .map_err(|e| format!("无法执行 tar 解压: {e}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "解压失败: {}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    ))
}
