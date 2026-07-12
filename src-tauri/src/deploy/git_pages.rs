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
    /// 平台名称，用于新手向提示（如 "Gitee"）
    pub host: &'a str,
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
        host,
    } = config;

    let identity_email = format!("{git_username}@users.noreply.vibestart.local");
    let mut log = String::new();
    log.push_str("【VibeStart 自动部署】以下 Git 命令均由应用代为执行，你无需打开终端。\n\n");

    if let Err(failed) = prepare_deploy(project_dir, git_username, &identity_email, &mut log) {
        return failed;
    }

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
                        "{log}\n❌ 部署在「{label}」步骤未成功。\n\n{}",
                        failure_hint(&step, &combined, host)
                    ),
                };
            }
            Err(e) => {
                return DeployResult {
                    success: false,
                    url: None,
                    log: format!("{log}❌ {label} 执行失败: {e}"),
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

fn prepare_deploy(
    project_dir: &str,
    git_username: &str,
    identity_email: &str,
    log: &mut String,
) -> Result<(), DeployResult> {
    if tools_install::resolve_system_git().is_none() {
        return Err(DeployResult {
            success: false,
            url: None,
                log: format!(
                    "{log}❌ 未检测到 Git。\n\n\
                     请返回「准备环境」步骤，点击「一键安装 Git」，安装完成后再来部署。"
                ),
        });
    }
    log.push_str("✓ 已检测到 Git\n");

    match crate::ssh::ensure_key() {
        Ok(info) if info.public_key.is_some() => {
            log.push_str("✓ SSH 密钥已就绪（已由 VibeStart 自动生成）\n");
        }
        Ok(_) => {
            return Err(DeployResult {
                success: false,
                url: None,
                log: format!(
                    "{log}❌ 无法读取 SSH 公钥。\n\n\
                     请在本页点击「一键生成 SSH 密钥」，然后「复制 SSH 公钥」粘贴到 Gitee/GitHub 账户后再部署。"
                ),
            });
        }
        Err(e) => {
            return Err(DeployResult {
                success: false,
                url: None,
                log: format!(
                    "{log}❌ 无法生成 SSH 密钥：{e}\n\n\
                     请在本页点击「一键生成 SSH 密钥」后重试。"
                ),
            });
        }
    }

    ensure_local_git_identity(project_dir, git_username, identity_email, log)?;
    log.push('\n');
    Ok(())
}

fn ensure_local_git_identity(
    project_dir: &str,
    name: &str,
    email: &str,
    log: &mut String,
) -> Result<(), DeployResult> {
    for (key, value) in [("user.name", name), ("user.email", email)] {
        let out = run_git(project_dir, &["config", key, value]).map_err(|e| DeployResult {
            success: false,
            url: None,
            log: format!("无法配置 Git 身份: {e}"),
        })?;
        if !out.status.success() {
            let detail = format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            );
            return Err(DeployResult {
                success: false,
                url: None,
                log: format!("无法配置 Git 身份（{key}）: {detail}"),
            });
        }
    }
    log.push_str(&format!("✓ 已自动配置 Git 提交身份：{name} <{email}>\n"));
    Ok(())
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

fn failure_hint(step: &GitStep<'_>, combined: &str, host: &str) -> String {
    if matches!(step, GitStep::Commit { .. }) {
        return "提交代码时出错。请确认项目文件夹可写，然后再次点击「开始部署」。\n\
             若问题仍在，请把下方日志发给 VibeStart 反馈。"
            .into();
    }

    if matches!(step, GitStep::Push) {
        if combined.contains("Permission denied") || combined.contains("publickey") {
            return format!(
                "无法推送到 {host}：SSH 公钥尚未生效。\n\n\
                 请按顺序操作（均在 VibeStart 内完成，无需终端）：\n\
                 1. 点击上方「一键生成 SSH 密钥」（若尚未生成）\n\
                 2. 点击「复制 SSH 公钥」\n\
                 3. 点击「打开 {host} 添加公钥」，在网页中粘贴并保存\n\
                 4. 点击「测试连接」，显示成功后再点「开始部署」"
            );
        }
        if combined.contains("Could not resolve hostname") || combined.contains("Connection timed out") {
            return format!("无法连接 {host} 服务器，请检查网络后再次点击「开始部署」。");
        }
        if combined.contains("Repository not found") || combined.contains("does not exist") {
            return format!(
                "找不到仓库。请确认：\n\
                 1. 已在 {host} 网页新建空仓库（名称与上方填写一致）\n\
                 2. 用户名与仓库名拼写正确\n\
                 3. 修正后再次点击「开始部署」"
            );
        }
        return format!(
            "代码推送失败。请确认已在 {host} 创建同名空仓库，且 SSH 公钥已添加。\n\
             可先点「测试连接」确认通过，再「开始部署」。"
        );
    }

    if matches!(step, GitStep::RemoteAdd) {
        return "设置远程仓库地址失败。请再次点击「开始部署」；若仍失败，请确认项目目录未被其他程序占用。"
            .into();
    }

    "请查看下方日志。修正上方填写的用户名/仓库名后，再次点击「开始部署」。".into()
}
