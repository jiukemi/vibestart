mod deploy;
mod env_scan;
mod os;
mod project;
mod ssh;

use deploy::DeployResult;
use env_scan::ToolStatus;
use os::OsInfo;
use ssh::SshKeyInfo;
use tauri::AppHandle;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_os_info() -> OsInfo {
    os::detect()
}

#[tauri::command]
fn scan_environment() -> Vec<ToolStatus> {
    env_scan::scan_all()
}

#[tauri::command]
fn ensure_ssh_key() -> Result<SshKeyInfo, String> {
    ssh::ensure_key()
}

#[tauri::command]
fn test_github_ssh() -> Result<String, String> {
    ssh::test_github()
}

#[tauri::command]
fn validate_project(project_dir: String) -> Result<(), String> {
    deploy::validate_project(&project_dir)
}

#[tauri::command]
fn deploy_vercel(project_dir: String) -> DeployResult {
    deploy::deploy_vercel(&project_dir)
}

#[tauri::command]
fn deploy_github_pages(project_dir: String, username: String, repo: String) -> DeployResult {
    deploy::deploy_github_pages(&project_dir, &username, &repo)
}

#[tauri::command]
fn init_project(app: AppHandle, pack_id: String, target_dir: String) -> Result<(), String> {
    project::init_project(&app, &pack_id, &target_dir)
}

#[tauri::command]
fn default_project_dir() -> String {
    project::default_project_dir()
}

#[tauri::command]
fn open_in_cursor(project_dir: String) -> Result<(), String> {
    project::open_in_cursor(&project_dir)
}

#[tauri::command]
fn open_local_preview(project_dir: String) -> Result<(), String> {
    project::open_local_preview(&project_dir)
}

#[tauri::command]
fn vercel_login() -> Result<String, String> {
    project::vercel_login()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_os_info,
            scan_environment,
            ensure_ssh_key,
            test_github_ssh,
            validate_project,
            deploy_vercel,
            deploy_github_pages,
            init_project,
            default_project_dir,
            open_in_cursor,
            open_local_preview,
            vercel_login,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
