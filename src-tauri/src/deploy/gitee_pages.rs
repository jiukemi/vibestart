use super::git_pages::{deploy_git_pages, GitPagesDeployConfig};
use super::DeployResult;

pub fn deploy_gitee_pages(project_dir: &str, username: &str, repo: &str) -> DeployResult {
    let remote = format!("git@gitee.com:{username}/{repo}.git");
    let repo_url = format!("https://gitee.com/{username}/{repo}");
    let success_footer = format!(
        "\n✅ 代码已推送到 Gitee（git push 成功）。\n\
         仓库地址：{repo_url}\n\n\
         ⚠️ Gitee Pages 静态站点服务已下线（2024 年起）。\n\
         仓库「服务」菜单中不再有 Gitee Pages，gitee.io 链接也无法使用。\n\n\
         【若要分享可访问的网站】\n\
         请在 VibeStart 部署页改选 Vercel，安装 CLI 并登录后再次部署。\n"
    );

    deploy_git_pages(GitPagesDeployConfig {
        project_dir,
        git_username: username,
        remote,
        branch: "master",
        pages_url: repo_url,
        success_footer,
        host: "Gitee",
    })
}
