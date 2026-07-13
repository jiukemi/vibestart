use super::DeployResult;
use crate::tools_install;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

struct WranglerAuth<'a> {
    token: Option<&'a str>,
    account_id: Option<String>,
    project_name: Option<&'a str>,
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
        project_name: Some(name),
    };

    let branch = "main";
    let mut full_log = String::from("【Cloudflare Pages 部署】\n\n");

    if token.is_some() {
        match clear_wrangler_oauth_session(project_dir) {
            Ok(cleared) if cleared => {
                full_log.push_str(
                    "ℹ️ 已退出本机 wrangler 旧登录（OAuth），避免与 API Token 混用导致认证失败。\n\n",
                );
            }
            Ok(_) => {}
            Err(e) => {
                full_log.push_str(&format!(
                    "⚠️ 未能退出 wrangler 旧登录：{e}\n若部署报 code 10000，请在本机终端手动执行 wrangler logout 后重试。\n\n",
                ));
            }
        }
        if let Some(ref id) = resolved_account_id {
            full_log.push_str(&format!(
                "ℹ️ 已隔离 wrangler 账号缓存，强制使用 Account ID: {id}\n\n",
            ));
        }
        if let Some(ref id) = resolved_account_id {
            match verify_token_matches_account(&auth, id, project_dir) {
                Ok(TokenPreflight::Verified) => {}
                Ok(TokenPreflight::Skipped(note)) => {
                    full_log.push_str(&format!("ℹ️ {note}\n\n"));
                }
                Err(msg) => {
                    full_log.push_str(&format!("❌ {msg}\n\n"));
                    full_log.push_str(&cloudflare_token_auth_hint());
                    return DeployResult {
                        success: false,
                        url: None,
                        alt_urls: vec![],
                        log: full_log,
                    };
                }
            }
        }
    }

    match ensure_pages_project(name, branch, project_dir, &auth) {
        EnsureProjectResult::Created(msg) | EnsureProjectResult::AlreadyExists(msg) => {
            full_log.push_str(&msg);
        }
        EnsureProjectResult::AuthFailed { log } => {
            if let Some(ref id) = resolved_account_id {
                full_log.push_str(&format!("\n（已使用 Account ID: {id}）\n"));
                if let Some(used) = extract_account_id_from_wrangler_api_log(&log) {
                    if used != *id {
                        full_log.push_str(&format!(
                            "\n⚠️ Wrangler 实际请求了旧账号 {used}（可能来自 pages.json 缓存）。\
                             已尝试隔离缓存；若仍出现此 ID，说明 API Token 属于该旧账号，\
                             请在新账号控制台重新 Create Token。\n",
                        ));
                    }
                }
            }
            full_log.push_str(&format!(
                "❌ Cloudflare API Token 认证失败，无法创建 Pages 项目。\n\n{log}\n{}",
                cloudflare_token_auth_hint()
            ));
            return DeployResult {
                success: false,
                url: None,
                alt_urls: vec![],
                log: full_log,
            };
        }
        EnsureProjectResult::Failed(msg) => {
            full_log.push_str(&msg);
        }
    }

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
    apply_cloudflare_auth(&mut cmd, auth);
    cmd
}

/// Wrangler Pages 的 `project create` 会优先读 pages.json 缓存里的 account_id，忽略环境变量。
/// 使用 API Token 时写入独立 WRANGLER_CACHE_DIR，避免同一台机器测多个账号时沿用旧 ID。
fn apply_wrangler_isolated_cache(cmd: &mut Command, auth: &WranglerAuth) {
    let (Some(_), Some(ref account_id), Some(project_name)) =
        (auth.token, auth.account_id.as_ref(), auth.project_name)
    else {
        return;
    };
    let cache_dir = wrangler_cache_dir_for_account(account_id);
    if seed_wrangler_pages_cache(&cache_dir, account_id, project_name).is_ok() {
        cmd.env("WRANGLER_CACHE_DIR", &cache_dir);
    }
}

fn wrangler_cache_dir_for_account(account_id: &str) -> PathBuf {
    std::env::temp_dir()
        .join("vibestart-wrangler")
        .join(account_id)
}

fn seed_wrangler_pages_cache(
    cache_dir: &Path,
    account_id: &str,
    project_name: &str,
) -> Result<(), String> {
    std::fs::create_dir_all(cache_dir)
        .map_err(|e| format!("无法创建 wrangler 缓存目录：{e}"))?;
    let payload = serde_json::json!({
        "account_id": account_id,
        "project_name": project_name,
    });
    let pages_json = cache_dir.join("pages.json");
    std::fs::write(
        &pages_json,
        serde_json::to_string_pretty(&payload).map_err(|e| format!("无法写入 pages.json：{e}"))?,
    )
    .map_err(|e| format!("无法写入 pages.json：{e}"))?;
    Ok(())
}

/// 使用 API Token 时清除 OAuth/旧密钥环境变量，避免 wrangler 混用导致 10000。
fn apply_cloudflare_auth(cmd: &mut Command, auth: &WranglerAuth) {
    for key in [
        "CLOUDFLARE_API_KEY",
        "CLOUDFLARE_EMAIL",
        "CF_API_KEY",
        "CF_API_EMAIL",
        "CF_ACCOUNT_ID",
    ] {
        cmd.env_remove(key);
    }
    if let Some(t) = auth.token {
        cmd.env("CLOUDFLARE_API_TOKEN", t.trim());
        apply_wrangler_isolated_cache(cmd, auth);
    } else {
        cmd.env_remove("CLOUDFLARE_API_TOKEN");
        cmd.env_remove("WRANGLER_CACHE_DIR");
    }
    if let Some(ref id) = auth.account_id {
        let id = id.trim();
        cmd.env("CLOUDFLARE_ACCOUNT_ID", id);
        cmd.env("CF_ACCOUNT_ID", id);
    } else {
        cmd.env_remove("CLOUDFLARE_ACCOUNT_ID");
    }
}

fn run_wrangler(auth: &WranglerAuth, project_dir: &str, args: &[&str]) -> Result<Output, String> {
    let mut cmd = build_wrangler_cmd(auth);
    cmd.args(args).current_dir(project_dir);
    cmd.output()
        .map_err(|e| format!("无法执行 wrangler：{e}"))
}

/// 使用 API Token 部署前清除 wrangler OAuth 会话，避免与 `CLOUDFLARE_API_TOKEN` 混用。
fn clear_wrangler_oauth_session(project_dir: &str) -> Result<bool, String> {
    let auth = WranglerAuth {
        token: None,
        account_id: None,
        project_name: None,
    };
    let out = run_wrangler(&auth, project_dir, &["logout"])?;
    let log = format_wrangler_log(&out);
    if !out.status.success() {
        let lower = log.to_lowercase();
        if lower.contains("not logged in") || lower.contains("already logged out") {
            return Ok(false);
        }
        return Err(log.trim().to_string());
    }
    Ok(true)
}

fn format_wrangler_log(out: &Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
}

enum EnsureProjectResult {
    Created(String),
    AlreadyExists(String),
    AuthFailed { log: String },
    Failed(String),
}

fn ensure_pages_project(
    name: &str,
    branch: &str,
    project_dir: &str,
    auth: &WranglerAuth,
) -> EnsureProjectResult {
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
        return EnsureProjectResult::Failed(
            "⚠️ 无法执行 wrangler pages project create，将尝试直接部署。\n\n".into(),
        );
    };

    let log = format_wrangler_log(&out);
    if out.status.success() {
        return EnsureProjectResult::Created(format!(
            "✅ 已创建 Pages 项目「{name}」。\n{log}\n\n"
        ));
    }
    if pages_project_already_exists(&log) {
        return EnsureProjectResult::AlreadyExists(format!(
            "ℹ️ Pages 项目「{name}」已存在，继续部署。\n\n"
        ));
    }
    if is_cloudflare_auth_error(&log) {
        return EnsureProjectResult::AuthFailed { log };
    }
    EnsureProjectResult::Failed(format!(
        "⚠️ 创建 Pages 项目未成功（将尝试直接部署）：\n{log}\n\n"
    ))
}

fn is_cloudflare_auth_error(log: &str) -> bool {
    let lower = log.to_lowercase();
    lower.contains("authentication error")
        || lower.contains("code: 10000")
        || lower.contains("code: 10001")
        || lower.contains("incorrect permissions on your api token")
        || lower.contains("please ensure it has the correct permissions")
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
        project_name: None,
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
    let found = extract_all_account_ids_from_whoami(log);
    match found.len() {
        0 => Err("whoami 输出中未找到 32 位 Account ID。".into()),
        1 => Ok(found[0].clone()),
        _ => Err(format!(
            "whoami 返回多个 Account ID，请手动选择：\n  · {}",
            found.join("\n  · ")
        )),
    }
}

fn extract_all_account_ids_from_whoami(log: &str) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    for line in log.lines() {
        if line.contains('|') {
            for part in line.split('|').skip(1) {
                let candidate = part.trim();
                if is_cloudflare_account_id(candidate) {
                    found.push(candidate.to_ascii_lowercase());
                }
            }
        }
        for word in line.split_whitespace() {
            let w = word.trim_matches(|c: char| "|├─└─│".contains(c));
            if is_cloudflare_account_id(w) {
                found.push(w.to_ascii_lowercase());
            }
        }
    }
    found.sort();
    found.dedup();
    found
}

enum TokenPreflight {
    Verified,
    Skipped(String),
}

fn is_wrangler_whoami_skippable(log: &str) -> bool {
    let lower = log.to_lowercase();
    lower.contains("retrieve account ids")
        || lower.contains("/memberships")
        || lower.contains("failed to automatically retrieve account")
        || lower.contains("incorrect permissions on your api token")
        || lower.contains("please ensure it has the correct permissions")
}

fn verify_token_matches_account(
    auth: &WranglerAuth,
    expected_account_id: &str,
    project_dir: &str,
) -> Result<TokenPreflight, String> {
    let out = run_wrangler(auth, project_dir, &["whoami"])?;
    let log = format_wrangler_log(&out);
    if !out.status.success() {
        if is_wrangler_whoami_skippable(&log) {
            return Ok(TokenPreflight::Skipped(
                "wrangler whoami 无法列出账号（通常因 Token 未勾选 User Details → Read）。\
                 已跳过预检，将直接使用您填写的 Account ID 尝试部署。"
                    .into(),
            ));
        }
        if is_cloudflare_auth_error(&log) {
            return Err(format!(
                "API Token 认证失败，wrangler whoami 未通过：\n{}",
                log.trim()
            ));
        }
        return Ok(TokenPreflight::Skipped(format!(
            "wrangler whoami 未成功，已跳过预检并继续部署：\n{}",
            log.trim()
        )));
    }
    let accounts = extract_all_account_ids_from_whoami(&log);
    if accounts.is_empty() {
        return Ok(TokenPreflight::Skipped(
            "wrangler whoami 未返回 Account ID（建议 Token 勾选 User Details → Read）。\
             已跳过预检，将直接使用您填写的 Account ID 尝试部署。"
                .into(),
        ));
    }
    let expected = expected_account_id.to_ascii_lowercase();
    if accounts.iter().any(|id| id == &expected) {
        return Ok(TokenPreflight::Verified);
    }
    Err(format!(
        "API Token 所属账号为 {}，与您填写的 Account ID {} 不一致。\
         请在新账号控制台重新 Create Token，或核对 Account ID 是否来自当前登录账号。",
        accounts.join("、"),
        expected
    ))
}

fn extract_account_id_from_wrangler_api_log(log: &str) -> Option<String> {
    for word in log.split_whitespace() {
        if let Some(rest) = word.strip_prefix("/accounts/") {
            let id = rest.trim_matches(|c: char| !c.is_ascii_hexdigit());
            if is_cloudflare_account_id(id) {
                return Some(id.to_ascii_lowercase());
            }
        }
        if word.contains("/accounts/") {
            if let Some(idx) = word.find("/accounts/") {
                let rest = &word[idx + "/accounts/".len()..];
                let id = rest
                    .split('/')
                    .next()
                    .unwrap_or(rest)
                    .trim_matches(|c: char| !c.is_ascii_hexdigit());
                if is_cloudflare_account_id(id) {
                    return Some(id.to_ascii_lowercase());
                }
            }
        }
    }
    None
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

fn cloudflare_token_auth_hint() -> String {
    String::from(
        "🔧 Token 认证失败（code 10000）常见原因\n\
         1. **新注册账号后用了旧 Token** — 必须重新 Create Token\n\
         2. **Account ID 与 Token 不是同一账号** — 点「打开 Workers 页」复制当前账号链接里的 32 位 ID\n\
         3. **Token 权限不足** — Custom token 至少勾选：\n\
            · Account → Cloudflare Pages → Edit（必填）\n\
            · User → User Details → Read（建议，用于 whoami 预检；未勾选也可能能部署）\n\
            · Account Resources → Include → 选你的账号（或 All accounts）\n\
         4. **Wrangler 缓存旧账号** — 同一台电脑测多个账号时，pages.json 会缓存旧 Account ID；\
            现已自动隔离缓存。若仍失败，Token 可能属于旧账号，须在新账号重建 Token\n\
         5. **Token 与 OAuth 混用** — 填 Token 部署时会自动 wrangler logout\n\
         6. Token 复制时勿带空格；创建后只显示一次，失效需重建\n\n\
         也可在控制台手动创建 Pages 项目（Workers & Pages → Create → Pages），项目名称与上方填写一致。\n",
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
        if has_token {
            return format!("\n\n{}", cloudflare_token_auth_hint());
        }
        return String::from(
            "\n\n🔧 故障排查 — 未认证\n· 点「Cloudflare 登录」完成 wrangler 授权\n· 或填写 API Token + Account ID 后重试\n",
        );
    }
    if lower.contains("incorrect permissions") || lower.contains("10001") || lower.contains("10000") {
        return format!("\n\n{}", cloudflare_token_auth_hint());
    }
    if lower.contains("does not exist") && lower.contains("pages project") {
        if has_token {
            return format!(
                "\n\n🔧 故障排查 — Pages 项目不存在\n\
                 · 自动创建失败时，请先在控制台 Workers & Pages 手动 Create 同名项目\n\
                 · 或按下方 Token 说明重建 API Token 后重试\n\n{}",
                cloudflare_token_auth_hint()
            );
        }
        return String::from(
            "\n\n🔧 故障排查 — Pages 项目不存在\n\
             · 请在 Cloudflare 控制台 Workers & Pages 手动创建同名项目\n\
             · 确认「项目名称」与控制台中的 Pages 项目名一致\n",
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
            "https://dash.cloudflare.com/1234567890abcdef1234567890abcdef/workers-and-pages",
        )
        .unwrap();
        assert_eq!(id, "1234567890abcdef1234567890abcdef");
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

    #[test]
    fn whoami_memberships_error_is_skippable() {
        let log = "Failed to automatically retrieve account IDs for the logged in user.";
        assert!(is_wrangler_whoami_skippable(log));
    }

    #[test]
    fn extracts_account_id_from_api_error_log() {
        let log = r"X [ERROR] A request to the Cloudflare API (/accounts/74ec0fa9f8bd165464ebbe22e95441fe/pages/projects) failed.";
        let id = extract_account_id_from_wrangler_api_log(log).unwrap();
        assert_eq!(id, "74ec0fa9f8bd165464ebbe22e95441fe");
    }
}
