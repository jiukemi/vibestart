use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use tauri::webview::NewWindowResponse;

use crate::config::{self, BrowserPreset};

const BROWSER_LOADING_SCRIPT: &str = include_str!("browser_loading.js");
const BROWSER_LINK_HANDLER: &str = include_str!("browser_link_handler.js");
const BROWSER_CHROME_SCRIPT: &str = include_str!("browser_chrome.js");

/// 统一内置浏览器窗口（标签页 + 前进后退）
pub const BROWSER_SHELL_LABEL: &str = "vibestart-browser";

/// OAuth / 强依赖系统浏览器 — 必须外开
const EXTERNAL_REQUIRED: &[&str] = &[
    "vercel.com",
    "accounts.google.com",
    "github.com/login",
    "github.com/signup",
    "github.com/sessions",
    "login.live.com",
    "appleid.apple.com",
];

/// 国内可访问、向导内优先应用内打开（保留 Cookie / 少切窗口）
const IN_APP_PREFERRED: &[&str] = &[
    "gitee.com",
    "deepseek.com",
    "platform.deepseek.com",
    "dashscope.aliyuncs.com",
    "dashscope.console.aliyun.com",
    "bigmodel.cn",
    "open.bigmodel.cn",
    "moonshot.cn",
    "platform.moonshot.cn",
    "ccswitch.io",
    "ccswitch.co",
    "cursor.com",
    "trae.ai",
    "codeium.com",
    "windsurf.com",
];

pub fn must_open_externally(url: &str) -> bool {
    let lower = url.to_lowercase();
    EXTERNAL_REQUIRED.iter().any(|host| lower.contains(host))
}

pub fn should_prefer_in_app(url: &str) -> bool {
    if must_open_externally(url) {
        return false;
    }
    let lower = url.to_lowercase();
    if IN_APP_PREFERRED.iter().any(|host| lower.contains(host)) {
        return true;
    }
    !lower.contains("github.com")
}

pub fn stable_browser_label(_url: &str) -> &'static str {
    BROWSER_SHELL_LABEL
}

pub fn current_preset() -> BrowserPreset {
    config::load_config()
        .browser
        .map(|b| b.preset)
        .unwrap_or_default()
}

fn opener_with_for_preset(preset: BrowserPreset) -> Option<&'static str> {
    match preset {
        BrowserPreset::SystemDefault => None,
        BrowserPreset::GoogleChrome => {
            if cfg!(target_os = "macos") {
                Some("Google Chrome")
            } else if cfg!(target_os = "windows") {
                Some("chrome")
            } else {
                None
            }
        }
    }
}

fn in_app_preferred_json() -> String {
    let hosts: Vec<&str> = IN_APP_PREFERRED.to_vec();
    serde_json::to_string(&hosts).unwrap_or_else(|_| "[]".to_string())
}

fn link_handler_script(preset: BrowserPreset, force_in_app: bool) -> String {
    let with = opener_with_for_preset(preset);
    let with_literal = match with {
        Some(name) => format!("\"{}\"", name.replace('\\', "\\\\").replace('"', "\\\"")),
        None => "null".to_string(),
    };
    BROWSER_LINK_HANDLER
        .replace("__VIBESTART_BROWSER_WITH__", &with_literal)
        .replace("__VIBESTART_FORCE_IN_APP__", if force_in_app { "true" } else { "false" })
        .replace("__VIBESTART_IN_APP_PREFERRED__", &in_app_preferred_json())
}

fn build_init_script(preset: BrowserPreset, force_in_app: bool, url: &str) -> String {
    let mut parts = vec![
        BROWSER_LOADING_SCRIPT.to_string(),
        link_handler_script(preset, force_in_app),
        BROWSER_CHROME_SCRIPT.to_string(),
    ];
    if force_in_app && must_open_externally(url) {
        parts.push(include_str!("browser_oauth_hint.js").to_string());
    }
    parts.join("\n")
}

fn chrome_open_url_js(url: &str, title: &str, new_tab: bool) -> Result<String, String> {
    let url_json = serde_json::to_string(url).map_err(|e| e.to_string())?;
    let title_json = serde_json::to_string(title).map_err(|e| e.to_string())?;
    Ok(format!(
        "window.__vibestartBrowserChrome?.openUrl({url_json}, {title_json}, {{ newTab: {new_tab} }});"
    ))
}

fn focus_browser_shell(app: &AppHandle, title: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(BROWSER_SHELL_LABEL) {
        let _ = window.set_title(title);
        let _ = window.set_focus();
    }
    Ok(())
}

pub fn open_external(app: &AppHandle, url: &str) -> Result<(), String> {
    open_external_with_preset(app, url, current_preset())
}

pub fn open_external_with_preset(
    app: &AppHandle,
    url: &str,
    preset: BrowserPreset,
) -> Result<(), String> {
    let parsed: url::Url = url.parse().map_err(|e| format!("无效 URL: {e}"))?;
    let url_str = parsed.as_str();
    let with = opener_with_for_preset(preset);

    if let Some(app_name) = with {
        if app
            .opener()
            .open_url(url_str, Some(app_name))
            .is_ok()
        {
            return Ok(());
        }
        #[cfg(target_os = "windows")]
        if try_open_windows_chrome(app, url_str).is_ok() {
            return Ok(());
        }
    }

    app.opener()
        .open_url(url_str, None::<&str>)
        .map_err(|e| format!("无法在系统浏览器打开: {e}"))
}

#[cfg(target_os = "windows")]
fn try_open_windows_chrome(app: &AppHandle, url: &str) -> Result<(), String> {
    use std::path::PathBuf;

    let local = std::env::var("LOCALAPPDATA").ok();
    let program_files = std::env::var("ProgramFiles").ok();
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(local) = local {
        candidates.push(
            PathBuf::from(local)
                .join("Google")
                .join("Chrome")
                .join("Application")
                .join("chrome.exe"),
        );
    }
    if let Some(pf) = program_files {
        candidates.push(
            PathBuf::from(pf)
                .join("Google")
                .join("Chrome")
                .join("Application")
                .join("chrome.exe"),
        );
    }

    for exe in candidates {
        if exe.is_file() {
            return app
                .opener()
                .open_url(url, Some(exe.to_string_lossy().as_ref()))
                .map_err(|e| format!("无法用 Chrome 打开: {e}"));
        }
    }
    Err("未找到 Chrome".into())
}

#[cfg(not(target_os = "windows"))]
fn try_open_windows_chrome(_app: &AppHandle, _url: &str) -> Result<(), String> {
    Err("非 Windows".into())
}

pub fn open_for_wizard(app: &AppHandle, url: &str, title: &str) -> Result<&'static str, String> {
    if must_open_externally(url) {
        open_external(app, url)?;
        return Ok("external");
    }
    if should_prefer_in_app(url) {
        open_in_app_with_options(app, url, title, BROWSER_SHELL_LABEL, true)?;
        return Ok("in_app");
    }
    open_external(app, url)?;
    Ok("external")
}

fn handle_new_window(app: &AppHandle, url_str: &str, preset: BrowserPreset) {
    if must_open_externally(url_str) {
        let _ = open_external(app, url_str);
        return;
    }
    if should_prefer_in_app(url_str) || !url_str.to_lowercase().contains("github.com") {
        if let Some(window) = app.get_webview_window(BROWSER_SHELL_LABEL) {
            if let Ok(js) = chrome_open_url_js(url_str, "新标签页", true) {
                let _ = window.eval(&js);
                let _ = window.set_focus();
                return;
            }
        }
        let _ = open_in_app_with_options(
            app,
            url_str,
            "VibeStart",
            BROWSER_SHELL_LABEL,
            true,
        );
        return;
    }
    let _ = open_external_with_preset(app, url_str, preset);
}

pub fn open_in_app_with_options(
    app: &AppHandle,
    url: &str,
    title: &str,
    label: &str,
    force_in_app: bool,
) -> Result<(), String> {
    let _ = label;
    if !force_in_app {
        return open_external(app, url);
    }

    if must_open_externally(url) {
        return open_external(app, url);
    }

    let parsed: url::Url = url.parse().map_err(|e| format!("无效 URL: {e}"))?;
    let preset = current_preset();
    let shell_label = BROWSER_SHELL_LABEL;

    if let Some(window) = app.get_webview_window(shell_label) {
        let url_json = serde_json::to_string(url).map_err(|e| e.to_string())?;
        let title_json = serde_json::to_string(title).map_err(|e| e.to_string())?;
        let js = format!(
            "if(window.__vibestartBrowserChrome){{ window.__vibestartBrowserChrome.openUrl({url_json}, {title_json}, {{}}); }} else {{ location.assign({url_json}); }}"
        );
        window
            .eval(&js)
            .map_err(|e| format!("无法导航内置浏览器: {e}"))?;
        let _ = window.set_title(title);
        let _ = window.set_focus();
        return Ok(());
    }

    let init_script = build_init_script(preset, force_in_app, url);
    let app_handle = app.clone();
    let preset_for_links = preset;

    WebviewWindowBuilder::new(app, shell_label, WebviewUrl::External(parsed))
        .title(title)
        .inner_size(1100.0, 800.0)
        .center()
        .initialization_script(&init_script)
        .on_new_window(move |url, _features| {
            handle_new_window(&app_handle, url.as_str(), preset_for_links);
            NewWindowResponse::Deny
        })
        .build()
        .map_err(|e| format!("无法打开内置浏览器: {e}"))?;

    let _ = focus_browser_shell(app, title);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gitee_prefers_in_app() {
        assert!(should_prefer_in_app("https://gitee.com/signup"));
    }

    #[test]
    fn github_oauth_must_external() {
        assert!(must_open_externally("https://github.com/login/oauth"));
    }

    #[test]
    fn deepseek_prefers_in_app() {
        assert!(should_prefer_in_app("https://platform.deepseek.com/api_keys"));
    }

    #[test]
    fn unified_shell_label() {
        assert_eq!(stable_browser_label("https://gitee.com"), BROWSER_SHELL_LABEL);
    }
}
