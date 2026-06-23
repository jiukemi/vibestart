use super::DeployResult;
use std::process::Command;

pub fn deploy_vercel(project_dir: &str) -> DeployResult {
    let _ = Command::new("npm")
        .args(["i", "-g", "vercel"])
        .output();

    let out = Command::new("vercel")
        .args(["--yes", "--prod"])
        .current_dir(project_dir)
        .output();

    match out {
        Ok(o) => {
            let log = format!(
                "{}{}",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr)
            );
            let url = extract_vercel_url(&log);
            DeployResult {
                success: o.status.success() && url.is_some(),
                url,
                log,
            }
        }
        Err(e) => DeployResult {
            success: false,
            url: None,
            log: e.to_string(),
        },
    }
}

fn extract_vercel_url(log: &str) -> Option<String> {
    log.lines()
        .find(|l| l.contains("https://") && l.contains(".vercel.app"))
        .and_then(|l| {
            l.split_whitespace()
                .find(|s| s.starts_with("https://") && s.contains(".vercel.app"))
                .map(|s| s.trim_end_matches('.').to_string())
        })
}
