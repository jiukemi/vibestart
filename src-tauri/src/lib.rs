mod browser;
mod claude_code;
mod codex_app;
mod codex_bridge;
mod config;
mod deploy;
mod env_scan;
mod filesystem;
mod ide_sync;
mod install_progress;
mod installer;
mod llm;
mod mirrors;
mod network;
mod os;
mod project;
mod ssh;
mod tools_install;
mod updater;

use config::{LlmConfig, NetworkConfig, ToolsInstallConfig, ToolsInstallMode};
use deploy::DeployResult;
use env_scan::ToolStatus;
use installer::CommandResult;
use llm::LlmTestResult;
use network::{GithubConnectivity, NetworkStatus};
use os::OsInfo;
use ssh::SshKeyInfo;
use tauri::AppHandle;
use updater::{DownloadUpdateResult, UpdateCheckResult};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_os_info() -> OsInfo {
    os::detect()
}

#[tauri::command]
async fn scan_environment() -> Result<Vec<ToolStatus>, String> {
    tauri::async_runtime::spawn_blocking(env_scan::scan_all)
        .await
        .map_err(|e| format!("扫描失败: {e}"))
}

#[tauri::command]
async fn install_tool(app: AppHandle, tool: String) -> Result<CommandResult, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        installer::install_tool(&tool, Some(&app))
    })
        .await
        .map_err(|e| format!("安装失败: {e}"))?;
    if result.success {
        Ok(result)
    } else {
        Err(result.log)
    }
}

#[tauri::command]
async fn upgrade_tool(app: AppHandle, tool: String) -> Result<CommandResult, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        installer::upgrade_tool(&tool, Some(&app))
    })
        .await
        .map_err(|e| format!("更新失败: {e}"))?;
    Ok(result)
}

#[tauri::command]
async fn uninstall_tool(app: AppHandle, tool: String) -> Result<CommandResult, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        installer::uninstall_tool(&tool, Some(&app))
    })
        .await
        .map_err(|e| format!("卸载失败: {e}"))?;
    Ok(result)
}

#[tauri::command]
fn ensure_ssh_key() -> Result<SshKeyInfo, String> {
    ssh::ensure_key()
}

#[tauri::command]
fn test_gitee_ssh() -> Result<String, String> {
    ssh::test_gitee()
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
fn init_project(
    app: AppHandle,
    pack_id: String,
    target_dir: String,
) -> Result<project::InitProjectResult, String> {
    project::init_project(&app, &pack_id, &target_dir)
}

#[tauri::command]
fn list_directory(path: String) -> Result<filesystem::DirectoryListing, String> {
    filesystem::list_directory(&path)
}

#[tauri::command]
fn create_subdirectory(
    parent_path: String,
    folder_name: String,
) -> Result<filesystem::DirEntry, String> {
    filesystem::create_subdirectory(&parent_path, &folder_name)
}

#[tauri::command]
fn home_directory() -> String {
    project::home_directory()
}

#[tauri::command]
fn default_projects_parent() -> String {
    project::default_projects_parent()
}

#[tauri::command]
fn create_project_directory(parent_dir: Option<String>, folder_name: String) -> Result<String, String> {
    project::create_project_directory(parent_dir.as_deref(), &folder_name)
}

#[tauri::command]
fn project_dir_status(dir: String) -> project::ProjectDirStatus {
    project::project_dir_status(&dir)
}

#[tauri::command]
fn reveal_project_dir(dir: String) -> Result<(), String> {
    project::reveal_project_dir(&dir)
}

#[tauri::command]
fn default_project_dir() -> String {
    project::default_project_dir()
}

#[tauri::command]
fn verify_ide_sync(
    ides: Vec<String>,
    provider: String,
    api_key: String,
) -> Vec<ide_sync::IdeSyncVerifyItem> {
    ide_sync::verify_ide_sync_batch(&ides, &provider, &api_key)
}

#[tauri::command]
fn get_ide_launch_state(ide: String) -> project::IdeLaunchState {
    project::get_ide_launch_state(&ide)
}

#[tauri::command]
fn launch_ide(
    ide: String,
    project_dir: Option<String>,
    mode: Option<String>,
) -> Result<(), String> {
    let launch_mode = match mode.as_deref() {
        Some("focus") => project::LaunchMode::Focus,
        _ => project::LaunchMode::New,
    };
    project::launch_ide(&ide, project_dir.as_deref(), launch_mode)
}

#[tauri::command]
fn default_tools_install_parent() -> String {
    tools_install::default_custom_tools_parent()
}

#[tauri::command]
fn get_tools_install_info() -> tools_install::ToolsInstallInfo {
    tools_install::get_tools_install_info()
}

#[tauri::command]
fn save_tools_install_config(mode: String, custom_dir: Option<String>) -> Result<(), String> {
    let mode = match mode.as_str() {
        "custom" => ToolsInstallMode::Custom,
        _ => ToolsInstallMode::Recommended,
    };
    tools_install::save_tools_install_config(ToolsInstallConfig { mode, custom_dir })
}

#[tauri::command]
fn open_in_ide(project_dir: String, ide: String) -> Result<(), String> {
    project::open_in_ide(&project_dir, &ide)
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

#[tauri::command]
async fn test_llm_api(
    provider: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<LlmTestResult, String> {
    llm::test_api(&provider, &api_key, base_url.as_deref()).await
}

#[tauri::command]
fn sync_llm_to_ides(
    ides: Vec<String>,
    provider: String,
    api_key: String,
) -> ide_sync::IdeSyncBatchResult {
    ide_sync::sync_llm_to_ides(&ides, &provider, &api_key)
}

#[tauri::command]
fn get_llm_config() -> Option<LlmConfig> {
    llm::get_llm_config()
}

#[tauri::command]
fn deploy_gitee_pages(project_dir: String, username: String, repo: String) -> DeployResult {
    deploy::deploy_gitee_pages(&project_dir, &username, &repo)
}

#[tauri::command]
fn open_external_browser(app: AppHandle, url: String) -> Result<(), String> {
    browser::open_external(&app, &url)
}

#[tauri::command]
async fn check_for_update() -> UpdateCheckResult {
    updater::check_for_update().await
}

#[tauri::command]
async fn download_app_update(app: AppHandle) -> DownloadUpdateResult {
    updater::download_app_update(app).await
}

#[tauri::command]
fn open_builtin_browser(
    app: AppHandle,
    url: String,
    _title: String,
    _force_in_app: Option<bool>,
) -> Result<String, String> {
    browser::open_external(&app, &url)?;
    Ok("external".into())
}

#[tauri::command]
fn open_github_in_app(app: AppHandle, url: String) -> Result<String, String> {
    browser::open_external(&app, &url)?;
    Ok("external".into())
}

#[tauri::command]
fn open_gitee_in_app(app: AppHandle, url: String) -> Result<String, String> {
    browser::open_external(&app, &url)?;
    Ok("external".into())
}

#[tauri::command]
fn get_browser_config() -> config::BrowserConfig {
    config::load_config()
        .browser
        .unwrap_or_default()
}

#[tauri::command]
fn save_browser_config(preset: String) -> Result<(), String> {
    let parsed = match preset.as_str() {
        "google_chrome" => config::BrowserPreset::GoogleChrome,
        "system_default" => config::BrowserPreset::SystemDefault,
        _ => return Err("无效的浏览器预设".into()),
    };
    let mut cfg = config::load_config();
    cfg.browser = Some(config::BrowserConfig { preset: parsed });
    config::save_config(&cfg)
}

#[tauri::command]
fn get_network_status() -> NetworkStatus {
    network::get_network_status()
}

#[tauri::command]
async fn test_github_connectivity() -> GithubConnectivity {
    network::test_github_connectivity().await
}

#[tauri::command]
fn apply_github_network(config: NetworkConfig) -> Result<String, String> {
    network::apply_github_network(&config)
}

#[tauri::command]
fn use_detected_proxy() -> Result<NetworkConfig, String> {
    network::use_detected_proxy()
}

#[tauri::command]
fn save_network_config(config: NetworkConfig) -> Result<(), String> {
    network::save_network_config(config)
}

#[tauri::command]
fn get_codex_bridge_config() -> config::CodexBridgeConfig {
    codex_bridge::get_codex_bridge_config()
}

#[tauri::command]
fn save_codex_bridge_config(
    mode: String,
    cc_switch_port: Option<u16>,
    deepseek_bridge_port: Option<u16>,
) -> Result<(), String> {
    let parsed = config::CodexBridgeMode::from_str_id(&mode)
        .ok_or_else(|| format!("无效的桥接模式: {mode}"))?;
    let mut cfg = codex_bridge::get_codex_bridge_config();
    cfg.mode = parsed;
    if let Some(port) = cc_switch_port {
        cfg.cc_switch_port = port;
    }
    if let Some(port) = deepseek_bridge_port {
        cfg.deepseek_bridge_port = port;
    }
    codex_bridge::save_codex_bridge_config(cfg)
}

#[tauri::command]
async fn check_codex_bridge_health(mode: Option<String>) -> codex_bridge::CodexBridgeHealth {
    let cfg = codex_bridge::get_codex_bridge_config();
    let bridge_mode = mode
        .as_deref()
        .and_then(config::CodexBridgeMode::from_str_id)
        .unwrap_or(cfg.mode);
    let port = codex_bridge::port_for_mode(&cfg, bridge_mode);
    codex_bridge::check_health(bridge_mode, port).await
}

#[tauri::command]
async fn start_deepseek_bridge() -> Result<CommandResult, String> {
    let result = tauri::async_runtime::spawn_blocking(codex_bridge::start_deepseek_bridge)
        .await
        .map_err(|e| format!("启动失败: {e}"))?;
    if result.success {
        Ok(result)
    } else {
        Err(result.log)
    }
}

#[tauri::command]
fn open_cc_switch_app() -> Result<(), String> {
    codex_bridge::open_cc_switch_app()
}

#[tauri::command]
async fn localize_codex_app(app: AppHandle) -> Result<CommandResult, String> {
    install_progress::emit(
        Some(&app),
        "run",
        "正在写入 Codex 中文配置…",
        Some(30),
    );
    let result = tauri::async_runtime::spawn_blocking(codex_app::localize_codex_app)
        .await
        .map_err(|e| format!("汉化失败: {e}"))?;
    install_progress::finish(Some(&app), result.success);
    if result.success {
        Ok(result)
    } else {
        Err(result.log)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(browser::BrowserShellState(std::sync::Mutex::new(
            browser::BrowserTabState::default(),
        )))
        .invoke_handler(tauri::generate_handler![
            greet,
            get_os_info,
            scan_environment,
            ensure_ssh_key,
            test_github_ssh,
            test_gitee_ssh,
            validate_project,
            deploy_vercel,
            deploy_github_pages,
            deploy_gitee_pages,
            init_project,
            home_directory,
            list_directory,
            create_subdirectory,
            default_project_dir,
            default_projects_parent,
            create_project_directory,
            project_dir_status,
            reveal_project_dir,
            install_tool,
            upgrade_tool,
            uninstall_tool,
            open_in_ide,
            open_in_cursor,
            open_local_preview,
            vercel_login,
            test_llm_api,
            sync_llm_to_ides,
            verify_ide_sync,
            get_ide_launch_state,
            launch_ide,
            get_llm_config,
            open_github_in_app,
            open_gitee_in_app,
            open_external_browser,
            check_for_update,
            download_app_update,
            open_builtin_browser,
            get_browser_config,
            save_browser_config,
            get_network_status,
            test_github_connectivity,
            apply_github_network,
            use_detected_proxy,
            save_network_config,
            get_tools_install_info,
            save_tools_install_config,
            default_tools_install_parent,
            get_codex_bridge_config,
            save_codex_bridge_config,
            check_codex_bridge_health,
            start_deepseek_bridge,
            open_cc_switch_app,
            localize_codex_app,
            browser::browser_tabs_get,
            browser::browser_tabs_save,
            browser::browser_close_shell,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
