mod gitee_pages;
mod github_pages;
mod vercel;

use serde::Serialize;

pub use gitee_pages::deploy_gitee_pages;
pub use github_pages::deploy_github_pages;
pub use vercel::deploy_vercel;

#[derive(Debug, Serialize)]
pub struct DeployResult {
    pub success: bool,
    pub url: Option<String>,
    pub log: String,
}

pub fn validate_project(project_dir: &str) -> Result<(), String> {
    let index = std::path::Path::new(project_dir).join("index.html");
    if !index.exists() {
        return Err("index.html 不存在，请先在 Cursor 中完成网页制作".into());
    }
    let content = std::fs::read_to_string(&index).map_err(|e| e.to_string())?;
    if content.trim().len() < 50 {
        return Err("index.html 内容太少，请继续用 AI 完善页面".into());
    }
    let env = std::path::Path::new(project_dir).join(".env");
    if env.exists() {
        return Err("检测到 .env 文件，请勿部署含 API Key 的项目".into());
    }
    Ok(())
}
