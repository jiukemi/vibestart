use super::DeployResult;
use crate::tools_install;

pub fn deploy_gitee_pages(project_dir: &str, username: &str, repo: &str) -> DeployResult {
    let remote = format!("git@gitee.com:{username}/{repo}.git");
    let mut log = String::new();

    let steps: Vec<(&str, Vec<&str>)> = vec![
        ("init", vec![]),
        ("add", vec!["."]),
        ("commit", vec!["-m", "My first vibe coding page"]),
        ("branch", vec!["-M", "master"]),
        ("remote", vec!["add", "origin", &remote]),
        ("push", vec!["-u", "origin", "master"]),
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

    let pages_url = format!("https://{username}.gitee.io/{repo}/");
    log.push_str(&format!(
        "\n✅ 代码已推送到 Gitee。\n\n\
         【下一步 — 开启 Gitee Pages】\n\
         1. 在浏览器打开：仓库 → 服务 → Gitee Pages\n\
         2. 分支选择 master，目录选 /\n\
         3. 点击「启动」\n\
         4. 免费版更新后需手动点「更新」\n\n\
         预计访问地址：{pages_url}\n"
    ));

    DeployResult {
        success: true,
        url: Some(pages_url),
        log,
    }
}
