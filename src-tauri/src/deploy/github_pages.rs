use super::DeployResult;
use crate::tools_install;

pub fn deploy_github_pages(project_dir: &str, username: &str, repo: &str) -> DeployResult {
    let remote = format!("git@github.com:{username}/{repo}.git");
    let mut log = String::new();

    let steps: Vec<(&str, Vec<&str>)> = vec![
        ("init", vec![]),
        ("add", vec!["."]),
        ("commit", vec!["-m", "My first vibe coding page"]),
        ("branch", vec!["-M", "main"]),
        ("remote", vec!["add", "origin", &remote]),
        ("push", vec!["-u", "origin", "main"]),
    ];

    for (cmd, args) in steps {
        let output = if cmd == "init" {
            tools_install::new_subprocess("git")
                .arg("init")
                .current_dir(project_dir)
                .output()
        } else {
            let mut command = tools_install::new_subprocess("git");
            command.arg(cmd).args(&args).current_dir(project_dir);
            command.output()
        };

        match output {
            Ok(o) => {
                log.push_str(&format!(
                    "git {cmd} {args:?}\n{}{}\n",
                    String::from_utf8_lossy(&o.stdout),
                    String::from_utf8_lossy(&o.stderr)
                ));

                if cmd == "remote" && !o.status.success() {
                    // remote may already exist; try set-url instead
                    let set_url = tools_install::new_subprocess("git")
                        .args(["remote", "set-url", "origin", &remote])
                        .current_dir(project_dir)
                        .output();
                    if let Ok(set_out) = set_url {
                        log.push_str(&format!(
                            "git remote set-url origin {remote}\n{}{}\n",
                            String::from_utf8_lossy(&set_out.stdout),
                            String::from_utf8_lossy(&set_out.stderr)
                        ));
                    }
                } else if cmd == "push" && !o.status.success() {
                    return DeployResult {
                        success: false,
                        url: None,
                        log,
                    };
                }
            }
            Err(e) => {
                return DeployResult {
                    success: false,
                    url: None,
                    log: format!("{log}git {cmd} failed: {e}"),
                };
            }
        }
    }

    let url = Some(format!("https://{username}.github.io/{repo}/"));
    DeployResult {
        success: true,
        url,
        log,
    }
}
