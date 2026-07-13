use super::DeployResult;
use crate::tools_install;
use std::process::{Command, Output};

struct WranglerAuth<'a> {
    token: Option<&'a str>,
    account_id: Option<String>,
}

pub fn deploy_cloudflare_pages(
    project_dir: &str,
    project_name: &str,
    api_token: Option<&str>,
    account_id: Option<&str>,
) -> DeployResult {
    let name = project_name.trim();
    if name.is_empty() {
        return DeployResult {
            success: false,
            url: None,
            alt_urls: vec![],
            log: "❌ 请填写 Cloudflare Pages 项目名称。".into(),
        };
    }

    let token = api_token.map(str::trim).filter(|t| !t.is_empty());
    let mut resolved_account_id = account_id.and_then(parse_cloudflare_account_id);

    if resolved_account_id.is_none() && token.is_none() {
        resolved_account_id = lookup_cloudflare_account_via_wrangler(None).ok();
    }

    if token.is_some() && resolved_account_id.is_none() {
        let raw = account_id.map(str::trim).filter(|s| !s.is_empty());
        let detail = if raw.is_some() {
            "已填写 Account ID，但格式无法识别。请粘贴 Workers 页完整链接，或 32 位字母数字（不含空格、横线）。\n\n"
        } else {
            ""
        };
        return DeployResult {
            success: false,
            url: None,
            alt_urls: vec![],
            log: format!(
                "❌ 未能获取 Cloudflare Account ID。\n\n{detail}{}",
                manual_account_id_hint()
            ),
        };
    }

    if let Ok(mut npm) = tools_install::npm_command_process() {
        tools_install::apply_npm_runtime_env(&mut npm);
        let _ = npm.args(["install", "-g", "wrangler"]).output();
    }

    let auth = WranglerAuth {
        token,
        account_id: resolved_account_id.clone(),
    };

    let branch = "main";
    let mut full_log = String::from("【Cloudflare Pages 部署】\n\n");
    full_log.push_str(&ensure_pages_project(name, branch, project_dir, &auth));

    let out = run_wrangler(
        &auth,
        project_dir,
        &[
            "pages",
            "deploy",
            project_dir,
            "--project-name",
            name,
            "--branch",
            branch,
            "--commit-dirty=true",
        ],
    );

    match out {
        Ok(o) => {
            let log = format_wrangler_log(&o);
            full_log.push_str(&log);
            let success = o.status.success();
            let (url, alt_urls) = if success {
                extract_cloudflare_urls(&log, name)
            } else {
                (None, vec![])
            };
            if let Some(ref id) = resolved_account_id {
                full_log.push_str(&format!("\n\n（已使用 Account ID: {id}）\n"));
            }
            if !success {
                full_log.push_str(&cloudflare_deploy_troubleshooting(
                    &log,
                    token.is_some(),
                    resolved_account_id.as_deref(),
                ));
            } else if let Some(ref u) = url {
                full_log.push_str(&format!("\n\n✅ 分享链接（生产）：{u}\n"));
                for preview in &alt_urls {
                    full_log.push_str(&format!("ℹ️ 本次部署预览：{preview}\n"));
                }
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
            log: format!("{full_log}❌ {e}\n\n请确认已安装 Node.js，并安装 Wrangler CLI 或完成登录。"),
        },
    }
}

fn build_wrangler_cmd(auth: &WranglerAuth) -> Command {
    let wrangler_path = tools_install::resolve_cli_command("wrangler");
    let mut cmd = if let Some(ref path) = wrangler_path {
        tools_install::new_executable_command(path)
    } else {
        tools_install::new_subprocess("wrangler")
    };
    tools_install::apply_tool_runtime_env(&mut cmd);
    if let Some(t) = auth.token {
        cmd.env("CLOUDFLARE_API_TOKEN", t);
    }
    if let Some(ref id) = auth.account_id {
        cmd.env("CLOUDFLARE_ACCOUNT_ID", id);
        cmd.env("CF_ACCOUNT_ID", id);
    }
    cmd
}

fn run_wrangler(auth: &WranglerAuth, project_dir: &str, args: &[&str]) -> Result<Output, String> {
    let mut cmd = build_wrangler_cmd(auth);
    cmd.args(args).current_dir(project_dir);
    cmd.output()
        .map_err(|e| format!("无法执行 wrangler：{e}"))
}

fn format_wrangler_log(out: &Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
}

fn ensure_pages_project(
    name: &str,
    branch: &str,
    project_dir: &str,
    auth: &WranglerAuth,
) -> String {
    let Ok(out) = run_wrangler(
        auth,
        project_dir,
        &[
            "pages",
            "project",
            "create",
            name,
            "--production-branch",
            branch,
        ],
    ) else {
        return String::from("⚠️ 无法执行 wrangler pages project create，将尝试直接部署。\n\n");
    };

    let log = format_wrangler_log(&out);
    if out.status.success() {
        return format!("✅ 已创建 Pages 项目「{name}」。\n{log}\n\n");
    }
    if pages_project_already_exists(&log) {
        return format!("ℹ️ Pages 项目「{name}」已存在，继续部署。\n\n");
    }
    format!("⚠️ 创建 Pages 项目未成功（将尝试直接部署）：\n{log}\n\n")
}

fn pages_project_already_exists(log: &str) -> bool {
    let lower = log.to_lowercase();
    lower.contains("already exists")
        || lower.contains("already been taken")
        || lower.contains("duplicate")
        || lower.contains("project name is already")
}

fn lookup_cloudflare_account_via_wrangler(api_token: Option<&str>) -> Result<String, String> {
    if let Ok(mut npm) = tools_install::npm_command_process() {
        tools_install::apply_npm_runtime_env(&mut npm);
        let _ = npm.args(["install", "-g", "wrangler"]).output();
    }

    let auth = WranglerAuth {
        token: api_token.filter(|t| !t.trim().is_empty()).map(str::trim),
        account_id: None,
    };
    let out = run_wrangler(&auth, ".", &["whoami"])?;

    let log = format_wrangler_log(&out);
    if !out.status.success() {
        return Err(format!(
            "wrangler 未登录或 Token 无效。\n{}\n提示：可先点「Cloudflare 登录」，或检查 API Token。",
            log.trim()
        ));
    }
    extract_account_id_from_whoami(&log)
}

fn extract_account_id_from_whoami(log: &str) -> Result<String, String> {
    let mut found: Vec<String> = Vec::new();
    for line in log.lines() {
        if line.contains('|') {
            for part in line.split('|').skip(1) {
                let candidate = part.trim();
                if is_cloudflare_account_id(candidate) {
                    found.push(candidate.to_lowercase());
                }
            }
        }
        for word in line.split_whitespace() {
            let w = word.trim_matches(|c: char| "|├─└─│".contains(c));
            if is_cloudflare_account_id(w) {
                found.push(w.to_lowercase());
            }
        }
    }
    found.sort();
    found.dedup();
    match found.len() {
        0 => Err("whoami 输出中未找到 32 位 Account ID。".into()),
        1 => Ok(found[0].clone()),
        _ => Err(format!(
            "whoami 返回多个 Account ID，请手动选择：\n  · {}",
            found.join("\n  · ")
        )),
    }
}

fn is_cloudflare_account_id(s: &str) -> bool {
    s.len() == 32 && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn parse_cloudflare_account_id(input: &str) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }
    if is_cloudflare_account_id(trimmed) {
        return Some(trimmed.to_ascii_lowercase());
    }

    let try_url = |raw: &str| -> Option<String> {
        let with_scheme = if raw.starts_with("http://") || raw.starts_with("https://") {
            raw.to_string()
        } else {
            format!("https://{raw}")
        };
        let Ok(url) = url::Url::parse(&with_scheme) else {
            return None;
        };
        if !url.host_str()?.contains("cloudflare.com") {
            return None;
        }
        for segment in url.path_segments()? {
            if is_cloudflare_account_id(segment) {
                return Some(segment.to_ascii_lowercase());
            }
        }
        None
    };

    if let Some(id) = try_url(trimmed) {
        return Some(id);
    }

    for word in trimmed.split_whitespace() {
        let w = word.trim_matches(|c: char| !c.is_ascii_hexdigit());
        if is_cloudflare_account_id(w) {
            return Some(w.to_ascii_lowercase());
        }
    }

    None
}

fn manual_account_id_hint() -> String {
    String::from(
        "📋 手动获取 Account ID（最可靠）\n\
         1. 登录 https://dash.cloudflare.com\n\
         2. 左侧点「Workers 和 Pages」（Workers & Pages）\n\
         3. 看浏览器地址栏：\n\
            https://dash.cloudflare.com/【32位Account ID】/workers-and-pages\n\
            中间那段 32 位字母数字就是 Account ID，复制粘贴到输入框。\n\
         4. 若地址栏没有 ID：点 Overview，右侧向下找到 Account ID 卡片，点 Copy。\n\
         5. 若左侧没有 Workers：先点「Add a site」随便加一个域名，进入 Overview 后右侧 API 区也有 Account ID。\n",
    )
}

fn cloudflare_deploy_troubleshooting(
    log: &str,
    has_token: bool,
    account_id: Option<&str>,
) -> String {
    let lower = log.to_lowercase();
    if lower.contains("failed to automatically retrieve account ids")
        || lower.contains("retrieve account ids")
        || lower.contains("/memberships")
    {
        if let Some(id) = account_id {
            return format!(
                "\n\n🔧 故障排查 — 已填入 Account ID（{id}）仍失败\n\
                 · 确认是 Account ID（Workers 页链接中间 32 位），不是 Zone ID\n\
                 · API Token 须与 Account ID 属于同一 Cloudflare 账号\n\
                 · Token 权限：Account → Cloudflare Pages → Edit；Account Resources 选 All accounts\n\
                 · 若仍失败：点「Cloudflare 登录」走 OAuth，或清空 Token 后重试\n",
            );
        }
        return format!(
            "\n\n🔧 故障排查 — Account ID 缺失\n{}",
            manual_account_id_hint()
        );
    }
    if lower.contains("not authenticated") || lower.contains("authentication") {
        return String::from(
            "\n\n🔧 故障排查 — 未认证\n· 点「Cloudflare 登录」完成 wrangler 授权\n· 或填写 API Token + Account ID 后重试\n",
        );
    }
    if lower.contains("incorrect permissions") || lower.contains("10001") {
        return String::from(
            "\n\n🔧 故障排查 — Token 权限不足\n请重建 Token：Account → Cloudflare Pages → Edit，并手动填写 Account ID。\n",
        );
    }
    if lower.contains("does not exist") && lower.contains("pages project") {
        return String::from(
            "\n\n🔧 故障排查 — Pages 项目不存在\n\
             · 首次部署会自动创建项目；若仍失败，请在 Cloudflare 控制台 Workers & Pages 手动创建同名项目\n\
             · 确认「项目名称」与控制台中的 Pages 项目名一致\n\
             · Token 需有 Account → Cloudflare Pages → Edit 权限\n",
        );
    }
    if has_token {
        String::from(
            "\n\n🔧 部署失败。请展开部署记录查看 wrangler 日志。\n",
        )
    } else {
        String::from(
            "\n\n🔧 请先「Cloudflare 登录」，或填写 API Token 与 Account ID。\n",
        )
    }
}

fn extract_cloudflare_urls(log: &str, project_name: &str) -> (Option<String>, Vec<String>) {
    let production = cloudflare_production_url(project_name);

    let mut found: Vec<String> = Vec::new();
    for line in log.lines() {
        for url in pages_dev_urls_in_text(line) {
            if !found.contains(&url) {
                found.push(url);
            }
        }
    }

    let preview_urls: Vec<String> = found
        .iter()
        .filter(|u| is_cloudflare_preview_url(u, project_name))
        .cloned()
        .collect();

    (Some(production), preview_urls)
}

fn cloudflare_production_url(project_name: &str) -> String {
    format!("https://{project_name}.pages.dev/")
}

fn pages_dev_urls_in_text(text: &str) -> Vec<String> {
    let mut urls = Vec::new();
    for word in text.split_whitespace() {
        let w = word.trim_matches(|c: char| {
            c == '.' || c == ',' || c == ')' || c == '(' || c == '`'
        });
        if w.starts_with("https://") && w.contains(".pages.dev") {
            let normalized = normalize_pages_dev_url(w);
            if !urls.contains(&normalized) {
                urls.push(normalized);
            }
        }
    }
    urls
}

fn normalize_pages_dev_url(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.ends_with('/') {
        trimmed.to_string()
    } else {
        format!("{trimmed}/")
    }
}

fn is_cloudflare_preview_url(url: &str, project_name: &str) -> bool {
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };
    let Some(host) = parsed.host_str() else {
        return false;
    };
    host.ends_with(&format!(".{project_name}.pages.dev"))
        && host != format!("{project_name}.pages.dev")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_account_id_from_whoami_table() {
        let log = r"
Getting User settings...
┌──────────────┬──────────────────────────────────┐
│ Account Name │ Account ID                       │
├──────────────┼──────────────────────────────────┤
│ My Account   │ a1b2c3d4e5f6789012345678abcdef01 │
└──────────────┴──────────────────────────────────┘
";
        let id = extract_account_id_from_whoami(log).unwrap();
        assert_eq!(id, "a1b2c3d4e5f6789012345678abcdef01");
    }

    #[test]
    fn validates_account_id_format() {
        assert!(is_cloudflare_account_id("a1b2c3d4e5f6789012345678abcdef01"));
        assert!(!is_cloudflare_account_id("too-short"));
    }

    #[test]
    fn parses_account_id_from_dashboard_url() {
        let id = parse_cloudflare_account_id(
            "https://dash.cloudflare.com/74ec0fa9f8bd165464ebbe22e95441fe/workers-and-pages",
        )
        .unwrap();
        assert_eq!(id, "74ec0fa9f8bd165464ebbe22e95441fe");
    }

    #[test]
    fn detects_existing_pages_project_from_log() {
        assert!(pages_project_already_exists("Project name already exists"));
        assert!(!pages_project_already_exists("does not exist"));
    }

    #[test]
    fn prefers_production_url_over_preview() {
        let log = r"
✨ Deployment complete! Take a peek over at https://fe4c0d9d.vibestart-download-page.pages.dev
✨ Deployment alias URL: https://vibestart-download-page.pages.dev
";
        let (primary, alts) = extract_cloudflare_urls(log, "vibestart-download-page");
        assert_eq!(
            primary.as_deref(),
            Some("https://vibestart-download-page.pages.dev/")
        );
        assert!(alts
            .iter()
            .any(|u| u.contains("fe4c0d9d.vibestart-download-page.pages.dev")));
        assert!(!is_cloudflare_preview_url(
            "https://vibestart-download-page.pages.dev/",
            "vibestart-download-page"
        ));
        assert!(is_cloudflare_preview_url(
            "https://fe4c0d9d.vibestart-download-page.pages.dev/",
            "vibestart-download-page"
        ));
    }
}
