use crate::codex_bridge::write_agents_md;
use crate::install_progress;
use crate::installer::CommandResult;
use crate::mirrors;
use crate::tools_install::{self, resolve_paths, tools_install_config};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use tauri::AppHandle;

pub const APP_NAME: &str = "Codex";

const GENERAL_SECTION: &str = "[general]";
const DOWNLOAD_MACOS: &str = "https://developers.openai.com/codex/app";
const DOWNLOAD_WINDOWS_MSSTORE: &str =
    "https://apps.microsoft.com/detail/9plm9xgg6vks";

pub fn codex_home() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|h| h.join(".codex"))
        .ok_or_else(|| "无法获取用户主目录".into())
}

pub fn mac_app_path() -> PathBuf {
    PathBuf::from("/Applications/Codex.app")
}

pub fn codex_app_installed() -> bool {
    codex_app_path().is_some()
}

pub fn codex_app_path() -> Option<String> {
    if cfg!(target_os = "macos") {
        if mac_app_path().exists() {
            return Some(mac_app_path().to_string_lossy().into_owned());
        }
        return crate::tools_install::gui_search_roots()
            .into_iter()
            .map(|root| root.join("Codex.app"))
            .find(|p| p.is_dir())
            .map(|p| p.to_string_lossy().into_owned());
    }

    if cfg!(target_os = "windows") {
        return windows_codex_app_path();
    }

    None
}

#[cfg(target_os = "windows")]
fn windows_codex_app_path() -> Option<String> {
    let script = r#"
$pkg = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pkg -and $pkg.InstallLocation) { Write-Output $pkg.InstallLocation }
"#;
    Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

#[cfg(not(target_os = "windows"))]
fn windows_codex_app_path() -> Option<String> {
    None
}

pub fn codex_app_version(app_path: &str) -> Option<String> {
    if cfg!(target_os = "macos") {
        let plist = PathBuf::from(app_path).join("Contents/Info.plist");
        let output = Command::new("/usr/libexec/PlistBuddy")
            .args([
                "-c",
                "Print CFBundleShortVersionString",
                &plist.to_string_lossy(),
            ])
            .output()
            .ok()?;
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !version.is_empty() {
                return Some(version);
            }
        }
    }
    None
}

pub fn install_codex_app(app: Option<&AppHandle>) -> CommandResult {
    let mut log = String::from("【安装 Codex 桌面客户端】\n\n");

    if legacy_codex_cli_installed() && !codex_app_installed() {
        log.push_str(
            "检测到旧版终端 Codex（npm / Homebrew），与桌面客户端不同。\n\
             将安装 Codex.app；成功后自动清理旧终端版。\n\n",
        );
    }

    if codex_app_installed() {
        log.push_str("检测到 Codex 桌面客户端已安装。\n");
        if let Some(path) = codex_app_path() {
            if let Some(version) = codex_app_version(&path) {
                log.push_str(&format!("  路径: {path}\n  版本: {version}\n"));
            } else {
                log.push_str(&format!("  路径: {path}\n"));
            }
        }
        if legacy_codex_cli_installed() {
            log.push_str("\n同时检测到旧版终端 Codex，正在清理…\n");
            remove_legacy_codex_cli(app, &mut log);
        }
        let localize = localize_codex_app_internal();
        log.push_str("\n");
        log.push_str(&localize.log);
        return CommandResult {
            success: localize.success,
            log,
        };
    }

    let install_result = if cfg!(target_os = "macos") {
        install_macos(app, &mut log)
    } else if cfg!(target_os = "windows") {
        install_windows(app, &mut log)
    } else {
        CommandResult {
            success: false,
            log: format!("{log}暂不支持在当前系统一键安装 Codex 桌面客户端。"),
        }
    };

    log.push_str(&install_result.log);

    if codex_app_installed() {
        let localize = localize_codex_app_internal();
        log.push_str("\n\n");
        log.push_str(&localize.log);
        let _ = remove_legacy_codex_cli(app, &mut log);
        return CommandResult {
            success: localize.success,
            log,
        };
    }

    CommandResult {
        success: false,
        log,
    }
}

fn legacy_npm_codex_paths(prefix: &Path) -> Vec<PathBuf> {
    vec![
        prefix.join("lib/node_modules/@openai/codex"),
        prefix.join("node_modules/@openai/codex"),
        tools_install::npm_bin_dir(prefix).join("codex"),
    ]
}

/// 旧版 npm / Homebrew `codex` 终端 CLI（不含 Codex.app 桌面客户端）
pub fn legacy_codex_cli_installed() -> bool {
    if tools_install::resolve_command_in_prefix("codex").is_some() {
        return true;
    }
    let prefix = resolve_paths(&tools_install_config()).npm_prefix;
    if legacy_npm_codex_paths(&prefix)
        .into_iter()
        .any(|p| p.exists())
    {
        return true;
    }
    brew_cask_cli_installed()
}

#[cfg(target_os = "macos")]
fn brew_cask_cli_installed() -> bool {
    Command::new("brew")
        .args(["list", "--cask", "codex"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
fn brew_cask_cli_installed() -> bool {
    false
}

pub fn remove_legacy_codex_cli(app: Option<&AppHandle>, log: &mut String) -> bool {
    let mut removed = false;

    if cfg!(target_os = "macos") && brew_cask_cli_installed() {
        log.push_str("移除 Homebrew 旧版 codex（终端 CLI cask）…\n");
        let result = run_logged_command(app, "brew", &["uninstall", "--cask", "codex"], log);
        removed |= result.success || !brew_cask_cli_installed();
    }

    let prefix = resolve_paths(&tools_install_config()).npm_prefix;
    let had_npm_legacy = legacy_npm_codex_paths(&prefix)
        .into_iter()
        .any(|p| p.exists());

    if had_npm_legacy {
        log.push_str(&format!(
            "移除 npm 旧版 @openai/codex（{}）…\n",
            prefix.display()
        ));
        removed |= npm_uninstall_codex(app, &prefix, true, log);
        removed |= npm_uninstall_codex(app, &prefix, false, log);
        removed |= !legacy_npm_codex_paths(&prefix)
            .into_iter()
            .any(|p| p.exists());
    }

    if cfg!(target_os = "windows") {
        log.push_str("尝试移除 Windows 旧版 Codex CLI（OpenAI.Codex）…\n");
        let result = run_logged_command(
            app,
            "winget",
            &["uninstall", "-e", "--id", "OpenAI.Codex"],
            log,
        );
        removed |= result.success;
    }

    if removed {
        log.push_str("✓ 旧版终端 Codex 已清理\n");
    }
    removed
}

fn npm_uninstall_codex(
    app: Option<&AppHandle>,
    prefix: &Path,
    global: bool,
    log: &mut String,
) -> bool {
    let prefix_str = prefix.to_string_lossy();
    let mut args = vec!["uninstall", "--prefix", prefix_str.as_ref()];
    if global {
        args.push("-g");
    }
    args.push("@openai/codex");

    install_progress::emit(app, "run", "正在卸载 npm 旧版 @openai/codex…", Some(20));
    let mut cmd = Command::new("npm");
    cmd.args(&args);
    mirrors::apply_npm_registry(&mut cmd);
    log.push_str(&format!("$ npm {}\n", args.join(" ")));
    match cmd.output() {
        Ok(output) => {
            log.push_str(&format!(
                "{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            ));
            output.status.success()
        }
        Err(e) => {
            log.push_str(&format!("无法执行 npm: {e}\n"));
            false
        }
    }
}

pub fn uninstall_codex_app(app: Option<&AppHandle>) -> CommandResult {
    let mut log = String::from("【卸载 Codex】\n\n");

    if codex_app_installed() {
        if cfg!(target_os = "macos") {
            log.push_str("卸载 Codex 桌面客户端（codex-app）…\n");
            let result =
                run_logged_command(app, "brew", &["uninstall", "--cask", "codex-app"], &mut log);
            if !result.success && mac_app_path().exists() {
                log.push_str("brew 未能移除，尝试删除 /Applications/Codex.app …\n");
                if fs::remove_dir_all(mac_app_path()).is_ok() {
                    log.push_str("✓ 已删除 /Applications/Codex.app\n");
                }
            }
        } else if cfg!(target_os = "windows") {
            log.push_str("请在「设置 → 应用」或 Microsoft Store 卸载 Codex 桌面客户端。\n");
        }
    } else {
        log.push_str("未检测到 Codex 桌面客户端（Codex.app）。\n");
    }

    if legacy_codex_cli_installed() {
        log.push_str("\n");
        remove_legacy_codex_cli(app, &mut log);
    } else {
        log.push_str("\n未检测到旧版终端 Codex。\n");
    }

    let clean = !codex_app_installed() && !legacy_codex_cli_installed();
    if clean {
        log.push_str("\n✓ Codex 已完全卸载（桌面客户端 + 旧终端版）\n");
    } else if !codex_app_installed() && legacy_codex_cli_installed() {
        log.push_str("\n⚠ 仍有旧版终端 Codex 残留，请查看上方日志或手动删除 ~/.vibestart/tools/npm\n");
    }

    CommandResult {
        success: clean,
        log,
    }
}

pub fn upgrade_codex_app(app: Option<&AppHandle>) -> CommandResult {
    let mut log = String::from("【更新 Codex 桌面客户端】\n\n");
    install_progress::emit(app, "run", "正在检查 Codex 更新…", Some(10));
    let result = if cfg!(target_os = "macos") {
        run_logged_command(app, "brew", &["upgrade", "--cask", "codex-app"], &mut log)
    } else if cfg!(target_os = "windows") {
        run_logged_command(
            app,
            "winget",
            &[
                "upgrade",
                "--id",
                "9PLM9XGG6VKS",
                "--source",
                "msstore",
                "--accept-source-agreements",
                "--accept-package-agreements",
            ],
            &mut log,
        )
    } else {
        CommandResult {
            success: false,
            log: format!("{log}暂不支持在当前系统更新 Codex。"),
        }
    };

    log.push_str(&result.log);
    if codex_app_installed() {
        let localize = localize_codex_app_internal();
        log.push_str("\n\n");
        log.push_str(&localize.log);
        CommandResult {
            success: localize.success,
            log,
        }
    } else {
        CommandResult {
            success: result.success && codex_app_installed(),
            log,
        }
    }
}

pub fn localize_codex_app() -> CommandResult {
    localize_codex_app_internal()
}

fn localize_codex_app_internal() -> CommandResult {
    let home = match codex_home() {
        Ok(h) => h,
        Err(e) => {
            return CommandResult {
                success: false,
                log: e,
            };
        }
    };

    if let Err(e) = fs::create_dir_all(&home) {
        return CommandResult {
            success: false,
            log: format!("创建 ~/.codex 失败: {e}"),
        };
    }

    let mut details = Vec::new();

    match refresh_codex_locale(&home, true) {
        Ok(removed) if !removed.is_empty() => {
            details.push(format!("✓ 已清除语言缓存: {}", removed.join("、")));
        }
        Ok(_) => details.push("✓ 已刷新中文界面配置".into()),
        Err(e) => {
            return CommandResult {
                success: false,
                log: format!("Codex 汉化失败: {e}"),
            };
        }
    }

    if let Err(e) = write_agents_md(&home) {
        details.push(format!("⚠ AGENTS.md 未更新: {e}"));
    } else {
        details.push("✓ 已写入 AGENTS.md（中文协作偏好）".into());
    }

    CommandResult {
        success: true,
        log: format!(
            "【Codex 一键汉化】\n\n{}\n\n\
             已写入：\n\
             · config.toml [general] + [desktop] localeOverride\n\
             · .codex-global-state.json + computer-use/config.json\n\
             · AGENTS.md / developer_instructions（AI 中文回复）\n\n\
             请 Cmd+Q 完全退出 Codex 后重新打开。\n\
             若菜单仍为英文：Codex → 设置 → General → Language → 中文（中国）。\n\
             界面汉化需联网；AI 对话中文不受界面语言影响。",
            details.join("\n")
        ),
    }
}

pub fn merge_general_locale(codex_home: &Path) -> Result<PathBuf, String> {
    let config_path = codex_home.join("config.toml");
    let existing = fs::read_to_string(&config_path).unwrap_or_default();
    let merged = normalize_codex_config(&upsert_desktop_section(&upsert_general_section(&existing)));
    fs::write(&config_path, merged)
        .map_err(|e| format!("写入 {} 失败: {e}", config_path.display()))?;
    merge_global_state_locale(codex_home)?;
    merge_computer_use_locale(codex_home)?;
    Ok(config_path)
}

/// Full locale refresh including Electron UI cache (for「一键汉化」).
pub fn refresh_codex_locale(codex_home: &Path, clear_electron_cache: bool) -> Result<Vec<String>, String> {
    merge_general_locale(codex_home)?;
    let mut notes = clear_locale_cache(codex_home).unwrap_or_default();
    if clear_electron_cache {
        notes.extend(clear_electron_ui_cache()?);
    }
    Ok(notes)
}

/// Locale + auth preamble only. `model` / `model_provider` must be written separately at root.
pub fn codex_locale_sections() -> &'static str {
    r#"[general]
language = "zh-CN"
localeOverride = "zh-CN"
enable_i18n = true

[desktop]
localeOverride = "zh-CN"

"#
}

pub fn general_locale_prefix() -> &'static str {
    r#"cli_auth_credentials_store = "file"

"#
}

const ROUTING_KEYS: &[&str] = &[
    "model",
    "model_provider",
    "developer_instructions",
    "cli_auth_credentials_store",
];

fn parse_quoted_toml_value(raw: &str) -> String {
    let v = raw.trim();
    if (v.starts_with('"') && v.ends_with('"')) || (v.starts_with('\'') && v.ends_with('\'')) {
        v[1..v.len() - 1].to_string()
    } else {
        v.to_string()
    }
}

/// Ensure model routing keys live at config root, not under `[desktop]` / `[general]`.
pub fn normalize_codex_config(content: &str) -> String {
    let mut model: Option<String> = None;
    let mut model_provider: Option<String> = None;
    let mut developer_instructions: Option<String> = None;
    let mut cli_auth: Option<String> = None;
    let mut body_lines: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('[') {
            body_lines.push(line.to_string());
            continue;
        }
        if let Some((key, value)) = trimmed.split_once('=').map(|(k, v)| (k.trim(), v.trim())) {
            match key {
                "model" => {
                    model = Some(parse_quoted_toml_value(value));
                    continue;
                }
                "model_provider" => {
                    model_provider = Some(parse_quoted_toml_value(value));
                    continue;
                }
                "developer_instructions" => {
                    developer_instructions = Some(line.to_string());
                    continue;
                }
                "cli_auth_credentials_store" => {
                    cli_auth = Some(line.to_string());
                    continue;
                }
                _ => {}
            }
        }
        body_lines.push(line.to_string());
    }

    let mut head = vec![
        cli_auth.unwrap_or_else(|| r#"cli_auth_credentials_store = "file"#.to_string()),
    ];
    if let Some(m) = model {
        head.push(format!("model = \"{m}\""));
    }
    if let Some(p) = model_provider {
        head.push(format!("model_provider = \"{p}\""));
    }
    if let Some(d) = developer_instructions {
        head.push(d);
    }
    head.push(String::new());
    head.extend(body_lines);
    format!("{}\n", head.join("\n").trim_end())
}

const PRESERVED_SECTION_PREFIXES: &[&str] = &[
    "[projects.",
    "[plugins.",
    "[mcp_servers.",
    "[features]",
    "[marketplaces.",
];

/// Keep Codex user/project sections when rewriting routing config on sync.
pub fn extract_codex_preserved_sections(content: &str) -> String {
    let mut preserved: Vec<String> = Vec::new();
    let mut current: Vec<String> = Vec::new();
    let mut in_preserved = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if in_preserved && !current.is_empty() {
                preserved.push(current.join("\n"));
            }
            current.clear();
            in_preserved = PRESERVED_SECTION_PREFIXES
                .iter()
                .any(|p| trimmed.starts_with(p));
            if in_preserved {
                current.push(line.to_string());
            }
            continue;
        }
        if trimmed.starts_with("notify =") {
            if in_preserved && !current.is_empty() {
                preserved.push(current.join("\n"));
            }
            current = vec![line.to_string()];
            in_preserved = true;
            continue;
        }
        if in_preserved {
            current.push(line.to_string());
        }
    }
    if in_preserved && !current.is_empty() {
        preserved.push(current.join("\n"));
    }
    preserved.join("\n\n")
}

fn load_codex_dotenv(codex_home: &Path) -> Vec<(String, String)> {
    let path = codex_home.join(".env");
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    raw.lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }
            let (key, value) = line.split_once('=')?;
            Some((key.trim().to_string(), value.trim().to_string()))
        })
        .collect()
}

const DESKTOP_SECTION: &str = "[desktop]";
const GENERAL_KEYS: &[&str] = &["language", "localeOverride", "enable_i18n"];
const DESKTOP_KEYS: &[&str] = &["localeOverride"];

fn is_general_section_line(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return true;
    }
    GENERAL_KEYS
        .iter()
        .any(|key| trimmed.starts_with(&format!("{key} =")) || trimmed.starts_with(&format!("{key}=")))
}

fn upsert_general_section(content: &str) -> String {
    if !content.contains(GENERAL_SECTION) {
        return format!("{}{}", codex_locale_sections(), content.trim_start());
    }

    let mut lines: Vec<String> = content.lines().map(String::from).collect();
    let general_idx = lines
        .iter()
        .position(|l| l.trim() == GENERAL_SECTION)
        .unwrap_or(0);
    let mut end = general_idx + 1;
    while end < lines.len() {
        let trimmed = lines[end].trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            break;
        }
        if !is_general_section_line(&lines[end]) {
            break;
        }
        end += 1;
    }

    let replacement = vec![
        GENERAL_SECTION.to_string(),
        "language = \"zh-CN\"".to_string(),
        "localeOverride = \"zh-CN\"".to_string(),
        "enable_i18n = true".to_string(),
    ];
    lines.splice(general_idx..end, replacement);
    format!("{}\n", lines.join("\n").trim_end())
}

fn is_desktop_section_line(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return true;
    }
    DESKTOP_KEYS
        .iter()
        .any(|key| trimmed.starts_with(&format!("{key} =")) || trimmed.starts_with(&format!("{key}=")))
}

fn upsert_desktop_section(content: &str) -> String {
    if !content.contains(DESKTOP_SECTION) {
        let insert = "[desktop]\nlocaleOverride = \"zh-CN\"\n\n";
        if content.contains(GENERAL_SECTION) {
            let mut lines: Vec<String> = content.lines().map(String::from).collect();
            let general_idx = lines
                .iter()
                .position(|l| l.trim() == GENERAL_SECTION)
                .unwrap_or(0);
            let mut end = general_idx + 1;
            while end < lines.len() {
                let trimmed = lines[end].trim();
                if trimmed.starts_with('[') && trimmed.ends_with(']') {
                    break;
                }
                if !is_general_section_line(&lines[end]) {
                    break;
                }
                end += 1;
            }
            lines.insert(end, String::new());
            lines.insert(end + 1, "[desktop]".into());
            lines.insert(end + 2, "localeOverride = \"zh-CN\"".into());
            return format!("{}\n", lines.join("\n").trim_end());
        }
        return format!("{insert}{}", content.trim_start());
    }

    let mut lines: Vec<String> = content.lines().map(String::from).collect();
    let desktop_idx = lines
        .iter()
        .position(|l| l.trim() == DESKTOP_SECTION)
        .unwrap_or(0);
    let mut end = desktop_idx + 1;
    while end < lines.len() {
        let trimmed = lines[end].trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            break;
        }
        if !is_desktop_section_line(&lines[end]) {
            break;
        }
        end += 1;
    }

    let replacement = vec![
        DESKTOP_SECTION.to_string(),
        "localeOverride = \"zh-CN\"".to_string(),
    ];
    lines.splice(desktop_idx..end, replacement);
    format!("{}\n", lines.join("\n").trim_end())
}

fn merge_global_state_locale(codex_home: &Path) -> Result<(), String> {
    let path = codex_home.join(".codex-global-state.json");
    let mut state: serde_json::Map<String, serde_json::Value> = if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    state.insert(
        "localeOverride".into(),
        serde_json::Value::String("zh-CN".into()),
    );

    let backup = codex_home.join(".codex-global-state.json.bak");
    if path.exists() {
        let _ = fs::copy(&path, &backup);
    }

    let serialized = serde_json::to_string_pretty(&serde_json::Value::Object(state))
        .map_err(|e| format!("序列化 global state 失败: {e}"))?;
    fs::write(&path, format!("{serialized}\n"))
        .map_err(|e| format!("写入 {} 失败: {e}", path.display()))?;
    Ok(())
}

fn merge_computer_use_locale(codex_home: &Path) -> Result<(), String> {
    let path = codex_home.join("computer-use").join("config.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建 {} 失败: {e}", parent.display()))?;
    }

    let mut state: serde_json::Map<String, serde_json::Value> = if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    state.insert(
        "locale".into(),
        serde_json::Value::String("zh-CN".into()),
    );
    if !state.contains_key("direction") {
        state.insert("direction".into(), serde_json::Value::String("ltr".into()));
    }

    let serialized = serde_json::to_string_pretty(&serde_json::Value::Object(state))
        .map_err(|e| format!("序列化 computer-use config 失败: {e}"))?;
    fs::write(&path, format!("{serialized}\n"))
        .map_err(|e| format!("写入 {} 失败: {e}", path.display()))?;
    Ok(())
}

fn clear_electron_ui_cache() -> Result<Vec<String>, String> {
    let mut removed = Vec::new();
    let candidates = electron_ui_cache_dirs();
    for path in candidates {
        if path.exists() {
            if path.is_dir() {
                fs::remove_dir_all(&path)
                    .map_err(|e| format!("无法删除 {}: {e}", path.display()))?;
            } else {
                fs::remove_file(&path)
                    .map_err(|e| format!("无法删除 {}: {e}", path.display()))?;
            }
            removed.push(path.display().to_string());
        }
    }
    Ok(removed)
}

fn electron_ui_cache_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if cfg!(target_os = "macos") {
        if let Some(base) = dirs::data_dir().map(|d| d.join("Codex").join("Default")) {
            for name in ["Cache", "Code Cache", "GPUCache"] {
                dirs.push(base.join(name));
            }
        }
    }
    if cfg!(target_os = "windows") {
        if let Some(local) = dirs::data_local_dir() {
            let packages = local.join("Packages");
            if packages.is_dir() {
                if let Ok(entries) = fs::read_dir(packages) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        if name.starts_with("OpenAI.Codex") {
                            let base = entry.path().join("LocalCache");
                            for sub in ["Local", "Roaming"] {
                                dirs.push(base.join(&sub).join("Cache"));
                            }
                        }
                    }
                }
            }
        }
    }
    dirs
}

/// Bundled `codex` CLI inside Codex.app (used for API Key login).
pub fn codex_cli_path() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        let candidates = [
            mac_app_path().join("Contents/Resources/codex"),
            codex_app_path()
                .map(PathBuf::from)
                .map(|p| p.join("Contents/Resources/codex"))
                .unwrap_or_default(),
        ];
        return candidates.into_iter().find(|p| p.is_file());
    }

    if cfg!(target_os = "windows") {
        if let Some(install) = windows_codex_app_path() {
            let cli = PathBuf::from(install).join("codex.exe");
            if cli.is_file() {
                return Some(cli);
            }
        }
    }

    which_codex_cli()
}

fn which_codex_cli() -> Option<PathBuf> {
    let cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    Command::new(cmd)
        .arg("codex")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.lines().next().unwrap_or("").trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
}

pub fn write_auth_json(codex_home: &Path, api_key: &str) -> Result<(), String> {
    let auth_path = codex_home.join("auth.json");
    let body = serde_json::json!({
        "auth_mode": "apikey",
        "OPENAI_API_KEY": api_key,
    });
    let serialized = serde_json::to_string_pretty(&body)
        .map_err(|e| format!("序列化 auth.json 失败: {e}"))?;
    fs::write(&auth_path, format!("{serialized}\n"))
        .map_err(|e| format!("写入 {} 失败: {e}", auth_path.display()))?;
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(&auth_path)
            .map_err(|e| format!("读取 auth.json 权限失败: {e}"))?
            .permissions();
        perms.set_mode(0o600);
        fs::set_permissions(&auth_path, perms)
            .map_err(|e| format!("设置 auth.json 权限失败: {e}"))?;
    }
    Ok(())
}

/// Cache API Key login via bundled Codex CLI; falls back to writing auth.json.
pub fn login_codex_with_api_key(codex_home: &Path, api_key: &str) -> Result<String, String> {
    if let Some(cli) = codex_cli_path() {
        let mut child = Command::new(&cli)
            .args(["login", "--with-api-key"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动 Codex 登录失败: {e}"))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(api_key.as_bytes())
                .map_err(|e| format!("写入 API Key 失败: {e}"))?;
        }
        let output = child
            .wait_with_output()
            .map_err(|e| format!("等待 Codex 登录失败: {e}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let _stderr = String::from_utf8_lossy(&output.stderr);
        if output.status.success() || stdout.contains("Successfully logged in") {
            return Ok(format!(
                "已通过 Codex CLI 写入 API Key 登录（{}）",
                cli.display()
            ));
        }
    }

    write_auth_json(codex_home, api_key)?;
    Ok("已写入 ~/.codex/auth.json（API Key 登录）".into())
}

pub fn clear_locale_cache(codex_home: &Path) -> Result<Vec<String>, String> {
    let mut removed = Vec::new();
    for name in ["cache", "webviewCache", "locales"] {
        let path = codex_home.join(name);
        if path.exists() {
            fs::remove_dir_all(&path).map_err(|e| format!("无法删除 {}: {e}", path.display()))?;
            removed.push(name.to_string());
        }
    }
    Ok(removed)
}

fn install_macos(app: Option<&AppHandle>, log: &mut String) -> CommandResult {
    log.push_str("1/3 尝试 Homebrew 安装 codex-app…\n");
    install_progress::emit(app, "run", "正在通过 Homebrew 安装 Codex…", Some(20));
    let brew = run_logged_command(app, "brew", &["install", "--cask", "codex-app"], log);
    if codex_app_installed() {
        return brew;
    }

    log.push_str("\n2/3 Homebrew 未成功，尝试 Gitee 镜像…\n");
    if try_install_from_mirror(app, log) && codex_app_installed() {
        return CommandResult {
            success: true,
            log: String::new(),
        };
    }

    log.push_str("\n3/3 打开官方下载页（需可访问外网或使用代理）…\n");
    let opened = open_url(DOWNLOAD_MACOS);
    let network_note = "若 Homebrew / 镜像均失败，多为网络限制。可：\n\
         · 在 VibeStart 内置浏览器打开下载页完成安装\n\
         · 配置代理后重试一键安装\n\
         · 联系管理员上传 Codex.dmg 到 Gitee 镜像（见 docs/MIRRORS.md）";
    CommandResult {
        success: false,
        log: format!(
            "{}\n\n{network_note}",
            if opened {
                format!("已在浏览器打开：{DOWNLOAD_MACOS}")
            } else {
                format!("请手动访问：{DOWNLOAD_MACOS}")
            }
        ),
    }
}

fn install_windows(app: Option<&AppHandle>, log: &mut String) -> CommandResult {
    log.push_str("1/2 尝试 Microsoft Store（winget）安装…\n");
    install_progress::emit(app, "run", "正在通过 Microsoft Store 安装 Codex…", Some(20));
    let winget = run_logged_command(
        app,
        "winget",
        &[
            "install",
            "--id",
            "9PLM9XGG6VKS",
            "--source",
            "msstore",
            "--accept-source-agreements",
            "--accept-package-agreements",
        ],
        log,
    );
    if codex_app_installed() {
        return winget;
    }

    log.push_str("\n2/2 打开 Microsoft Store 下载页…\n");
    let opened = open_url(DOWNLOAD_WINDOWS_MSSTORE);
    CommandResult {
        success: false,
        log: format!(
            "{}\n\n若 winget 失败，请在 Microsoft Store 搜索 Codex 安装，或配置网络代理后重试。",
            if opened {
                format!("已在浏览器打开：{DOWNLOAD_WINDOWS_MSSTORE}")
            } else {
                format!("请手动访问：{DOWNLOAD_WINDOWS_MSSTORE}")
            }
        ),
    }
}

fn try_install_from_mirror(app: Option<&AppHandle>, log: &mut String) -> bool {
    let Some(url) = mirrors::codex_app_mirror_url() else {
        log.push_str("未配置 Gitee Codex 镜像（mirrors.json → artifacts.codex_app）。\n");
        return false;
    };

    let temp = std::env::temp_dir().join("vibestart-codex-app.dmg");
    log.push_str(&format!("下载镜像: {url}\n"));
    if let Err(e) = mirrors::download_file(app, &url, &temp) {
        log.push_str(&format!("镜像下载失败: {e}\n"));
        let _ = fs::remove_file(&temp);
        return false;
    }

    install_progress::emit(app, "install", "正在挂载安装包…", Some(92));
    let mount = std::env::temp_dir().join("vibestart-codex-mount");
    let _ = fs::remove_dir_all(&mount);
    let attach = Command::new("hdiutil")
        .args([
            "attach",
            "-nobrowse",
            "-quiet",
            "-mountpoint",
            &mount.to_string_lossy(),
            &temp.to_string_lossy(),
        ])
        .output();

    let attached = match attach {
        Ok(o) if o.status.success() => true,
        Ok(o) => {
            log.push_str(&format!(
                "挂载 DMG 失败: {}{}\n",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr)
            ));
            false
        }
        Err(e) => {
            log.push_str(&format!("无法执行 hdiutil: {e}\n"));
            false
        }
    };

    if !attached {
        let _ = fs::remove_file(&temp);
        return false;
    }

    let src = mount.join("Codex.app");
    let dest = mac_app_path();
    let copied = if src.is_dir() {
        if dest.exists() {
            let _ = fs::remove_dir_all(&dest);
        }
        copy_dir_recursive(&src, &dest).is_ok()
    } else {
        log.push_str("镜像 DMG 内未找到 Codex.app。\n");
        false
    };

    let _ = Command::new("hdiutil")
        .args(["detach", &mount.to_string_lossy(), "-quiet"])
        .status();
    let _ = fs::remove_file(&temp);
    let _ = fs::remove_dir_all(&mount);

    if copied {
        install_progress::emit(app, "install", "Codex.app 已复制到应用程序文件夹", Some(99));
        log.push_str(&format!("已从镜像安装到 {}\n", dest.display()));
    }
    copied
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        let target = dest.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn run_logged_command(
    app: Option<&AppHandle>,
    program: &str,
    args: &[&str],
    log: &mut String,
) -> CommandResult {
    install_progress::emit(
        app,
        "run",
        &format!("正在执行 {program} {}…", args.join(" ")),
        None,
    );
    log.push_str(&format!("$ {program} {}\n", args.join(" ")));
    match Command::new(program).args(args).output() {
        Ok(output) => {
            let body = format!(
                "{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            log.push_str(&body);
            if !body.ends_with('\n') {
                log.push('\n');
            }
            CommandResult {
                success: output.status.success(),
                log: String::new(),
            }
        }
        Err(error) => CommandResult {
            success: false,
            log: format!("无法执行 {program}: {error}\n"),
        },
    }
}

fn open_url(url: &str) -> bool {
    if cfg!(target_os = "macos") {
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
    }
}

pub fn launch_codex_app(project_dir: Option<&str>) -> Result<(), String> {
    if !codex_app_installed() {
        return Err(
            "未检测到 Codex 桌面客户端。请在一键安装 Codex 或从官方下载页安装。".into(),
        );
    }

    let codex_home = codex_home()?;
    let env_vars = load_codex_dotenv(&codex_home);

    if cfg!(target_os = "macos") {
        let app = codex_app_path()
            .map(PathBuf::from)
            .unwrap_or_else(mac_app_path);
        let mut cmd = Command::new("env");
        cmd.arg("ELECTRON_LOCALE_OVERRIDE=zh-CN")
            .arg("LANG=zh_CN.UTF-8")
            .arg("LC_ALL=zh_CN.UTF-8");
        for (key, value) in &env_vars {
            cmd.arg(format!("{key}={value}"));
        }
        cmd.arg("open").arg("-a").arg(app);
        if let Some(dir) = project_dir.filter(|d| !d.trim().is_empty()) {
            cmd.arg(dir);
        }
        return cmd
            .status()
            .map(|s| {
                if s.success() {
                    Ok(())
                } else {
                    Err("无法启动 Codex 桌面客户端".into())
                }
            })
            .map_err(|e| format!("无法启动 Codex: {e}"))?;
    }

    if cfg!(target_os = "windows") {
        let env_lines: String = [
            ("ELECTRON_LOCALE_OVERRIDE", "zh-CN"),
            ("LANG", "zh_CN.UTF-8"),
            ("LC_ALL", "zh_CN.UTF-8"),
        ]
        .iter()
        .map(|(k, v)| format!("$env:{k}='{v}'"))
        .chain(
            env_vars
                .iter()
                .map(|(k, v)| format!("$env:{k}='{}'", v.replace('\'', "''"))),
        )
        .collect::<Vec<_>>()
        .join("\n");
        if let Some(dir) = project_dir.filter(|d| !d.trim().is_empty()) {
            let script = format!(
                r#"
{env_lines}
$pkg = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pkg) {{ exit 1 }}
Start-Process "shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App"
Set-Location -LiteralPath '{}'
"#,
                dir.replace('\'', "''")
            );
            if Command::new("powershell")
                .args(["-NoProfile", "-Command", &script])
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
            {
                return Ok(());
            }
        }
        let script = format!(
            r#"
{env_lines}
Start-Process "shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App"
"#
        );
        return Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("无法启动 Codex: {e}"));
    }

    Err("当前系统暂不支持启动 Codex 桌面客户端".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upsert_general_adds_section_when_missing() {
        let out = upsert_general_section("model = \"gpt\"\n");
        assert!(out.contains("language = \"zh-CN\""));
        assert!(out.contains("enable_i18n = true"));
        assert!(out.contains("model = \"gpt\""));
    }

    #[test]
    fn upsert_general_replaces_existing_section() {
        let input = "[general]\nlanguage = \"en-US\"\n\nmodel = \"x\"\nmodel_provider = \"deepseek\"\n";
        let out = upsert_general_section(input);
        assert!(out.contains("language = \"zh-CN\""));
        assert!(!out.contains("en-US"));
        assert!(out.contains("model = \"x\""));
        assert!(out.contains("model_provider = \"deepseek\""));
    }

    #[test]
    fn upsert_desktop_adds_locale_override() {
        let input = "[general]\nlanguage = \"zh-CN\"\n\nmodel = \"gpt\"\n";
        let out = upsert_desktop_section(&upsert_general_section(input));
        assert!(out.contains("[desktop]"));
        assert!(out.contains("localeOverride = \"zh-CN\""));
        assert!(out.contains("model = \"gpt\""));
    }

    #[test]
    fn normalize_moves_model_out_of_desktop_section() {
        let input = r#"[desktop]
localeOverride = "zh-CN"
model = "deepseek-v4-pro"
model_provider = "deepseek"

[model_providers.deepseek]
name = "x"
"#;
        let out = normalize_codex_config(input);
        assert!(out.lines().nth(1).unwrap_or("").starts_with("model = "));
        let desktop_pos = out.find("[desktop]").unwrap_or(0);
        assert!(!out[desktop_pos..].contains("model_provider = "));
    }
}
