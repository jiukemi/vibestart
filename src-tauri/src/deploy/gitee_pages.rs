use super::git_pages::{deploy_git_pages, GitPagesDeployConfig};
use super::DeployResult;

pub fn deploy_gitee_pages(project_dir: &str, username: &str, repo: &str) -> DeployResult {
    let remote = format!("git@gitee.com:{username}/{repo}.git");
    let pages_url = format!("https://{username}.gitee.io/{repo}/");
    let success_footer = format!(
        "\n✅ 代码已推送到 Gitee。\n\n\
         【下一步 — 开启 Gitee Pages】\n\
         1. 在浏览器打开：仓库 → 服务 → Gitee Pages\n\
         2. 分支选择 master，目录选 /\n\
         3. 点击「启动」\n\
         4. 免费版更新后需手动点「更新」\n\n\
         预计访问地址：{pages_url}\n"
    );

    deploy_git_pages(GitPagesDeployConfig {
        project_dir,
        git_username: username,
        remote,
        branch: "master",
        pages_url,
        success_footer,
    })
}
