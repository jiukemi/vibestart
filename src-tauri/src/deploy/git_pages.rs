use super::DeployResult;
use crate::tools_install;
use std::io;
use std::process::Output;

pub struct GitPagesDeployConfig<'a> {
    pub project_dir: &'a str,
    pub git_username: &'a str,
    pub remote: String,
    pub branch: &'a str,
    pub pages_url: String,
    pub success_footer: String,
}

enum GitStep<'a> {
    Init,
    AddAll,
    Commit { message: &'a str },
    Branch,
    RemoteAdd,
    Push,
}

pub fn deploy_git_pages(config: GitPagesDeployConfig<'_>) -> DeployResult {
    let GitPagesDeployConfig {
        project_dir,
        git_username,
        remote,
        branch,
        pages_url,
        success_footer,
    } = config;

    let identity_email = format!("{git_username}@users.noreply.vibestart.local");
    let mut log = String::new();

    let steps = [
        GitStep::Init,
        GitStep::AddAll,
        GitStep::Commit {
            message: "My first vibe coding page",
        },
        GitStep::Branch,
        GitStep::RemoteAdd,
        GitStep::Push,
    ];

    for step in steps {
        let label = step_label(&step, branch, &remote);
        let output = run_step(
            project_dir,
            git_username,
            &identity_email,
            branch,
            &remote,
            &step,
        );

        match output {
            Ok(o) => {
                append_git_log(&mut log, &label, &o);

                if o.status.success() {
                    continue;
                }

                let stderr = String::from_utf8_lossy(&o.stderr);
                let stdout = String::from_utf8_lossy(&o.stdout);
                let combined = format!("{stdout}{stderr}");

                match step {
                    GitStep::Init if combined.contains("Reinitialized") || combined.is_empty() => {
                        continue;
                    }
                    GitStep::Commit { .. } if is_nothing_to_commit(&combined) => {
                        continue;
                    }
                    GitStep::RemoteAdd => {
                        if try_remote_set_url(project_dir, &remote, &mut log) {
                            continue;
                        }
                    }
                    _ => {}
                }

                return DeployResult {
                    success: false,
                    url: None,
                    log: format!(
                        "{log}\n部署在 `{label}` 步骤失败。\n\n{}",
                        failure_hint(&step, &combined, git_username)
                    ),
                };
            }
            Err(e) => {
                return DeployResult {
                    success: false,
                    url: None,
                    log: format!("{log}{label} 执行失败: {e}"),
                };
            }
        }
    }

    log.push_str(&success_footer);
    DeployResult {
        success: true,
        url: Some(pages_url),
        log,
    }
}

fn step_label(step: &GitStep<'_>, branch: &str, remote: &str) -> String {
    match step {
        GitStep::Init => "git init".into(),
        GitStep::AddAll => "git add .".into(),
        GitStep::Commit { message } => format!("git commit -m \"{message}\""),
        GitStep::Branch => format!("git branch -M {branch}"),
        GitStep::RemoteAdd => format!("git remote add origin {remote}"),
        GitStep::Push => format!("git push -u origin {branch}"),
    }
}

fn run_step(
    project_dir: &str,
    git_username: &str,
    identity_email: &str,
    branch: &str,
    remote: &str,
    step: &GitStep<'_>,
) -> io::Result<Output> {
    match step {
        GitStep::Init => tools_install::new_subprocess("git")
            .arg("init")
            .current_dir(project_dir)
            .output(),
        GitStep::AddAll => run_git(project_dir, &["add", "."]),
        GitStep::Commit { message } => run_git_with_identity(
            project_dir,
            git_username,
            identity_email,
            &["commit", "-m", message],
        ),
        GitStep::Branch => run_git(project_dir, &["branch", "-M", branch]),
        GitStep::RemoteAdd => run_git(project_dir, &["remote", "add", "origin", remote]),
        GitStep::Push => run_git(project_dir, &["push", "-u", "origin", branch]),
    }
}

fn run_git(project_dir: &str, args: &[&str]) -> io::Result<Output> {
    let mut command = tools_install::new_subprocess("git");
    command.args(args).current_dir(project_dir);
    command.output()
}

fn run_git_with_identity(
    project_dir: &str,
    name: &str,
    email: &str,
    args: &[&str],
) -> io::Result<Output> {
    let mut command = tools_install::new_subprocess("git");
    command
        .arg("-c")
        .arg(format!("user.name={name}"))
        .arg("-c")
        .arg(format!("user.email={email}"))
        .args(args)
        .current_dir(project_dir);
    command.output()
}

fn append_git_log(log: &mut String, label: &str, output: &Output) {
    log.push_str(label);
    log.push('\n');
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stdout.is_empty() {
        log.push_str(&stdout);
        if !stdout.ends_with('\n') {
            log.push('\n');
        }
    }
    if !stderr.is_empty() {
        log.push_str(&stderr);
        if !stderr.ends_with('\n') {
            log.push('\n');
        }
    }
    log.push('\n');
}

fn is_nothing_to_commit(text: &str) -> bool {
    text.contains("nothing to commit") || text.contains("nothing added to commit")
}

fn try_remote_set_url(project_dir: &str, remote: &str, log: &mut String) -> bool {
    let set_url = tools_install::new_subprocess("git")
        .args(["remote", "set-url", "origin", remote])
        .current_dir(project_dir)
        .output();

    match set_url {
        Ok(o) if o.status.success() => {
            append_git_log(log, &format!("git remote set-url origin {remote}"), &o);
            true
        }
        Ok(o) => {
            append_git_log(log, &format!("git remote set-url origin {remote}"), &o);
            false
        }
        Err(_) => false,
    }
}

fn failure_hint(step: &GitStep<'_>, combined: &str, git_username: &str) -> String {
    if matches!(step, GitStep::Commit { .. })
        && (combined.contains("Author identity unknown") || combined.contains("unable to auto-detect email"))
    {
        return format!(
            "Git 未配置提交者身份（Windows 新装 Git 常见）。\n\
             VibeStart 已尝试使用 {git_username} 作为作者；若仍失败，请在终端执行：\n\
             git config --global user.name \"你的名字\"\n\
             git config --global user.email \"你的邮箱\"\n\
             然后重新点击「开始部署」。"
        );
    }

    if matches!(step, GitStep::Push) {
        if combined.contains("Permission denied") || combined.contains("publickey") {
            return "推送被拒绝：请先在向导「Git 托管」步骤配置 Gitee SSH 公钥，并在 Gitee 账户中添加。\n\
                 也可在 Gitee 仓库页使用 HTTPS 方式推送（后续版本将支持）。"
                .into();
        }
        if combined.contains("Could not resolve hostname") || combined.contains("Connection timed out") {
            return "无法连接 Gitee 服务器，请检查网络或代理后重试。".into();
        }
        return "代码推送失败。请确认：\n\
             1. Gitee 上已创建同名空仓库\n\
             2. SSH 公钥已添加到 Gitee\n\
             3. 仓库名与上方填写一致"
            .into();
    }

    if matches!(step, GitStep::RemoteAdd) {
        return "无法设置 git remote。请检查项目目录是否可写，或手动删除项目内 .git 文件夹后重试。".into();
    }

    "请查看上方 git 输出，修正后重新部署。".into()
}
