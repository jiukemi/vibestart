use serde::Serialize;
use std::process::Command;

use crate::config::{load_config, save_config, NetworkConfig};

#[derive(Debug, Serialize, Clone)]
pub struct DetectedProxy {
    pub source: String,
    pub http_proxy: Option<String>,
    pub socks_proxy: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GithubConnectivity {
    pub reachable: bool,
    pub latency_ms: Option<u64>,
    pub message: String,
    pub detected_proxies: Vec<DetectedProxy>,
}

#[derive(Debug, Serialize, Clone)]
pub struct NetworkStatus {
    pub config: NetworkConfig,
    pub detected_proxies: Vec<DetectedProxy>,
    pub git_proxy_applied: Option<String>,
}

pub fn get_network_status() -> NetworkStatus {
    let config = load_config()
        .network
        .unwrap_or_default();
    let detected = detect_proxies();
    let git_proxy_applied = read_git_http_proxy();

    NetworkStatus {
        config,
        detected_proxies: detected,
        git_proxy_applied,
    }
}

pub fn save_network_config(config: NetworkConfig) -> Result<(), String> {
    let mut app = load_config();
    app.network = Some(config);
    save_config(&app)
}

pub fn detect_proxies() -> Vec<DetectedProxy> {
    let mut found = Vec::new();

    if let Some(http) = std::env::var("HTTPS_PROXY")
        .ok()
        .or_else(|| std::env::var("https_proxy").ok())
        .or_else(|| std::env::var("HTTP_PROXY").ok())
        .or_else(|| std::env::var("http_proxy").ok())
    {
        found.push(DetectedProxy {
            source: "环境变量".into(),
            http_proxy: Some(http.clone()),
            socks_proxy: std::env::var("ALL_PROXY")
                .ok()
                .or_else(|| std::env::var("all_proxy").ok()),
        });
    }

    #[cfg(target_os = "macos")]
    if let Some(mac) = detect_macos_proxy() {
        found.push(mac);
    }

    #[cfg(target_os = "windows")]
    if let Some(win) = detect_windows_proxy() {
        found.push(win);
    }

    found
}

#[cfg(target_os = "macos")]
fn detect_macos_proxy() -> Option<DetectedProxy> {
    let output = Command::new("scutil").arg("--proxy").output().ok()?;
    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut http_enabled = false;
    let mut http_host = None;
    let mut http_port: Option<u16> = None;
    let mut socks_enabled = false;
    let mut socks_host = None;
    let mut socks_port: Option<u16> = None;

    for line in text.lines() {
        let line = line.trim();
        if line.starts_with("HTTPEnable") {
            http_enabled = line.contains(": 1");
        } else if line.starts_with("HTTPProxy") {
            http_host = line.split(':').nth(1).map(|s| s.trim().to_string());
        } else if line.starts_with("HTTPPort") {
            http_port = line.split(':').nth(1).and_then(|s| s.trim().parse().ok());
        } else if line.starts_with("SOCKSEnable") {
            socks_enabled = line.contains(": 1");
        } else if line.starts_with("SOCKSProxy") {
            socks_host = line.split(':').nth(1).map(|s| s.trim().to_string());
        } else if line.starts_with("SOCKSPort") {
            socks_port = line.split(':').nth(1).and_then(|s| s.trim().parse().ok());
        }
    }

    let http_proxy = if http_enabled {
        match (http_host, http_port) {
            (Some(host), Some(port)) => Some(format!("http://{host}:{port}")),
            _ => None,
        }
    } else {
        None
    };

    let socks_proxy = if socks_enabled {
        match (socks_host, socks_port) {
            (Some(host), Some(port)) => Some(format!("{host}:{port}")),
            _ => None,
        }
    } else {
        None
    };

    if http_proxy.is_none() && socks_proxy.is_none() {
        return None;
    }

    Some(DetectedProxy {
        source: "macOS 系统代理".into(),
        http_proxy,
        socks_proxy,
    })
}

#[cfg(not(target_os = "macos"))]
fn detect_macos_proxy() -> Option<DetectedProxy> {
    None
}

#[cfg(target_os = "windows")]
fn detect_windows_proxy() -> Option<DetectedProxy> {
    let enable = reg_query_u32(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        "ProxyEnable",
    )?;
    if enable != 1 {
        return None;
    }

    let server = reg_query_string(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        "ProxyServer",
    )?;

    if server.trim().is_empty() {
        return None;
    }

    let http_proxy = if server.contains('=') {
        server
            .split(';')
            .find_map(|part| {
                let (scheme, addr) = part.split_once('=')?;
                if scheme.eq_ignore_ascii_case("http") {
                    Some(normalize_windows_proxy_addr(addr))
                } else {
                    None
                }
            })
            .or_else(|| {
                server
                    .split(';')
                    .next()
                    .map(normalize_windows_proxy_addr)
            })
    } else {
        Some(normalize_windows_proxy_addr(&server))
    };

    http_proxy.map(|http| DetectedProxy {
        source: "Windows 系统代理".into(),
        http_proxy: Some(http),
        socks_proxy: None,
    })
}

#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
fn detect_windows_proxy() -> Option<DetectedProxy> {
    None
}

#[cfg(target_os = "windows")]
fn reg_query_u32(key: &str, value: &str) -> Option<u32> {
    let output = crate::tools_install::new_subprocess("reg")
        .args(["query", key, "/v", value])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .find_map(|line| {
            let parts: Vec<_> = line.split_whitespace().collect();
            if parts.len() >= 3 && parts[0].eq_ignore_ascii_case(value) {
                parts.last()?.parse().ok()
            } else {
                None
            }
        })
}

#[cfg(target_os = "windows")]
fn reg_query_string(key: &str, value: &str) -> Option<String> {
    let output = crate::tools_install::new_subprocess("reg")
        .args(["query", key, "/v", value])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines().find_map(|line| {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[0].eq_ignore_ascii_case(value) {
            Some(parts[2..].join(" "))
        } else {
            None
        }
    })
}

#[cfg(target_os = "windows")]
fn normalize_windows_proxy_addr(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    }
}

fn read_git_http_proxy() -> Option<String> {
    crate::tools_install::new_subprocess("git")
        .args(["config", "--global", "--get", "http.proxy"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn apply_github_network(config: &NetworkConfig) -> Result<String, String> {
    let mut logs = Vec::new();

    if config.enabled {
        if config.http_proxy.trim().is_empty() {
            return Err("请填写 HTTP 代理地址".into());
        }

        run_git(&["config", "--global", "http.proxy", &config.http_proxy])?;
        run_git(&["config", "--global", "https.proxy", &config.http_proxy])?;
        logs.push(format!("已设置 Git HTTP/HTTPS 代理: {}", config.http_proxy));

        if let Some(socks) = &config.socks_proxy {
            if !socks.trim().is_empty() {
                apply_ssh_proxy(socks.trim())?;
                logs.push(format!("已为 github.com 配置 SSH SOCKS 代理: {socks}"));
            }
        }
    } else {
        let _ = run_git(&["config", "--global", "--unset", "http.proxy"]);
        let _ = run_git(&["config", "--global", "--unset", "https.proxy"]);
        remove_ssh_proxy()?;
        logs.push("已清除 Git 代理配置".into());
    }

    let mut app = load_config();
    app.network = Some(config.clone());
    save_config(&app)?;

    Ok(logs.join("\n"))
}

fn run_git(args: &[&str]) -> Result<(), String> {
    let output = crate::tools_install::new_subprocess("git")
        .args(args)
        .output()
        .map_err(|e| format!("无法运行 git: {e}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "git 命令失败: {}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

fn apply_ssh_proxy(socks: &str) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let ssh_dir = home.join(".ssh");
    std::fs::create_dir_all(&ssh_dir).map_err(|e| e.to_string())?;
    let config_path = ssh_dir.join("config");

    let block = format!(
        "\n# --- VibeStart GitHub proxy (auto) ---\nHost github.com\n  HostName github.com\n  User git\n  ProxyCommand nc -X 5 -x {socks} %h %p\n# --- end VibeStart ---\n"
    );

    let existing = std::fs::read_to_string(&config_path).unwrap_or_default();
    let cleaned = strip_vibestart_ssh_block(&existing);
    let merged = format!("{cleaned}{block}");
    std::fs::write(&config_path, merged.trim_start()).map_err(|e| e.to_string())?;
    Ok(())
}

fn remove_ssh_proxy() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let config_path = home.join(".ssh/config");
    if !config_path.exists() {
        return Ok(());
    }
    let existing = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let cleaned = strip_vibestart_ssh_block(&existing);
    std::fs::write(&config_path, cleaned.trim()).map_err(|e| e.to_string())?;
    Ok(())
}

fn strip_vibestart_ssh_block(content: &str) -> String {
    if let Some(start) = content.find("# --- VibeStart GitHub proxy (auto) ---") {
        if let Some(end) = content.find("# --- end VibeStart ---") {
            let after = end + "# --- end VibeStart ---".len();
            return format!("{}{}", &content[..start], &content[after..]);
        }
    }
    content.to_string()
}

pub async fn test_github_connectivity() -> GithubConnectivity {
    let detected = detect_proxies();
    let network = load_config().network.unwrap_or_default();

    let mut builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("VibeStart/0.1");

    if network.enabled && !network.http_proxy.trim().is_empty() {
        if let Ok(proxy) = reqwest::Proxy::all(&network.http_proxy) {
            builder = builder.proxy(proxy);
        }
    } else if let Some(detected_proxy) = detected
        .iter()
        .find_map(|p| p.http_proxy.as_ref())
    {
        if let Ok(proxy) = reqwest::Proxy::all(detected_proxy) {
            builder = builder.proxy(proxy);
        }
    }

    let client = match builder.build() {
        Ok(c) => c,
        Err(e) => {
            return GithubConnectivity {
                reachable: false,
                latency_ms: None,
                message: format!("创建网络客户端失败: {e}"),
                detected_proxies: detected,
            };
        }
    };

    let start = std::time::Instant::now();
    match client.get("https://github.com").send().await {
        Ok(res) if res.status().is_success() || res.status().is_redirection() => GithubConnectivity {
            reachable: true,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            message: "GitHub 连接正常".into(),
            detected_proxies: detected,
        },
        Ok(res) => GithubConnectivity {
            reachable: false,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            message: format!("GitHub 返回异常状态: {}", res.status()),
            detected_proxies: detected,
        },
        Err(e) => GithubConnectivity {
            reachable: false,
            latency_ms: None,
            message: format!(
                "无法连接 GitHub：{e}。若在国内，请开启 Clash 等工具的系统代理，或在下方配置 HTTP 代理（如 http://127.0.0.1:7890）"
            ),
            detected_proxies: detected,
        },
    }
}

pub fn use_detected_proxy() -> Result<NetworkConfig, String> {
    let detected = detect_proxies();
    let best = detected
        .iter()
        .find(|p| p.http_proxy.is_some())
        .ok_or("未检测到系统代理，请手动填写（Clash 默认常为 http://127.0.0.1:7890）")?;

    Ok(NetworkConfig {
        enabled: true,
        http_proxy: best.http_proxy.clone().unwrap_or_default(),
        socks_proxy: best
            .socks_proxy
            .clone()
            .or_else(|| Some("127.0.0.1:7890".into())),
    })
}

#[derive(Debug, Serialize)]
pub struct UrlProbeResult {
    pub url: String,
    pub reachable: bool,
    pub status_code: Option<u16>,
    pub latency_ms: Option<u64>,
    pub final_url: Option<String>,
    pub looks_like_login_page: bool,
    pub message: String,
    pub suggestions: Vec<String>,
}

/// 探测部署链接是否可访问（用于部署后诊断）
pub fn probe_deploy_url(url: &str) -> UrlProbeResult {
    let url = url.trim();
    let detected = detect_proxies();
    let network = load_config().network.unwrap_or_default();

    let mut builder = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(5))
        .cookie_store(true)
        .user_agent("VibeStart/0.1");

    if network.enabled && !network.http_proxy.trim().is_empty() {
        if let Ok(proxy) = reqwest::Proxy::all(&network.http_proxy) {
            builder = builder.proxy(proxy);
        }
    } else if let Some(detected_proxy) = detected.iter().find_map(|p| p.http_proxy.as_ref()) {
        if let Ok(proxy) = reqwest::Proxy::all(detected_proxy) {
            builder = builder.proxy(proxy);
        }
    }

    let mut suggestions = Vec::new();
    if url.contains(".vercel.app") {
        suggestions.push(
            "vercel.com 注册/登录国内一般能打开；已部署的 *.vercel.app 静态站多数也能访问，但无国内 CDN，速度因网络而异。".into(),
        );
        suggestions.push(
            "若打开是 Vercel 登录页：说明链接不对（常见为 site-xxx 临时地址），请用 Aliased 生产域名或重新部署。".into(),
        );
        suggestions.push(
            "国内要稳定秒开请用「腾讯云网页托管」；或在 Vercel 控制台绑定自定义域名。".into(),
        );
    }
    if url.contains(".edgeone.cool") || url.contains(".edgeone.app") || url.contains(".edgeone.site") {
        suggestions.push(
            "EdgeOne 预览链须完整打开（含 ?eo_token=）；首次访问会 302 写入 cookie 后跳转到裸域名。".into(),
        );
        suggestions.push(
            "若只打开裸域名（无 ?eo_token=）会 401；过期请点「刷新预览链」重新生成。".into(),
        );
    }

    let client = match builder.build() {
        Ok(c) => c,
        Err(e) => {
            return UrlProbeResult {
                url: url.into(),
                reachable: false,
                status_code: None,
                latency_ms: None,
                final_url: None,
                looks_like_login_page: false,
                message: format!("创建网络客户端失败: {e}"),
                suggestions,
            };
        }
    };

    let start = std::time::Instant::now();
    match client.get(url).send() {
        Ok(res) => {
            let status = res.status().as_u16();
            let final_url = res.url().to_string();
            let latency_ms = start.elapsed().as_millis() as u64;
            let body_sample = res
                .text()
                .unwrap_or_default()
                .chars()
                .take(4096)
                .collect::<String>()
                .to_lowercase();
            let looks_like_login = body_sample.contains("log in to vercel")
                || body_sample.contains("continue with email")
                    && body_sample.contains("vercel");
            let is_edgeone = url.contains(".edgeone.cool")
                || url.contains(".edgeone.app")
                || url.contains(".edgeone.site");
            let edgeone_auth_page = is_edgeone
                && (body_sample.contains("authorization required")
                    || body_sample.contains("eo_time missing")
                    || body_sample.contains("eo_token"));
            let reachable = if is_edgeone && url.contains("eo_token=") {
                status >= 200 && status < 400 && !edgeone_auth_page
            } else {
                status >= 200 && status < 400 && !looks_like_login
            };

            let message = if looks_like_login {
                "链接返回了 Vercel 登录页，不是已上线的网站。可能是临时部署地址未绑定域名，或部署未完成。".into()
            } else if edgeone_auth_page {
                "EdgeOne 返回 401：请用完整预览链（含 ?eo_token=）在浏览器打开；裸域名需先有 cookie。".into()
            } else if is_edgeone && status == 302 {
                "EdgeOne 预览链有效（正在写入访问 cookie 并跳转）".into()
            } else if status >= 200 && status < 400 {
                format!("链接可访问（HTTP {status}，{latency_ms} ms）")
            } else {
                format!("HTTP 状态异常: {status}")
            };

            if looks_like_login {
                suggestions.push("这是 Vercel 登录页，不是已上线的网站——请用日志里 Aliased 行的链接，或 Vercel 控制台 → Project → Domains。".into());
                suggestions.push("重新部署时会自动 link 项目，生成稳定的 项目名.vercel.app。".into());
            } else if !reachable && url.contains(".vercel.app") {
                suggestions.push("超时/打不开可能是网络波动；Vercel 官方说明国内访问不保证速度，可稍后重试或换网络。".into());
            }

            UrlProbeResult {
                url: url.into(),
                reachable,
                status_code: Some(status),
                latency_ms: Some(latency_ms),
                final_url: Some(final_url),
                looks_like_login_page: looks_like_login,
                message,
                suggestions,
            }
        }
        Err(e) => {
            if url.contains(".vercel.app") {
                suggestions.push("部署刚完成时可能需等 1–2 分钟；若持续失败请点「诊断」确认是否误用了临时链接。".into());
            }
            UrlProbeResult {
                url: url.into(),
                reachable: false,
                status_code: None,
                latency_ms: None,
                final_url: None,
                looks_like_login_page: false,
                message: format!("无法连接: {e}"),
                suggestions,
            }
        }
    }
}
