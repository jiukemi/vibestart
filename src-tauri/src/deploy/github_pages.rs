use super::git_pages::{deploy_git_pages, GitPagesDeployConfig};
use super::DeployResult;

pub fn deploy_github_pages(project_dir: &str, username: &str, repo: &str) -> DeployResult {
    let remote = format!("git@github.com:{username}/{repo}.git");
    let pages_url = format!("https://{username}.github.io/{repo}/");

    deploy_git_pages(GitPagesDeployConfig {
        project_dir,
        git_username: username,
        remote,
        branch: "main",
        pages_url: pages_url.clone(),
        success_footer: String::new(),
        host: "GitHub",
    })
}
