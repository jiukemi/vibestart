use crate::config::{self, CodexBridgeConfig, CodexBridgeMode};
use crate::installer::CommandResult;
use crate::mirrors::{self, npm_registry};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;
use tauri::AppHandle;

const CODEX_BRIDGE_GITHUB: &str = "https://github.com/xiaoshaoning/codex-bridge.git";
pub const CC_SWITCH_DEFAULT_PORT: u16 = 15721;
pub const DEEPSEEK_BRIDGE_DEFAULT_PORT: u16 = 8098;

const AGENTS_ZH: &str = r#"# VibeStart · 中文协作偏好

- 始终使用**简体中文**回复与解释。
- 代码注释、提交说明建议用中文（专有名词可保留英文）。
- 执行终端命令前，用中文说明即将做什么。
- 遇到报错时，先中文概括原因，再给出修复步骤。
"#;

#[derive(Debug, Clone, Serialize)]
pub struct CodexBridgeHealth {
    pub mode: String,
    pub ready: bool,
    pub port: u16,
    pub message: String,
}

pub fn bridge_dir() -> Result<PathBuf, String> {
    Ok(config::vibestart_dir()?.join("tools").join("codex-bridge"))
}

pub fn get_codex_bridge_config() -> CodexBridgeConfig {
    config::load_config()
        .codex_bridge
        .unwrap_or_default()
}

pub fn save_codex_bridge_config(cfg: CodexBridgeConfig) -> Result<(), String> {
    let mut app = config::load_config();
    app.codex_bridge = Some(cfg);
    config::save_config(&app)
}

pub fn effective_mode(cfg: &CodexBridgeConfig, provider: &str) -> CodexBridgeMode {
    match cfg.mode {
        CodexBridgeMode::None if provider == "openai" => CodexBridgeMode::None,
        CodexBridgeMode::None if provider == "deepseek" => CodexBridgeMode::DeepseekBridge,
        CodexBridgeMode::None => CodexBridgeMode::CcSwitch,
        other => other,
    }
}

pub fn port_for_mode(cfg: &CodexBridgeConfig, mode: CodexBridgeMode) -> u16 {
    match mode {
        CodexBridgeMode::CcSwitch => cfg.cc_switch_port,
        CodexBridgeMode::DeepseekBridge => cfg.deepseek_bridge_port,
        CodexBridgeMode::None => CC_SWITCH_DEFAULT_PORT,
    }
}

pub fn build_codex_openai_config_toml(model: &str) -> String {
    format!(
        r#"cli_auth_credentials_store = "file"
model = "{model}"
model_provider = "vibestart-openai"

{}
[model_providers.vibestart-openai]
name = "VibeStart OpenAI"
base_url = "https://api.openai.com/v1"
wire_api = "responses"
requires_openai_auth = false
env_key = "OPENAI_API_KEY"
"#,
        crate::codex_app::codex_locale_sections()
    )
}

pub fn build_codex_config_toml(mode: CodexBridgeMode, model: &str, port: u16) -> String {
    let locale = crate::codex_app::codex_locale_sections();
    let dev_instructions = r#"developer_instructions = "请用简体中文与用户交流。除非用户要求英文，否则解释、计划、总结均使用中文。"
"#;
    match mode {
        CodexBridgeMode::CcSwitch => format!(
            r#"cli_auth_credentials_store = "file"
model = "{model}"
model_provider = "vibestart-bridge"
{dev_instructions}
{locale}[model_providers.vibestart-bridge]
name = "VibeStart via CC Switch"
base_url = "http://127.0.0.1:{port}/v1"
wire_api = "responses"
requires_openai_auth = false
env_key = "OPENAI_API_KEY"
"#
        ),
        CodexBridgeMode::DeepseekBridge => format!(
            r#"cli_auth_credentials_store = "file"
model = "{model}"
model_provider = "deepseek"
{dev_instructions}
{locale}[model_providers.deepseek]
name = "DeepSeek via VibeStart Bridge"
base_url = "http://127.0.0.1:{port}/v1"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
env_key = "OPENAI_API_KEY"
"#
        ),
        CodexBridgeMode::None => format!(
            "cli_auth_credentials_store = \"file\"\n\n{locale}"
        ),
    }
}

pub fn write_agents_md(codex_home: &Path) -> Result<(), String> {
    fs::write(codex_home.join("AGENTS.md"), AGENTS_ZH)
        .map_err(|e| format!("写入 AGENTS.md 失败: {e}"))
}

pub async fn check_health(mode: CodexBridgeMode, port: u16) -> CodexBridgeHealth {
    let mode_str = mode.as_str().to_string();
    if mode == CodexBridgeMode::None {
        return CodexBridgeHealth {
            mode: mode_str,
            ready: true,
            port,
            message: "OpenAI 官方直连，无需本地桥接".into(),
        };
    }

    let (url, expect_json) = match mode {
        CodexBridgeMode::CcSwitch => (format!("http://127.0.0.1:{port}/"), false),
        CodexBridgeMode::DeepseekBridge => {
            (format!("http://127.0.0.1:{port}/health"), true)
        }
        CodexBridgeMode::None => unreachable!(),
    };

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return CodexBridgeHealth {
                mode: mode_str,
                ready: false,
                port,
                message: format!("健康检查客户端初始化失败: {e}"),
            };
        }
    };

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if expect_json {
                match resp.json::<serde_json::Value>().await {
                    Ok(json) if json.get("status").and_then(|v| v.as_str()) == Some("ok") => {
                        CodexBridgeHealth {
                            mode: mode_str,
                            ready: true,
                            port,
                            message: "DeepSeek 桥接服务已就绪".into(),
                        }
                    }
                    _ => CodexBridgeHealth {
                        mode: mode_str,
                        ready: false,
                        port,
                        message: "桥接端口有响应，但 /health 未返回 ok".into(),
                    },
                }
            } else {
                CodexBridgeHealth {
                    mode: mode_str,
                    ready: true,
                    port,
                    message: "CC Switch 本地路由已响应".into(),
                }
            }
        }
        Ok(resp) if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS
            && mode == CodexBridgeMode::DeepseekBridge =>
        {
            CodexBridgeHealth {
                mode: mode_str,
                ready: true,
                port,
                message: "DeepSeek 桥接服务已就绪".into(),
            }
        }
        Ok(resp) => CodexBridgeHealth {
            mode: mode_str,
            ready: false,
            port,
            message: format!("桥接未就绪（HTTP {}）", resp.status()),
        },
        Err(e) => CodexBridgeHealth {
            mode: mode_str,
            ready: false,
            port,
            message: match mode {
                CodexBridgeMode::CcSwitch => format!(
                    "CC Switch 路由未响应（127.0.0.1:{port}）。请打开 CC Switch 并开启 Codex 路由。详情: {e}"
                ),
                CodexBridgeMode::DeepseekBridge => format!(
                    "DeepSeek 桥未运行（127.0.0.1:{port}）。请安装并启动 bridge。详情: {e}"
                ),
                CodexBridgeMode::None => e.to_string(),
            },
        },
    }
}

pub fn install_deepseek_bridge(app: Option<&AppHandle>) -> CommandResult {
    let dir = match bridge_dir() {
        Ok(d) => d,
        Err(e) => {
            return CommandResult {
                success: false,
                log: e,
            };
        }
    };

    if let Some(parent) = dir.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return CommandResult {
                success: false,
                log: format!("创建工具目录失败: {e}"),
            };
        }
    }

    let mut log = format!("npm registry: {}\n\n", npm_registry());

    if dir.join("dist").join("server.js").exists() {
        log.push_str("bridge 已安装，跳过下载。\n");
        write_bridge_start_scripts(&dir);
        return CommandResult {
            success: true,
            log,
        };
    }

    if !dir.join("package.json").exists() {
        if let Some(url) = mirrors::codex_bridge_prebuilt_url() {
            log.push_str(&format!("正在从 Gitee 下载预构建包…\n{url}\n\n"));
            match install_from_gitee_zip(app, &url, &dir, true) {
                Ok(()) => log.push_str("预构建包解压完成。\n"),
                Err(e) => {
                    log.push_str(&format!("Gitee 预构建包失败: {e}\n\n"));
                    if let Some(src_url) = mirrors::codex_bridge_source_url() {
                        log.push_str(&format!("尝试 Gitee 源码包…\n{src_url}\n\n"));
                        match install_from_gitee_zip(app, &src_url, &dir, false) {
                            Ok(()) => log.push_str("源码包解压完成。\n"),
                            Err(e2) => {
                                log.push_str(&format!("Gitee 源码包失败: {e2}\n\n"));
                                log.push_str(&try_git_clone_github(&dir));
                            }
                        }
                    } else {
                        log.push_str(&try_git_clone_github(&dir));
                    }
                }
            }
        } else if let Some(src_url) = mirrors::codex_bridge_source_url() {
            log.push_str("未配置 Gitee 预构建包 URL，尝试源码包…\n");
            log.push_str(&format!("{src_url}\n\n"));
            match install_from_gitee_zip(app, &src_url, &dir, false) {
                Ok(()) => log.push_str("源码包解压完成。\n"),
                Err(e) => {
                    log.push_str(&format!("Gitee 源码包失败: {e}\n\n"));
                    log.push_str(&try_git_clone_github(&dir));
                }
            }
        } else {
            log.push_str(
                "未配置 Gitee 镜像（mirrors.json 仍为 YOUR_GITEE_USER）。\n\
                 请按 docs/MIRRORS.md 上传 Release 后重打 VibeStart，或临时使用 GitHub 克隆：\n\n",
            );
            log.push_str(&try_git_clone_github(&dir));
        }
    }

    if !dir.join("package.json").exists() {
        log.push_str("\n\n安装失败：未找到 package.json。请按 docs/MIRRORS.md 配置 Gitee Release。");
        return CommandResult {
            success: false,
            log,
        };
    }

    if !dir.join("dist").join("server.js").exists() {
        if !dir.join("node_modules").is_dir() {
            log.push_str("\n正在 npm install…\n");
            let npm_install = run_npm_in_dir(&dir, &["install"]);
            log.push_str(&npm_install.log);
            if !npm_install.success {
                log.push_str("\n\nnpm install 失败。请检查 Node 与国内 npm 源。");
                return CommandResult {
                    success: false,
                    log,
                };
            }
        }

        log.push_str("\n正在 npm run build…\n");
        let npm_build = run_npm_in_dir(&dir, &["run", "build"]);
        log.push_str(&npm_build.log);
        if !npm_build.success {
            log.push_str("\n\nnpm run build 失败。");
            return CommandResult {
                success: false,
                log,
            };
        }
    }

    write_bridge_start_scripts(&dir);

    log.push_str("\n\n✅ codex-bridge 安装完成。\n");
    log.push_str("下一步：点击「启动 DeepSeek 桥」或在终端运行：\n");
    log.push_str(&format!(
        "  cd \"{}\" && DEEPSEEK_API_KEY=你的Key npm start\n",
        dir.display()
    ));
    log.push_str(&format!(
        "健康检查地址：http://127.0.0.1:{DEEPSEEK_BRIDGE_DEFAULT_PORT}/health\n"
    ));

    CommandResult {
        success: true,
        log,
    }
}

fn install_from_gitee_zip(
    app: Option<&AppHandle>,
    url: &str,
    dir: &Path,
    prebuilt: bool,
) -> Result<(), String> {
    let tmp = std::env::temp_dir().join(format!(
        "vibestart-codex-bridge-{}.zip",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    mirrors::download_file(app, url, &tmp)?;
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|e| format!("清理旧目录失败: {e}"))?;
    }
    fs::create_dir_all(dir).map_err(|e| format!("创建目录失败: {e}"))?;
    mirrors::extract_zip(&tmp, dir)?;
    let _ = fs::remove_file(&tmp);
    if prebuilt && !dir.join("dist").join("server.js").exists() {
        return Err("预构建包内缺少 dist/server.js，请重新打包上传".into());
    }
    Ok(())
}

fn try_git_clone_github(dir: &Path) -> String {
    let mut out = String::from("正在从 GitHub 克隆 codex-bridge（国内可能较慢）…\n");
    let clone = Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            CODEX_BRIDGE_GITHUB,
            &dir.to_string_lossy(),
        ])
        .output();
    match clone {
        Ok(result) => {
            out.push_str(&String::from_utf8_lossy(&result.stdout));
            out.push_str(&String::from_utf8_lossy(&result.stderr));
            if !result.status.success() {
                out.push_str("\nGitHub 克隆失败。请配置 Gitee 镜像：docs/MIRRORS.md\n");
            }
        }
        Err(e) => {
            out.push_str(&format!("无法执行 git: {e}\n请配置 Gitee 镜像：docs/MIRRORS.md\n"));
        }
    }
    out
}

fn run_npm_in_dir(dir: &Path, args: &[&str]) -> CommandResult {
    let mut cmd = match crate::tools_install::npm_command_process() {
        Ok(c) => c,
        Err(msg) => {
            return CommandResult {
                success: false,
                log: msg,
            };
        }
    };
    cmd.current_dir(dir).args(args);
    crate::tools_install::apply_npm_runtime_env(&mut cmd);
    match cmd.output()
    {
        Ok(output) => CommandResult {
            success: output.status.success(),
            log: format!(
                "$ npm {}\n\n{}{}",
                args.join(" "),
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            ),
        },
        Err(e) => CommandResult {
            success: false,
            log: format!("无法执行 npm: {e}"),
        },
    }
}

fn write_bridge_start_scripts(dir: &Path) {
    let sh = format!(
        "#!/bin/sh\n# VibeStart · 启动 DeepSeek Codex 桥\ncd \"{}\"\nexport PORT={DEEPSEEK_BRIDGE_DEFAULT_PORT}\nexport RATE_LIMIT_MAX=5000\nif [ -z \"$DEEPSEEK_API_KEY\" ]; then\n  echo \"请设置 DEEPSEEK_API_KEY 环境变量\"\n  exit 1\nfi\nnpm start\n",
        dir.display()
    );
    let _ = fs::write(dir.join("vibestart-start-bridge.sh"), sh);

    let bat = format!(
        "@echo off\r\nREM VibeStart · 启动 DeepSeek Codex 桥\r\ncd /d \"{}\"\r\nset PORT={DEEPSEEK_BRIDGE_DEFAULT_PORT}\r\nset RATE_LIMIT_MAX=5000\r\nif \"%DEEPSEEK_API_KEY%\"==\"\" (\r\n  echo 请设置 DEEPSEEK_API_KEY 环境变量\r\n  exit /b 1\r\n)\r\nnpm start\r\n",
        dir.display()
    );
    let _ = fs::write(dir.join("vibestart-start-bridge.bat"), bat);
}

fn is_port_listening(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap_or_else(|_| {
        ([127, 0, 0, 1], port).into()
    });
    TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
}

pub fn start_deepseek_bridge() -> CommandResult {
    let dir = match bridge_dir() {
        Ok(d) => d,
        Err(e) => {
            return CommandResult {
                success: false,
                log: e,
            };
        }
    };

    if !dir.join("dist").join("server.js").exists() {
        return CommandResult {
            success: false,
            log: format!(
                "未找到已构建的 bridge（{}）。请先点击「一键安装 DeepSeek 桥」。",
                dir.join("dist/server.js").display()
            ),
        };
    }

    let api_key = config::load_config()
        .llm
        .filter(|c| c.provider == "deepseek")
        .map(|c| c.api_key)
        .unwrap_or_default();

    if api_key.trim().is_empty() {
        return CommandResult {
            success: false,
            log: "未找到已保存的 DeepSeek API Key。请先在向导中验证并保存 Key，或在 CC Switch / bridge 中单独配置。".into(),
        };
    }

    if is_port_listening(DEEPSEEK_BRIDGE_DEFAULT_PORT) {
        return CommandResult {
            success: true,
            log: format!(
                "DeepSeek 桥已在运行（端口 {DEEPSEEK_BRIDGE_DEFAULT_PORT}）。\n\
                 若健康检查异常，请点「重新检测」或重启应用后再试。"
            ),
        };
    }

    let mut cmd = match crate::tools_install::npm_command_process() {
        Ok(c) => c,
        Err(msg) => {
            return CommandResult {
                success: false,
                log: msg,
            };
        }
    };
    cmd.current_dir(&dir)
        .arg("start")
        .env("DEEPSEEK_API_KEY", api_key.trim())
        .env("PORT", DEEPSEEK_BRIDGE_DEFAULT_PORT.to_string())
        .env("RATE_LIMIT_MAX", "5000")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    crate::tools_install::apply_npm_runtime_env(&mut cmd);

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    match cmd.spawn() {
        Ok(_) => CommandResult {
            success: true,
            log: format!(
                "已在后台启动 DeepSeek 桥（端口 {DEEPSEEK_BRIDGE_DEFAULT_PORT}）。\n\
                 若健康检查仍失败，请在终端手动运行并保持窗口打开：\n\
                 cd \"{}\" && DEEPSEEK_API_KEY=*** npm start",
                dir.display()
            ),
        },
        Err(e) => CommandResult {
            success: false,
            log: format!(
                "后台启动失败: {e}\n请手动运行：cd \"{}\" && DEEPSEEK_API_KEY=你的Key npm start",
                dir.display()
            ),
        },
    }
}

pub fn open_cc_switch_app() -> Result<(), String> {
    if cfg!(target_os = "macos") {
        Command::new("open")
            .arg("-a")
            .arg("CC Switch")
            .spawn()
            .map_err(|e| format!("无法打开 CC Switch: {e}"))?;
    } else if cfg!(target_os = "windows") {
        let candidates = [
            dirs::home_dir().map(|h| {
                h.join("AppData/Local/Programs/CC Switch/CC Switch.exe")
            }),
            Some(PathBuf::from(
                r"C:\Program Files\CC Switch\CC Switch.exe",
            )),
        ];
        for path in candidates.into_iter().flatten() {
            if path.exists() {
                Command::new(&path)
                    .spawn()
                    .map_err(|e| format!("无法打开 CC Switch: {e}"))?;
                return Ok(());
            }
        }
        return Err("未找到 CC Switch。请从开始菜单手动打开，或重新安装。".into());
    } else {
        return Err("当前平台请手动打开 CC Switch。".into());
    }
    Ok(())
}
