use serde::Deserialize;
use serde::Serialize;
use std::path::Path;
use tauri::AppHandle;

const GITHUB_OWNER: &str = "jiukemi";
const GITHUB_REPO: &str = "vibestart";
const GITEE_OWNER: &str = "webhwh";
const GITEE_REPO: &str = "vibestart";

#[derive(Debug, Serialize, Clone)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub latest_tag: Option<String>,
    pub update_available: bool,
    pub download_url: Option<String>,
    pub release_page_url: Option<String>,
    pub mirror: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct DownloadUpdateResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
struct GhRelease {
    tag_name: String,
    html_url: String,
    assets: Vec<GhAsset>,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GiteeRelease {
    tag_name: String,
    #[serde(default)]
    assets: Vec<GiteeAsset>,
}

#[derive(Debug, Deserialize)]
struct GiteeAsset {
    name: String,
    browser_download_url: Option<String>,
}

pub fn current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn parse_version_parts(raw: &str) -> Vec<u32> {
    raw.trim()
        .trim_start_matches('v')
        .trim_start_matches('V')
        .split('.')
        .map(|part| {
            part.chars()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse()
                .unwrap_or(0)
        })
        .collect()
}

pub fn is_version_newer(latest: &str, current: &str) -> bool {
    let latest_parts = parse_version_parts(latest);
    let current_parts = parse_version_parts(current);
    let len = latest_parts.len().max(current_parts.len()).max(3);
    for i in 0..len {
        let l = *latest_parts.get(i).unwrap_or(&0);
        let c = *current_parts.get(i).unwrap_or(&0);
        if l > c {
            return true;
        }
        if l < c {
            return false;
        }
    }
    false
}

fn pick_download_asset(names: &[(String, String)]) -> Option<String> {
    let target = download_target_key();
    for (name, url) in names {
        let lower = name.to_lowercase();
        if target == "win" && lower.contains("x64-setup") && lower.ends_with(".exe") {
            return Some(url.clone());
        }
        if target == "mac-arm" && lower.contains("aarch64") && lower.ends_with(".dmg") {
            return Some(url.clone());
        }
        if target == "mac-intel" && lower.ends_with(".dmg") && lower.contains("x64") && !lower.contains("aarch64") {
            return Some(url.clone());
        }
    }
    names
        .iter()
        .find(|(name, _)| {
            let lower = name.to_lowercase();
            lower.ends_with(".dmg") || lower.ends_with(".exe")
        })
        .map(|(_, url)| url.clone())
}

fn download_target_key() -> &'static str {
    if cfg!(target_os = "windows") {
        return "win";
    }
    if cfg!(target_os = "macos") {
        if std::env::consts::ARCH == "aarch64" {
            return "mac-arm";
        }
        return "mac-intel";
    }
    "mac-arm"
}

fn http_client() -> Result<reqwest::Client, String> {
    use crate::config::load_config;
    use crate::network::detect_proxies;

    let detected = detect_proxies();
    let network = load_config().network.unwrap_or_default();
    let mut builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent(format!("VibeStart/{}", current_version()));

    if network.enabled && !network.http_proxy.trim().is_empty() {
        if let Ok(proxy) = reqwest::Proxy::all(&network.http_proxy) {
            builder = builder.proxy(proxy);
        }
    } else if let Some(http) = detected.iter().find_map(|p| p.http_proxy.as_ref()) {
        if let Ok(proxy) = reqwest::Proxy::all(http) {
            builder = builder.proxy(proxy);
        }
    }

    builder.build().map_err(|e| format!("创建 HTTP 客户端失败: {e}"))
}

async fn fetch_github_latest(client: &reqwest::Client) -> Result<GhRelease, String> {
    let url = format!(
        "https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"
    );
    let res = client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("GitHub 请求失败: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("GitHub API 返回 {}", res.status()));
    }
    res.json::<GhRelease>()
        .await
        .map_err(|e| format!("解析 GitHub Release 失败: {e}"))
}

async fn fetch_gitee_latest(client: &reqwest::Client) -> Result<GiteeRelease, String> {
    let url = format!("https://gitee.com/api/v5/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/latest");
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Gitee 请求失败: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("Gitee API 返回 {}", res.status()));
    }
    let body = res
        .text()
        .await
        .map_err(|e| format!("读取 Gitee 响应失败: {e}"))?;
    serde_json::from_str(&body).map_err(|e| format!("解析 Gitee Release 失败: {e}"))
}

async fn github_reachable(client: &reqwest::Client) -> bool {
    client
        .get("https://api.github.com/zen")
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

pub async fn check_for_update() -> UpdateCheckResult {
    let current = current_version();
    let client = match http_client() {
        Ok(c) => c,
        Err(e) => {
            return UpdateCheckResult {
                current_version: current,
                latest_version: None,
                latest_tag: None,
                update_available: false,
                download_url: None,
                release_page_url: None,
                mirror: "unknown".into(),
                message: e,
            };
        }
    };

    let prefer_github = github_reachable(&client).await;
    let mirrors = if prefer_github {
        ["github", "gitee"]
    } else {
        ["gitee", "github"]
    };

    let mut last_err = String::new();
    for mirror in mirrors {
        match mirror {
            "github" => match fetch_github_latest(&client).await {
                Ok(release) => {
                    let latest_version = release.tag_name.trim_start_matches('v').to_string();
                    let assets: Vec<(String, String)> = release
                        .assets
                        .iter()
                        .map(|a| (a.name.clone(), a.browser_download_url.clone()))
                        .collect();
                    let update_available = is_version_newer(&latest_version, &current);
                    return UpdateCheckResult {
                        current_version: current.clone(),
                        latest_version: Some(latest_version),
                        latest_tag: Some(release.tag_name),
                        update_available,
                        download_url: pick_download_asset(&assets),
                        release_page_url: Some(release.html_url),
                        mirror: "github".into(),
                        message: if update_available {
                            "发现新版本".into()
                        } else {
                            "已是最新版本".into()
                        },
                    };
                }
                Err(e) => last_err = e,
            },
            _ => match fetch_gitee_latest(&client).await {
                Ok(release) => {
                    let latest_version = release.tag_name.trim_start_matches('v').to_string();
                    let assets: Vec<(String, String)> = release
                        .assets
                        .iter()
                        .filter_map(|a| {
                            a.browser_download_url
                                .as_ref()
                                .map(|url| (a.name.clone(), url.clone()))
                        })
                        .collect();
                    let tag = release.tag_name.clone();
                    let release_page = format!(
                        "https://gitee.com/{GITEE_OWNER}/{GITEE_REPO}/releases/tag/{tag}"
                    );
                    let update_available = is_version_newer(&latest_version, &current);
                    return UpdateCheckResult {
                        current_version: current.clone(),
                        latest_version: Some(latest_version),
                        latest_tag: Some(release.tag_name),
                        update_available,
                        download_url: pick_download_asset(&assets),
                        release_page_url: Some(release_page),
                        mirror: "gitee".into(),
                        message: if update_available {
                            "发现新版本".into()
                        } else {
                            "已是最新版本".into()
                        },
                    };
                }
                Err(e) => last_err = e,
            },
        }
    }

    UpdateCheckResult {
        current_version: current,
        latest_version: None,
        latest_tag: None,
        update_available: false,
        download_url: None,
        release_page_url: None,
        mirror: "unknown".into(),
        message: if last_err.is_empty() {
            "无法检查更新".into()
        } else {
            last_err
        },
    }
}

fn filename_from_url(url: &str) -> String {
    url.rsplit('/')
        .next()
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| {
            if cfg!(target_os = "windows") {
                "VibeStart-setup.exe".into()
            } else {
                "VibeStart.dmg".into()
            }
        })
}

fn reveal_in_file_manager(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("文件不存在: {}", path.display()));
    }
    if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .args(["-R", &path.to_string_lossy()])
            .status()
            .map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .status()
            .map_err(|e| e.to_string())?;
    } else {
        crate::project::reveal_project_dir(
            path.parent()
                .unwrap_or(path)
                .to_string_lossy()
                .as_ref(),
        )?;
    }
    Ok(())
}

pub async fn download_app_update(app: AppHandle) -> DownloadUpdateResult {
    let check = check_for_update().await;
    if !check.update_available {
        return DownloadUpdateResult {
            success: false,
            file_path: None,
            message: check.message,
        };
    }

    let url = match check.download_url {
        Some(u) => u,
        None => {
            return DownloadUpdateResult {
                success: false,
                file_path: None,
                message: "未找到安装包直链，请从 Release 页面手动下载".into(),
            };
        }
    };

    let downloads = match dirs::download_dir() {
        Some(d) => d,
        None => {
            return DownloadUpdateResult {
                success: false,
                file_path: None,
                message: "无法定位系统「下载」文件夹".into(),
            };
        }
    };

    let filename = filename_from_url(&url);
    let dest = downloads.join(&filename);
    let app_for_dl = app.clone();
    let url_for_dl = url.clone();
    let dest_for_dl = dest.clone();

    let dl = tokio::task::spawn_blocking(move || {
        crate::mirrors::download_file(Some(&app_for_dl), &url_for_dl, &dest_for_dl)
    })
    .await;

    match dl {
        Ok(Ok(())) => {
            if let Err(e) = reveal_in_file_manager(&dest) {
                return DownloadUpdateResult {
                    success: true,
                    file_path: Some(dest.to_string_lossy().into_owned()),
                    message: format!(
                        "已下载到 {}（未能自动打开文件夹: {e}）",
                        dest.display()
                    ),
                };
            }
            DownloadUpdateResult {
                success: true,
                file_path: Some(dest.to_string_lossy().into_owned()),
                message: install_hint(),
            }
        }
        Ok(Err(e)) => DownloadUpdateResult {
            success: false,
            file_path: None,
            message: format!("下载失败: {e}"),
        },
        Err(e) => DownloadUpdateResult {
            success: false,
            file_path: None,
            message: format!("下载任务异常: {e}"),
        },
    }
}

fn install_hint() -> String {
    if cfg!(target_os = "windows") {
        "已下载到「下载」文件夹。双击 .exe 安装包，按向导覆盖安装即可。".into()
    } else {
        "已下载到「下载」文件夹。打开 .dmg，将 VibeStart 拖入「应用程序」即可完成更新。".into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_semver() {
        assert!(is_version_newer("0.2.0", "0.1.0"));
        assert!(is_version_newer("v0.1.1", "0.1.0"));
        assert!(!is_version_newer("0.1.0", "0.1.0"));
        assert!(!is_version_newer("0.1.0", "0.2.0"));
    }
}
