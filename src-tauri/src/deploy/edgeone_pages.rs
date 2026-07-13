use super::DeployResult;
use crate::tools_install;

pub fn deploy_edgeone_pages(
    project_dir: &str,
    project_name: &str,
    api_token: &str,
) -> DeployResult {
    let prod = run_edgeone_deploy(project_dir, project_name, api_token, "production");
    let preview = run_edgeone_deploy(project_dir, project_name, api_token, "preview");
    merge_edgeone_deploy_results(prod, preview)
}

/// 重新部署 preview 环境以获取新的 EDGEONE_DEPLOY_URL（含 eo_token）
pub fn refresh_edgeone_preview_url(
    project_dir: &str,
    project_name: &str,
    api_token: &str,
) -> DeployResult {
    let mut result = run_edgeone_deploy(project_dir, project_name, api_token, "preview");
    append_edgeone_url_verification(&mut result);
    if result.url.is_none() {
        result.log.push_str(
            "\n\n未能从 preview 部署输出解析链接，已尝试读取 EDGEONE_DEPLOY_URL。\n\
             请展开上方 CLI 日志确认；或在 Makers 控制台点「预览」复制完整链接。\n",
        );
    } else {
        result.log.push_str(
            "\n\n已刷新预览链接（含 eo_token，约 3 小时有效）。\n",
        );
    }
    result
}

fn merge_edgeone_deploy_results(prod: DeployResult, preview: DeployResult) -> DeployResult {
    let url = preview.url.clone().or(prod.url.clone());
    let mut alt_urls: Vec<String> = preview
        .alt_urls
        .into_iter()
        .chain(prod.alt_urls)
        .filter(|u| url.as_ref() != Some(u))
        .collect();
    alt_urls.dedup();

    let deploy_ok = prod.success || preview.success;
    let mut log = format!(
        "{}\n\n========== 获取 3 小时预览分享链 ==========\n\n{}",
        prod.log, preview.log
    );

    if url.is_none() && deploy_ok {
        log.push_str(
            "\n⚠️ 部署已完成但未解析到 EDGEONE_DEPLOY_URL。\n\
             请在 Makers 控制台 → 项目 →「预览」复制完整 URL（须含 ?eo_token=）。\n",
        );
    }

    let mut result = DeployResult {
        success: deploy_ok && url.is_some(),
        url,
        alt_urls,
        log,
    };
    append_edgeone_url_verification(&mut result);
    result
}

fn append_edgeone_url_verification(result: &mut DeployResult) {
    let Some(url) = result.url.clone() else {
        return;
    };
    if !url.contains("eo_token=") {
        result.log.push_str(
            "\n⚠️ 当前链接不含 eo_token，国内访问可能 401。\n\
             请点「刷新预览链」或在控制台点「预览」获取完整链接。\n",
        );
        return;
    }
    if verify_edgeone_preview_url(&url) {
        result.log.push_str(
            "\n✅ 本机已验证：预览链可访问（EdgeOne 302 写 cookie 后跳转成功）。\n\
             分享时请复制完整链接（含 ?eo_token=），不要只复制裸域名。\n",
        );
        result.success = true;
    } else {
        result.log.push_str(
            "\n⚠️ 已获得预览链，但本机验证未通过（可能代理/网络波动）。\n\
             请用系统浏览器完整打开下方链接；首次访问会自动写入 cookie（约 3 小时）。\n",
        );
    }
}

/// EdgeOne 预览链：先 302 写 eo_token/eo_time cookie，再跳转到裸域名；须启用 cookie 跟随。
fn verify_edgeone_preview_url(url: &str) -> bool {
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(5))
        .cookie_store(true)
        .user_agent("VibeStart/0.1")
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    client
        .get(url.trim())
        .send()
        .map(|res| res.status().is_success())
        .unwrap_or(false)
}

fn run_edgeone_deploy(
    project_dir: &str,
    project_name: &str,
    api_token: &str,
    env: &str,
) -> DeployResult {
    let token = api_token.trim();
    if token.is_empty() {
        return DeployResult {
            success: false,
            url: None,
            alt_urls: vec![],
            log: "❌ 需要腾讯云 API Token。\n\n\
                 请打开 Makers 控制台 →「设置」→「默认 API Token」→ 创建 API Token，\n\
                 复制粘贴到部署页后重试。\n\
                 官方说明：https://cloud.tencent.com/document/product/1552/127422"
                .into(),
        };
    }

    let name = project_name.trim();
    if name.is_empty() {
        return DeployResult {
            success: false,
            url: None,
            alt_urls: vec![],
            log: "❌ 请填写项目名称（英文，如 my-vibe-project）。".into(),
        };
    }

    if let Ok(mut npm) = tools_install::npm_command_process() {
        tools_install::apply_npm_runtime_env(&mut npm);
        let _ = npm.args(["install", "-g", "edgeone"]).output();
    }

    let edgeone = tools_install::resolve_cli_command("edgeone")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "edgeone".into());

    let mut cmd = tools_install::new_subprocess(&edgeone);
    tools_install::apply_tool_runtime_env(&mut cmd);
    let out = cmd
        .args([
            "makers",
            "deploy",
            project_dir,
            "-n",
            name,
            "-t",
            token,
            "-e",
            env,
        ])
        .current_dir(project_dir)
        .output();

    match out {
        Ok(o) => {
            let log = format!(
                "{}{}",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr)
            );
            let urls = extract_edgeone_urls(&log);
            let url = extract_primary_edgeone_url(&log, &urls, name);
            let alt_urls: Vec<String> = urls
                .into_iter()
                .filter(|u| url.as_ref() != Some(u))
                .collect();
            let success = o.status.success();
            let mut full_log = format!("【腾讯云网页托管 · {env}】\n\n{log}\n");
            if let Some(ref u) = url {
                if u.contains("eo_token=") {
                    full_log.push_str(&format!(
                        "\n✅ 可访问链接（CLI 输出，含校验参数）：\n{u}\n\n\
                         请完整复制此链接分享；不要去掉 ?eo_token= 部分。\n\
                         约 3 小时后过期，可点「刷新预览链接」或控制台「预览」重新生成。\n\
                         长期访问请在「域名管理」绑定自定义域名。\n"
                    ));
                } else {
                    full_log.push_str(&format!(
                        "\n⚠️ 未在输出中找到 EDGEONE_DEPLOY_URL（含 eo_token）。\n\
                         当前解析到：{u}\n\
                         国内裸域名可能 401。请点「刷新预览链接」或在控制台点「预览」。\n"
                    ));
                }
            } else if success {
                full_log.push_str(
                    "\n⚠️ 部署命令已成功，但未解析到 EDGEONE_DEPLOY_URL。\n\
                     请点「刷新预览链接」，或在 Makers 控制台 → 项目 →「预览」复制完整 URL。\n\
                     免费二级域名（*.edgeone.cool）存在，但国内须用带 eo_token 的预览链访问。\n",
                );
            } else {
                full_log.push_str("\n部署未成功，请查看上方 CLI 输出。\n");
            }
            DeployResult {
                success: success && url.is_some(),
                url,
                alt_urls,
                log: full_log,
            }
        }
        Err(e) => DeployResult {
            success: false,
            url: None,
            alt_urls: vec![],
            log: format!(
                "❌ 无法执行部署命令：{e}\n\n\
                 请确认已安装 Node.js，并点击「一键安装部署工具」后重试。"
            ),
        },
    }
}

fn extract_primary_edgeone_url(
    log: &str,
    fallback_urls: &[String],
    project_name: &str,
) -> Option<String> {
    if let Some(url) = extract_edgeone_deploy_url_line(log) {
        return Some(url);
    }
    pick_best_edgeone_url(fallback_urls, project_name)
}

/// CLI 标准输出：EDGEONE_DEPLOY_URL=https://xxx.edgeone.cool?eo_token=...&eo_time=...
fn extract_edgeone_deploy_url_line(log: &str) -> Option<String> {
    let clean = strip_ansi(log);
    for line in clean.lines() {
        let upper = line.to_uppercase();
        let marker = "EDGEONE_DEPLOY_URL=";
        if let Some(idx) = upper.find(marker) {
            let raw = line[idx + marker.len()..].trim();
            if let Some(url) = normalize_edgeone_preview_url(raw) {
                return Some(url);
            }
        }
    }
    None
}

fn extract_edgeone_urls(log: &str) -> Vec<String> {
    let clean = strip_ansi(log);
    let mut out = Vec::new();
    for line in clean.lines() {
        if let Some(url) = find_edgeone_url_in_line(line) {
            if !out.contains(&url) {
                out.push(url);
            }
        }
    }
    out
}

fn pick_best_edgeone_url(urls: &[String], project_name: &str) -> Option<String> {
    if urls.is_empty() {
        return None;
    }
    let name = project_name.to_lowercase();
    urls
        .iter()
        .filter(|u| u.contains("eo_token="))
        .map(|u| (score_edgeone_url(u, &name), u.clone()))
        .max_by_key(|(score, _)| *score)
        .map(|(_, u)| u)
        .or_else(|| {
            urls.iter()
                .map(|u| (score_edgeone_url(u, &name), u.clone()))
                .max_by_key(|(score, _)| *score)
                .map(|(_, u)| u)
        })
}

fn score_edgeone_url(url: &str, project_name: &str) -> i32 {
    let lower = url.to_lowercase();
    let mut score = 0;
    if lower.contains("eo_token=") {
        score += 500;
    }
    if lower.contains(".edgeone.cool") {
        score += 200;
    } else if lower.contains(".edgeone.app") {
        score += 100;
    } else if lower.contains(".edgeone.site") {
        score += 80;
    }
    if lower.contains(project_name) {
        score += 120;
    }
    if let Ok(parsed) = url::Url::parse(&lower) {
        if let Some(host) = parsed.host_str() {
            score += host.len() as i32;
        }
    }
    score
}

fn find_edgeone_url_in_line(line: &str) -> Option<String> {
    let mut search = line;
    while let Some(start) = search.find("https://") {
        let rest = &search[start..];
        let end = rest
            .find(|c: char| c.is_whitespace())
            .unwrap_or(rest.len());
        let raw = rest[..end]
            .trim_end_matches(|c: char| ",.;)]>'\"".contains(c));
        if is_edgeone_deploy_url(raw) {
            if let Some(url) = normalize_edgeone_preview_url(raw) {
                return Some(url);
            }
        }
        search = &search[start + 1..];
    }
    // host?eo_token= without https in line (rare)
    if line.contains(".edgeone.") && line.contains("eo_token=") {
        if let Some(url) = normalize_edgeone_preview_url(line.trim()) {
            return Some(url);
        }
    }
    None
}

fn normalize_edgeone_preview_url(raw: &str) -> Option<String> {
    let mut s = raw.trim();
    if let Some(end) = s.find(|c: char| c.is_whitespace()) {
        s = &s[..end];
    }
    s = s.trim_end_matches(|c: char| ",.;)]>'\"".contains(c));
    // CLI 偶发在 query 末尾多一个 /
    while s.ends_with('/') && s.contains('?') {
        s = &s[..s.len() - 1];
    }
    let with_scheme = if s.starts_with("http://") || s.starts_with("https://") {
        s.to_string()
    } else if s.contains(".edgeone.") {
        format!("https://{s}")
    } else {
        return None;
    };
    if !is_edgeone_deploy_url(&with_scheme) {
        return None;
    }
    if let Ok(mut parsed) = url::Url::parse(&with_scheme) {
        if parsed.query().is_some() {
            return Some(parsed.to_string());
        }
        let path = parsed.path();
        if path.is_empty() || path == "/" {
            parsed.set_path("/");
        }
        return Some(parsed.to_string());
    }
    // 解析失败时手动清理 query 末尾 /
    let fixed = with_scheme.replace("eo_time=", "eo_time=").trim_end_matches('/').to_string();
    if is_edgeone_deploy_url(&fixed) {
        Some(fixed)
    } else {
        None
    }
}

fn is_edgeone_deploy_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.contains(".edgeone.cool")
        || lower.contains(".edgeone.app")
        || lower.contains(".edgeone.site")
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_escape = false;
    for c in s.chars() {
        if in_escape {
            if c == 'm' {
                in_escape = false;
            }
            continue;
        }
        if c == '\x1b' {
            in_escape = true;
            continue;
        }
        out.push(c);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_edgeone_deploy_url_line() {
        let log = "[cli][✔] Deploy Success\nEDGEONE_DEPLOY_URL=https://vibestart-download-page-vq1betop.edgeone.cool?eo_token=abc123&eo_time=1783906828\n";
        let url = extract_edgeone_deploy_url_line(log).unwrap();
        assert!(url.contains("eo_token=abc123"));
        assert!(url.contains("vq1betop.edgeone.cool"));
        assert!(!url.ends_with('/'));
    }

    #[test]
    fn parses_malformed_trailing_slash_in_query() {
        let log = "EDGEONE_DEPLOY_URL=https://demo.edgeone.cool/?eo_token=x&eo_time=123/";
        let url = extract_edgeone_deploy_url_line(log).unwrap();
        assert!(url.contains("eo_token=x"));
        assert!(!url.ends_with('/'));
    }

    #[test]
    fn prefers_deploy_url_line_over_bare_domain() {
        let log = "\
Production URL: https://vibestart-download-page-dp0mxmp9ymkh.edgeone.cool/
EDGEONE_DEPLOY_URL=https://vibestart-download-page-vq1betop.edgeone.cool?eo_token=tok&eo_time=999
";
        let urls = extract_edgeone_urls(log);
        let url = extract_primary_edgeone_url(log, &urls, "vibestart-download-page").unwrap();
        assert!(url.contains("eo_token=tok"));
    }

    #[test]
    fn pick_best_requires_eo_token_when_available() {
        let log = "\
Bare: https://demo.edgeone.cool/
Preview: https://demo.edgeone.cool?eo_token=abc&eo_time=123
";
        let urls = extract_edgeone_urls(log);
        let url = extract_primary_edgeone_url(log, &urls, "demo").unwrap();
        assert!(url.contains("eo_token="));
    }

    #[test]
    fn does_not_guess_url_when_missing() {
        assert!(extract_edgeone_urls("deploy finished ok").is_empty());
        assert!(pick_best_edgeone_url(&[], "demo").is_none());
    }
}
