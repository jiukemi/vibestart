use super::DeployResult;
use crate::tools_install;
use serde::Serialize;
use serde_json::Value;

const AUTH_HINT: &str = "请先点击「登录 Vercel」（只看弹出的 cmd，浏览器由 CLI 自动打开）。\n\
不要手动打开 vercel.com/用户名。\n\
若误选团队：点「切换到个人账号」或重新登录时选 Hobby 个人用户名。";

#[derive(Debug, Clone, Serialize)]
pub struct VercelAccountInfo {
    /// 当前 CLI 激活的 scope（可能是团队）
    pub current_scope: String,
    /// 个人 Hobby 空间 slug，用于 --scope 部署
    pub personal_scope: String,
    /// UI 展示用
    pub display_label: String,
}

pub fn vercel_account() -> Result<VercelAccountInfo, String> {
    let whoami_out = run_vercel(None, &["whoami", "--format", "json"])?;
    let whoami_log = combined_output(&whoami_out);
    if !whoami_out.status.success() {
        if whoami_log.to_lowercase().contains("not logged in")
            || whoami_log.to_lowercase().contains("token is not valid")
        {
            return Err(format!("Vercel CLI 尚未登录或登录已失效。\n\n{AUTH_HINT}\n\n---\n{whoami_log}"));
        }
        return Err(format!("无法读取 Vercel 账号信息。\n\n{whoami_log}"));
    }

    let whoami_json: Value = parse_json_output(&whoami_out)
        .map_err(|e| format!("无法解析 whoami 输出：{e}\n\n{whoami_log}"))?;

    let current_scope = whoami_json
        .pointer("/team/slug")
        .or_else(|| whoami_json.get("username"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let teams_out = run_vercel(None, &["teams", "list", "--format", "json"])?;
    let personal_scope = if teams_out.status.success() {
        parse_personal_scope(&teams_out).unwrap_or_else(|| current_scope.clone())
    } else {
        current_scope.clone()
    };

    let display_label = if current_scope == personal_scope {
        format!("{personal_scope}（个人 Hobby）")
    } else {
        format!("当前 {current_scope} · 部署将用个人 {personal_scope}")
    };

    Ok(VercelAccountInfo {
        current_scope,
        personal_scope,
        display_label,
    })
}

pub fn vercel_whoami() -> Result<String, String> {
    Ok(vercel_account()?.display_label)
}

pub fn vercel_logout() -> Result<String, String> {
    let out = run_vercel(None, &["logout", "--yes"])?;
    let log = combined_output(&out);
    if out.status.success() {
        Ok("已退出 Vercel CLI 登录。请再点「登录 Vercel」重新授权。".into())
    } else {
        Err(format!("退出登录未完成：\n{log}"))
    }
}

pub fn deploy_vercel(project_dir: &str) -> DeployResult {
    let account = match vercel_account() {
        Ok(a) => a,
        Err(e) => {
            return DeployResult {
                success: false,
                url: None,
                alt_urls: vec![],
                log: e,
            };
        }
    };

    if let Ok(mut npm) = tools_install::npm_command_process() {
        tools_install::apply_npm_runtime_env(&mut npm);
        let _ = npm.args(["install", "-g", "vercel"]).output();
    }

    let scope = account.personal_scope.clone();
    let project_name = vercel_project_name_from_dir(project_dir);
    let mut full_log = format!(
        "【Vercel 部署】\n个人空间：{scope}\n项目名称：{project_name}\n",
        scope = account.personal_scope,
        project_name = project_name
    );

    // 关联项目，确保获得稳定的 项目名.vercel.app（而非 site-xxx 临时链接）
    if let Ok(link_out) = run_vercel(
        Some(project_dir),
        &[
            "link",
            "--yes",
            "--project",
            &project_name,
            "--scope",
            &scope,
        ],
    ) {
        let link_log = combined_output(&link_out);
        if !link_log.trim().is_empty() {
            full_log.push_str(&format!("\n[link]\n{link_log}\n"));
        }
    }

    let out = match run_vercel(
        Some(project_dir),
        &[
            "deploy",
            "--yes",
            "--prod",
            "--scope",
            &scope,
            "--project",
            &project_name,
        ],
    ) {
        Ok(o) => o,
        Err(e) => {
            return DeployResult {
                success: false,
                url: None,
                alt_urls: vec![],
                log: e,
            };
        }
    };

    let log = combined_output(&out);
    let urls = extract_vercel_urls(&log);
    let url = urls.first().cloned();
    let alt_urls: Vec<String> = urls.into_iter().skip(1).collect();
    full_log.push_str(&format!("\n{log}"));

    if !out.status.success() {
        if log.to_lowercase().contains("token is not valid") {
            full_log.push_str(&format!("\n\n---\n{AUTH_HINT}\n\n可点「重新登录」清除旧令牌后再试。"));
        } else if log.to_lowercase().contains("not logged in") {
            full_log.push_str(&format!("\n\n---\n{AUTH_HINT}"));
        } else if account.current_scope != account.personal_scope {
            full_log.push_str(
                "\n\n提示：当前 CLI 在团队 scope 下。若部署失败，请点「切换到个人账号」后重试。",
            );
        }
    } else if alias_assign_failed(&log) {
        full_log.push_str(
            "\n\n⚠️ 生产域名绑定失败，预览链接可能无法访问。请查看上方日志，或在 Vercel 控制台确认项目域名。",
        );
    } else if url.is_none() {
        full_log.push_str("\n\n⚠️ 未能从 CLI 输出解析到可访问的链接，请到 Vercel 控制台查看部署结果。");
    } else {
        full_log.push_str(
            "\n\n📌 访问说明：\n\
             · 请优先用 Aliased 生产链接（形如 https://项目名.vercel.app），不要用 site-xxx 临时链接\n\
             · vercel.com 国内一般能打开；静态站 *.vercel.app 多数也能访问，但速度因网络而异（Vercel 无国内 CDN）\n\
             · 若打开是 Vercel 登录页 = 链接类型不对，请点「诊断」或在控制台查看 Production 域名\n\
             · 国内要稳定、秒开：用「腾讯云网页托管」；或给 Vercel 绑定自定义域名（见 vercel.com/docs/domains）",
        );
        if !alt_urls.is_empty() {
            full_log.push_str("\n\n其他链接：");
            for u in &alt_urls {
                full_log.push_str(&format!("\n  · {u}"));
            }
        }
    }

    DeployResult {
        success: out.status.success() && url.is_some() && !alias_assign_failed(&log),
        url,
        alt_urls,
        log: full_log,
    }
}

fn alias_assign_failed(log: &str) -> bool {
    let lower = strip_ansi(log).to_lowercase();
    lower.contains("failed to assign aliases") || lower.contains("alias error")
}

fn vercel_project_name_from_dir(project_dir: &str) -> String {
    let raw = std::path::Path::new(project_dir)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("vibestart-site");
    let mut out = String::new();
    for c in raw.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if (c == '-' || c == '_') && !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    let trimmed = out.trim_matches('-');
    if trimmed.is_empty() {
        "vibestart-site".into()
    } else {
        trimmed.chars().take(48).collect()
    }
}

fn parse_personal_scope(teams_out: &std::process::Output) -> Option<String> {
    let json: Value = parse_json_output(teams_out).ok()?;
    let teams = json.get("teams")?.as_array()?;
    if teams.is_empty() {
        return None;
    }
    if teams.len() == 1 {
        return teams[0]
            .get("slug")
            .and_then(|v| v.as_str())
            .map(str::to_string);
    }
    // 个人 Hobby 团队常见 slug == name
    for team in teams {
        let slug = team.get("slug").and_then(|v| v.as_str())?;
        let name = team.get("name").and_then(|v| v.as_str()).unwrap_or(slug);
        if slug == name {
            return Some(slug.to_string());
        }
    }
    teams[0]
        .get("slug")
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

fn parse_json_output(out: &std::process::Output) -> Result<Value, String> {
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !stdout.is_empty() {
        if let Ok(v) = serde_json::from_str(&stdout) {
            return Ok(v);
        }
        if let Some(slice) = extract_json_object(&stdout) {
            if let Ok(v) = serde_json::from_str(slice) {
                return Ok(v);
            }
        }
    }
    let combined = combined_output(out);
    let slice = extract_json_object(&combined)
        .ok_or_else(|| format!("输出中未找到 JSON：\n{combined}"))?;
    serde_json::from_str(slice).map_err(|e| format!("{e}\n\n{combined}"))
}

/// 从混合 CLI 输出中提取第一个完整 JSON 对象（避免 stderr 横幅导致解析失败）
fn extract_json_object(log: &str) -> Option<&str> {
    let start = log.find('{')?;
    let mut depth = 0i32;
    for (i, c) in log[start..].char_indices() {
        match c {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&log[start..start + i + 1]);
                }
            }
            _ => {}
        }
    }
    None
}

fn run_vercel(
    project_dir: Option<&str>,
    args: &[&str],
) -> Result<std::process::Output, String> {
    let vercel = tools_install::resolve_cli_command("vercel")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "vercel".into());

    let vercel_path = std::path::PathBuf::from(&vercel);
    let mut cmd = if vercel_path.is_file() {
        tools_install::new_executable_command(&vercel_path)
    } else {
        tools_install::new_subprocess(&vercel)
    };
    tools_install::apply_tool_runtime_env(&mut cmd);
    cmd.env_remove("VERCEL_TOKEN");
    cmd.env_remove("VERCEL_ORG_ID");
    cmd.env_remove("VERCEL_TEAM_ID");

    if let Some(dir) = project_dir {
        cmd.current_dir(dir);
    }

    cmd.args(args)
        .output()
        .map_err(|e| format!("无法执行 vercel：{e}"))
}

fn combined_output(out: &std::process::Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
}

fn extract_vercel_url(log: &str) -> Option<String> {
    extract_vercel_urls(log).into_iter().next()
}

fn extract_vercel_urls(log: &str) -> Vec<String> {
    let clean = strip_ansi(log);
    let mut aliased = Vec::new();
    let mut production = Vec::new();
    let mut other = Vec::new();

    for line in clean.lines() {
        let lower = line.to_lowercase();
        let Some(url) = find_vercel_app_url(line) else {
            continue;
        };
        let bucket = if lower.contains("aliased") {
            &mut aliased
        } else if lower.contains("production") {
            &mut production
        } else {
            &mut other
        };
        if !bucket.contains(&url) {
            bucket.push(url);
        }
    }

    let mut out = aliased;
    for u in production {
        if !out.contains(&u) {
            out.push(u);
        }
    }
    for u in other {
        if !out.contains(&u) {
            out.push(u);
        }
    }
    out
}

fn find_vercel_app_url(line: &str) -> Option<String> {
    let start = line.find("https://")?;
    let rest = &line[start..];
    if let Some(app_idx) = rest.find(".vercel.app") {
        let end = app_idx + ".vercel.app".len();
        let url = &rest[..end];
        if !url.contains("vercel.com") {
            return Some(url.to_string());
        }
    }
    None
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
    #[test]
    fn vercel_account_smoke() {
        let r = super::vercel_account();
        assert!(
            r.is_ok(),
            "vercel_account should succeed when CLI is logged in: {r:?}"
        );
    }

    #[test]
    fn extract_vercel_url_prefers_aliased_over_production() {
        let log = "\
  Production      https://site-abc-jiukemi.vercel.app
▲ Aliased         https://my-project.vercel.app
";
        assert_eq!(
            super::extract_vercel_url(log).as_deref(),
            Some("https://my-project.vercel.app")
        );
    }

    #[test]
    fn extract_vercel_url_strips_trailing_garbage() {
        let log = "Production https://foo.vercel.appVercel CLI 55.0.0";
        assert_eq!(
            super::extract_vercel_url(log).as_deref(),
            Some("https://foo.vercel.app")
        );
    }

    #[test]
    fn extract_json_object_strips_trailing_banner() {
        let log = "{\n  \"username\": \"u\"\n}\nVercel CLI 55.0.0\n";
        let slice = super::extract_json_object(log).unwrap();
        assert_eq!(slice, "{\n  \"username\": \"u\"\n}");
    }
}
