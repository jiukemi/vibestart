use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::codex_bridge::{
    self, build_codex_config_toml, effective_mode, port_for_mode, write_agents_md,
};
use crate::config::{self, CodexBridgeMode, vibestart_dir};

fn quit_app_hint() -> &'static str {
    if cfg!(target_os = "windows") {
        "Windows: Alt+F4 或从菜单完全退出"
    } else {
        "macOS: Cmd+Q"
    }
}

fn settings_shortcut_hint() -> &'static str {
    if cfg!(target_os = "windows") {
        "Ctrl+,"
    } else {
        "Cmd+,"
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct IdeSyncItemResult {
    pub ide: String,
    pub ide_name: String,
    pub success: bool,
    pub message: String,
    pub details: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct IdeSyncBatchResult {
    pub success: bool,
    pub message: String,
    pub results: Vec<IdeSyncItemResult>,
}

struct ClaudeCodeConfig {
    anthropic_base_url: &'static str,
    model: &'static str,
    sonnet: &'static str,
    opus: &'static str,
    haiku: &'static str,
    subagent: &'static str,
}

struct ProviderProfile {
    env_var: &'static str,
    openai_base_url: &'static str,
    model_hint: &'static str,
    claude_code: Option<ClaudeCodeConfig>,
}

fn provider_profile(provider: &str) -> Option<ProviderProfile> {
    Some(match provider {
        "deepseek" => ProviderProfile {
            env_var: "DEEPSEEK_API_KEY",
            openai_base_url: "https://api.deepseek.com/v1",
            model_hint: "deepseek-chat",
            claude_code: Some(ClaudeCodeConfig {
                anthropic_base_url: "https://api.deepseek.com/anthropic",
                model: "deepseek-chat",
                sonnet: "deepseek-chat",
                opus: "deepseek-chat",
                haiku: "deepseek-chat",
                subagent: "deepseek-chat",
            }),
        },
        "tongyi" => ProviderProfile {
            env_var: "DASHSCOPE_API_KEY",
            openai_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            model_hint: "qwen-turbo",
            claude_code: None,
        },
        "zhipu" => ProviderProfile {
            env_var: "ZHIPUAI_API_KEY",
            openai_base_url: "https://open.bigmodel.cn/api/paas/v4",
            model_hint: "glm-4-flash",
            claude_code: None,
        },
        "kimi" => ProviderProfile {
            env_var: "MOONSHOT_API_KEY",
            openai_base_url: "https://api.moonshot.cn/v1",
            model_hint: "moonshot-v1-8k",
            claude_code: Some(ClaudeCodeConfig {
                anthropic_base_url: "https://api.moonshot.cn/anthropic",
                model: "moonshot-v1-8k",
                sonnet: "moonshot-v1-8k",
                opus: "moonshot-v1-8k",
                haiku: "moonshot-v1-8k",
                subagent: "moonshot-v1-8k",
            }),
        },
        "openai" => ProviderProfile {
            env_var: "OPENAI_API_KEY",
            openai_base_url: "https://api.openai.com/v1",
            model_hint: "gpt-4o-mini",
            claude_code: None,
        },
        _ => return None,
    })
}

pub fn sync_llm_to_ides(ides: &[String], provider: &str, api_key: &str) -> IdeSyncBatchResult {
    let key = api_key.trim();
    if key.is_empty() {
        return IdeSyncBatchResult {
            success: false,
            message: "API Key 为空，无法同步".into(),
            results: vec![],
        };
    }

    if ides.is_empty() {
        return IdeSyncBatchResult {
            success: false,
            message: "请至少选择一个编辑器".into(),
            results: vec![],
        };
    }

    let profile = match provider_profile(provider) {
        Some(p) => p,
        None => {
            return IdeSyncBatchResult {
                success: false,
                message: format!("未知服务商: {provider}"),
                results: vec![],
            };
        }
    };

    let mut shared_details = Vec::new();
    let mut env_ok = true;
    match write_vibestart_env(provider, profile.env_var, key, profile.openai_base_url) {
        Ok(path) => shared_details.push(format!("已写入 {path}")),
        Err(e) => {
            env_ok = false;
            shared_details.push(format!("写入 llm.env 失败: {e}"));
        }
    }

    let mut results = Vec::new();
    let mut all_ok = env_ok;

    for ide in ides {
        let inner = sync_single_ide(ide, provider, key, &profile);
        let item = IdeSyncItemResult {
            ide: ide.clone(),
            ide_name: ide_display_name(ide).to_string(),
            success: inner.success,
            message: inner.message,
            details: inner.details,
        };
        if !item.success {
            all_ok = false;
        }
        results.push(item);
    }

    let names: Vec<&str> = results.iter().map(|r| r.ide_name.as_str()).collect();
    let mut message = if all_ok {
        format!("已同步到 {}（重启对应编辑器后生效）", names.join("、"))
    } else {
        format!("部分编辑器同步失败：{}", names.join("、"))
    };
    if let Some(note) = shared_details.first() {
        message = format!("{message}\n{note}");
    }

    IdeSyncBatchResult {
        success: all_ok,
        message,
        results,
    }
}

fn sync_single_ide(
    ide: &str,
    provider: &str,
    api_key: &str,
    profile: &ProviderProfile,
) -> InnerSyncResult {
    match ide {
        "cursor" | "trae" | "windsurf" => {
            sync_vscode_fork(ide, api_key, profile.openai_base_url)
        }
        "claude-code" => sync_claude_code(provider, api_key, profile),
        "codex" => sync_codex(provider, api_key, profile),
        "tongyi-lingma" => sync_tongyi_lingma(api_key, profile),
        _ => InnerSyncResult {
            success: false,
            message: format!("不支持的编辑器: {ide}"),
            details: vec![],
        },
    }
}

struct InnerSyncResult {
    success: bool,
    message: String,
    details: Vec<String>,
}

fn write_vibestart_env(
    provider: &str,
    env_var: &str,
    api_key: &str,
    base_url: &str,
) -> Result<String, String> {
    let dir = vibestart_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("llm.env");
    let content = format!(
        "# VibeStart 自动同步 — 请勿提交到 Git\n\
         VIBESTART_LLM_PROVIDER={provider}\n\
         {env_var}={api_key}\n\
         OPENAI_API_KEY={api_key}\n\
         OPENAI_BASE_URL={base_url}\n"
    );
    fs::write(&path, content).map_err(|e| format!("写入 llm.env 失败: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o600);
        fs::set_permissions(&path, perms).map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().to_string())
}

fn sync_vscode_fork(ide: &str, api_key: &str, base_url: &str) -> InnerSyncResult {
    let app_name = vscode_app_name(ide);
    let db_path = vscode_state_db_path(app_name);

    if let Some(path) = db_path {
        if path.exists() {
            match update_cursor_style_storage(&path, api_key, base_url) {
                Ok(()) => {
                    return InnerSyncResult {
                        success: true,
                        message: format!("已写入 {app_name} 模型配置（OpenAI 兼容模式）"),
                        details: vec![
                            format!("Base URL: {base_url}"),
                            "请在编辑器 Settings → Models 中确认已启用自定义 API Key".into(),
                            format!("修改后请完全退出并重启编辑器（{}）", quit_app_hint()),
                        ],
                    };
                }
                Err(e) => {
                    return InnerSyncResult {
                        success: false,
                        message: format!("写入 {app_name} 配置失败: {e}"),
                        details: vec![],
                    };
                }
            }
        }
    }

    InnerSyncResult {
        success: false,
        message: format!(
            "未找到 {app_name} 配置目录，请先安装并启动一次 {}",
            ide_display_name(ide)
        ),
        details: vec![format!(
            "Key 已保存在 ~/.vibestart/llm.env，安装编辑器后可重新验证同步"
        )],
    }
}

fn update_cursor_style_storage(db_path: &Path, api_key: &str, base_url: &str) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path).map_err(|e| format!("打开配置库失败: {e}"))?;

    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('cursorAuth/openAIKey', ?1)",
        [api_key],
    )
    .map_err(|e| format!("写入 API Key 失败: {e}"))?;

    let storage_key =
        "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser";

    let current: Option<String> = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = ?1",
            [storage_key],
            |row| row.get(0),
        )
        .ok();

    if let Some(raw) = current {
        let mut json: serde_json::Value =
            serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
        if let Some(obj) = json.as_object_mut() {
            obj.insert(
                "openAIBaseUrl".to_string(),
                serde_json::Value::String(base_url.trim_end_matches('/').to_string()),
            );
            obj.insert("useOpenAIKey".to_string(), serde_json::Value::Bool(true));
            obj.insert(
                "openAIKey".to_string(),
                serde_json::Value::String(api_key.to_string()),
            );
        }
        let updated = serde_json::to_string(&json).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE ItemTable SET value = ?1 WHERE key = ?2",
            rusqlite::params![updated, storage_key],
        )
        .map_err(|e| format!("更新 Base URL 失败: {e}"))?;
    }

    Ok(())
}

fn sync_claude_code(provider: &str, api_key: &str, profile: &ProviderProfile) -> InnerSyncResult {
    let Some(cc) = &profile.claude_code else {
        return InnerSyncResult {
            success: false,
            message: format!(
                "Claude Code 暂不支持 {provider} 直连同步",
            ),
            details: vec![
                "Claude Code 只认 Anthropic 协议（非 OpenAI 兼容）".into(),
                "DeepSeek / Kimi 已支持；通义 / 智谱 / OpenAI 请改用 Cursor、Codex 等".into(),
                "或手动编辑 ~/.claude/settings.json 配置网关".into(),
            ],
        };
    };

    let home = match dirs::home_dir() {
        Some(h) => h,
        None => {
            return InnerSyncResult {
                success: false,
                message: "无法获取用户主目录".into(),
                details: vec![],
            };
        }
    };

    let settings_path = home.join(".claude").join("settings.json");
    if let Some(parent) = settings_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let mut settings: serde_json::Value = if settings_path.exists() {
        fs::read_to_string(&settings_path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_else(|| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let env = settings
        .as_object_mut()
        .and_then(|obj| {
            if !obj.contains_key("env") {
                obj.insert("env".to_string(), serde_json::json!({}));
            }
            obj.get_mut("env").and_then(|v| v.as_object_mut())
        });

    let Some(env_obj) = env else {
        return InnerSyncResult {
            success: false,
            message: "Claude Code 配置格式异常".into(),
            details: vec![],
        };
    };

    // Claude Code reads Anthropic env vars, not OpenAI-compatible ones.
    let insert_str = |obj: &mut serde_json::Map<String, serde_json::Value>, k: &str, v: &str| {
        obj.insert(k.to_string(), serde_json::Value::String(v.to_string()));
    };

    insert_str(env_obj, "ANTHROPIC_BASE_URL", cc.anthropic_base_url);
    insert_str(env_obj, "ANTHROPIC_AUTH_TOKEN", api_key);
    // DeepSeek 等第三方只用 AUTH_TOKEN；与 API_KEY 同时存在会触发 Claude Code 警告
    env_obj.remove("ANTHROPIC_API_KEY");
    insert_str(env_obj, "ANTHROPIC_MODEL", cc.model);
    insert_str(env_obj, "ANTHROPIC_DEFAULT_SONNET_MODEL", cc.sonnet);
    insert_str(env_obj, "ANTHROPIC_DEFAULT_OPUS_MODEL", cc.opus);
    insert_str(env_obj, "ANTHROPIC_DEFAULT_HAIKU_MODEL", cc.haiku);
    insert_str(env_obj, "CLAUDE_CODE_SUBAGENT_MODEL", cc.subagent);
    insert_str(env_obj, "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1");

    // Remove stale OpenAI vars that do not affect Claude Code routing.
    for stale in ["OPENAI_API_KEY", "OPENAI_BASE_URL"] {
        env_obj.remove(stale);
    }

    if let Some(obj) = settings.as_object_mut() {
        let theme = obj
            .get("theme")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if theme.is_empty() || theme == "auto" {
            obj.insert(
                "theme".to_string(),
                serde_json::Value::String("dark-ansi".to_string()),
            );
        }
    }

    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string());
    match json {
        Ok(raw) => {
            if let Err(e) = fs::write(&settings_path, raw) {
                return InnerSyncResult {
                    success: false,
                    message: format!("写入 Claude Code 配置失败: {e}"),
                    details: vec![],
                };
            }
            let _ = crate::claude_code::ensure_readable_terminal_settings();
            InnerSyncResult {
                success: true,
                message: "已写入 Claude Code Anthropic 兼容配置".into(),
                details: vec![
                    format!("ANTHROPIC_BASE_URL = {}", cc.anthropic_base_url),
                    format!("ANTHROPIC_MODEL = {}", cc.model),
                    "主题已设为 dark-ansi（避免终端色块看不清）".into(),
                    "AI 回复语言已设为中文（界面提示仍为英文）".into(),
                    "重新打开终端后运行 claude 即可".into(),
                ],
            }
        }
        Err(e) => InnerSyncResult {
            success: false,
            message: format!("序列化 Claude Code 配置失败: {e}"),
            details: vec![],
        },
    }
}

fn sync_codex(provider: &str, api_key: &str, profile: &ProviderProfile) -> InnerSyncResult {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => {
            return InnerSyncResult {
                success: false,
                message: "无法获取用户主目录".into(),
                details: vec![],
            };
        }
    };

    let codex_home = home.join(".codex");
    if let Err(e) = fs::create_dir_all(&codex_home) {
        return InnerSyncResult {
            success: false,
            message: format!("创建 ~/.codex 失败: {e}"),
            details: vec![],
        };
    }

    let mut app_cfg = config::load_config();
    let bridge_cfg = app_cfg.codex_bridge.get_or_insert_with(Default::default);
    bridge_cfg.last_provider = Some(provider.to_string());
    let mode = effective_mode(bridge_cfg, provider);

    if mode == CodexBridgeMode::DeepseekBridge && provider != "deepseek" {
        return InnerSyncResult {
            success: false,
            message: "DeepSeek 专用桥仅支持 DeepSeek 供应商".into(),
            details: vec!["请改用 CC Switch 路由，或切换 LLM 为 DeepSeek。".into()],
        };
    }

    let env_path = codex_home.join(".env");
    let env_content = if provider == "openai" {
        format!("OPENAI_API_KEY={api_key}\n")
    } else {
        format!(
            "OPENAI_API_KEY={api_key}\n{}={api_key}\n",
            profile.env_var
        )
    };
    if let Err(e) = fs::write(&env_path, env_content) {
        return InnerSyncResult {
            success: false,
            message: format!("写入 Codex env 失败: {e}"),
            details: vec![],
        };
    }

    let config_path = codex_home.join("config.toml");
    let config_body = if provider == "openai" {
        format!(
            "model = \"{model}\"\nmodel_provider = \"openai\"\n",
            model = profile.model_hint
        )
    } else {
        let model = codex_model_for_provider(provider, profile);
        let port = port_for_mode(bridge_cfg, mode);
        build_codex_config_toml(mode, model, port)
    };

    if let Err(e) = fs::write(&config_path, config_body) {
        return InnerSyncResult {
            success: false,
            message: format!("写入 Codex config.toml 失败: {e}"),
            details: vec![],
        };
    }

    if provider != "openai" {
        if let Err(e) = write_agents_md(&codex_home) {
            return InnerSyncResult {
                success: false,
                message: e,
                details: vec![],
            };
        }
    }

    if let Err(e) = config::save_config(&app_cfg) {
        return InnerSyncResult {
            success: false,
            message: format!("保存桥接配置失败: {e}"),
            details: vec![],
        };
    }

    let bridge_note = match mode {
        CodexBridgeMode::CcSwitch => {
            "VibeStart 已写入 localhost 桥接配置。请在 CC Switch 中单独填入 API Key 并开启 Codex 路由。"
        }
        CodexBridgeMode::DeepseekBridge => {
            "VibeStart 已写入 localhost 桥接配置。请在 bridge 进程（或 CC Switch）中单独配置 DeepSeek Key。"
        }
        CodexBridgeMode::None => "OpenAI 官方直连，无需本地桥接。",
    };

    InnerSyncResult {
        success: true,
        message: "已写入 ~/.codex/config.toml、.env 与 AGENTS.md".into(),
        details: vec![
            format!("模型: {}", profile.model_hint),
            bridge_note.into(),
            "API Key 有效 ≠ 桥接就绪，请完成桥接配置后再启动 Codex。".into(),
            "在终端运行 codex 即可使用（桥接就绪后）".into(),
        ],
    }
}

fn codex_model_for_provider(provider: &str, profile: &ProviderProfile) -> &'static str {
    if provider == "deepseek" {
        "deepseek-v4-pro"
    } else {
        profile.model_hint
    }
}

fn sync_tongyi_lingma(api_key: &str, profile: &ProviderProfile) -> InnerSyncResult {
    let mut details = vec![
        "通义灵码 Pro 版可在 Lingma 设置 → 模型 → 添加百炼 API Key".into(),
        format!("推荐填入 DashScope Key（与向导中相同）: sk-..."),
    ];

    if let Some(settings_path) = vscode_user_settings_path("Lingma") {
        match merge_settings_env(&settings_path, api_key, profile) {
            Ok(()) => {
                details.insert(
                    0,
                    format!(
                        "已写入 {} 终端环境变量（Lingma 插件可用）",
                        settings_path.display()
                    ),
                );
                return InnerSyncResult {
                    success: true,
                    message: "已同步环境变量到 Lingma / VS Code 配置".into(),
                    details,
                };
            }
            Err(e) => details.push(format!("settings.json 写入跳过: {e}")),
        }
    }

    InnerSyncResult {
        success: true,
        message: "Key 已保存，请在 Lingma 设置中手动添加百炼 API Key".into(),
        details,
    }
}

fn merge_settings_env(
    settings_path: &Path,
    api_key: &str,
    profile: &ProviderProfile,
) -> Result<(), String> {
    let mut settings: serde_json::Value = if settings_path.exists() {
        fs::read_to_string(settings_path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_else(|| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let env_key = if cfg!(target_os = "windows") {
        "terminal.integrated.env.windows"
    } else if cfg!(target_os = "macos") {
        "terminal.integrated.env.osx"
    } else {
        "terminal.integrated.env.linux"
    };

    let obj = settings.as_object_mut().ok_or("settings 不是对象")?;
    let env = obj
        .entry(env_key.to_string())
        .or_insert_with(|| serde_json::json!({}));

    if let Some(env_obj) = env.as_object_mut() {
        env_obj.insert(
            profile.env_var.to_string(),
            serde_json::Value::String(api_key.to_string()),
        );
        env_obj.insert(
            "OPENAI_API_KEY".to_string(),
            serde_json::Value::String(api_key.to_string()),
        );
        env_obj.insert(
            "OPENAI_BASE_URL".to_string(),
            serde_json::Value::String(profile.openai_base_url.to_string()),
        );
    }

    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(settings_path, raw).map_err(|e| e.to_string())
}

fn vscode_app_name(ide: &str) -> &'static str {
    match ide {
        "trae" => "Trae",
        "windsurf" => "Windsurf",
        _ => "Cursor",
    }
}

fn ide_display_name(ide: &str) -> &'static str {
    match ide {
        "cursor" => "Cursor",
        "trae" => "Trae",
        "windsurf" => "Windsurf",
        "claude-code" => "Claude Code",
        "codex" => "Codex",
        "tongyi-lingma" => "通义灵码",
        _ => "编辑器",
    }
}

fn vscode_state_db_path(app_name: &str) -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        dirs::home_dir().map(|home| {
            home.join("Library")
                .join("Application Support")
                .join(app_name)
                .join("User")
                .join("globalStorage")
                .join("state.vscdb")
        })
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA").ok().map(|appdata| {
            PathBuf::from(appdata)
                .join(app_name)
                .join("User")
                .join("globalStorage")
                .join("state.vscdb")
        })
    } else {
        dirs::home_dir().map(|home| {
            home.join(".config")
                .join(app_name)
                .join("User")
                .join("globalStorage")
                .join("state.vscdb")
        })
    }
}

fn vscode_user_settings_path(app_name: &str) -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        dirs::home_dir().map(|home| {
            home.join("Library")
                .join("Application Support")
                .join(app_name)
                .join("User")
                .join("settings.json")
        })
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA").ok().map(|appdata| {
            PathBuf::from(appdata)
                .join(app_name)
                .join("User")
                .join("settings.json")
        })
    } else {
        dirs::home_dir().map(|home| {
            home.join(".config")
                .join(app_name)
                .join("User")
                .join("settings.json")
        })
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct IdeSyncVerifyItem {
    pub ide: String,
    pub ide_name: String,
    pub ready: bool,
    pub key_matched: bool,
    pub base_url_ok: bool,
    pub custom_enabled: bool,
    pub message: String,
    pub manual_steps: Vec<String>,
}

pub fn verify_ide_sync_batch(
    ides: &[String],
    provider: &str,
    expected_key: &str,
) -> Vec<IdeSyncVerifyItem> {
    ides
        .iter()
        .map(|ide| verify_ide_sync(ide, provider, expected_key))
        .collect()
}

pub fn verify_ide_sync(ide: &str, provider: &str, expected_key: &str) -> IdeSyncVerifyItem {
    let key = expected_key.trim();
    let profile = match provider_profile(provider) {
        Some(p) => p,
        None => {
            return IdeSyncVerifyItem {
                ide: ide.to_string(),
                ide_name: ide_display_name(ide).to_string(),
                ready: false,
                key_matched: false,
                base_url_ok: false,
                custom_enabled: false,
                message: format!("未知服务商: {provider}"),
                manual_steps: vec![],
            };
        }
    };

    match ide {
        "cursor" | "trae" | "windsurf" => {
            verify_vscode_fork(ide, key, profile.openai_base_url)
        }
        "claude-code" => verify_claude_code(key, &profile),
        "codex" => verify_codex(key, &profile),
        "tongyi-lingma" => verify_tongyi_lingma(key, &profile),
        _ => verify_vscode_fork("cursor", key, profile.openai_base_url),
    }
}

fn keys_match(expected: &str, stored: Option<&str>) -> bool {
    let Some(stored) = stored.map(str::trim).filter(|s| !s.is_empty()) else {
        return false;
    };
    expected == stored
}

fn verify_vscode_fork(ide: &str, expected_key: &str, expected_base: &str) -> IdeSyncVerifyItem {
    let app_name = vscode_app_name(ide);
    let ide_name = ide_display_name(ide).to_string();
    let manual = manual_steps_for_vscode_fork(ide);

    let Some(db_path) = vscode_state_db_path(app_name) else {
        return IdeSyncVerifyItem {
            ide: ide.to_string(),
            ide_name: ide_name.clone(),
            ready: false,
            key_matched: false,
            base_url_ok: false,
            custom_enabled: false,
            message: format!("未找到 {app_name} 配置目录"),
            manual_steps: manual,
        };
    };

    if !db_path.exists() {
        return IdeSyncVerifyItem {
            ide: ide.to_string(),
            ide_name: ide_name.clone(),
            ready: false,
            key_matched: false,
            base_url_ok: false,
            custom_enabled: false,
            message: format!("请先安装并启动一次 {ide_name}"),
            manual_steps: manual,
        };
    }

    let conn = match rusqlite::Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            return IdeSyncVerifyItem {
                ide: ide.to_string(),
                ide_name: ide_name.clone(),
                ready: false,
                key_matched: false,
                base_url_ok: false,
                custom_enabled: false,
                message: format!("无法读取 {ide_name} 配置: {e}"),
                manual_steps: manual,
            };
        }
    };

    let stored_key: Option<String> = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = 'cursorAuth/openAIKey'",
            [],
            |row| row.get(0),
        )
        .ok();

    let storage_key =
        "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser";
    let (base_url, use_custom) = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = ?1",
            [storage_key],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .map(|json| {
            (
                json.get("openAIBaseUrl")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                json.get("useOpenAIKey")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
            )
        })
        .unwrap_or_default();

    let key_matched = keys_match(expected_key, stored_key.as_deref());
    let base_host = expected_base
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .split('/')
        .next()
        .unwrap_or("");
    let base_url_ok = base_url.contains(base_host);
    let custom_enabled = use_custom;
    let ready = key_matched && base_url_ok && custom_enabled;

    let mut steps = Vec::new();
    if !key_matched {
        steps.push("在向导中重新点击「同步到选中的编辑器」".into());
    }
    if !base_url_ok {
        steps.push(format!("在 {ide_name} Settings → Models 设置 Base URL 为 {expected_base}"));
    }
    if !custom_enabled {
        steps.extend(manual);
    }
    if ready {
        steps.push(format!(
            "完全退出并重启 {ide_name}（{}）后，在 Chat 中选择 OpenAI 兼容模型",
            quit_app_hint()
        ));
    }

    let message = if ready {
        format!("{ide_name} 配置已就绪，可以启动使用")
    } else if !key_matched {
        format!("{ide_name} 中未检测到匹配的 API Key")
    } else if !custom_enabled {
        format!("{ide_name} Key 已写入，但「使用自定义 API Key」尚未开启")
    } else {
        format!("{ide_name} Base URL 需确认")
    };

    IdeSyncVerifyItem {
        ide: ide.to_string(),
        ide_name,
        ready,
        key_matched,
        base_url_ok,
        custom_enabled,
        message,
        manual_steps: steps,
    }
}

fn manual_steps_for_vscode_fork(ide: &str) -> Vec<String> {
    let name = ide_display_name(ide);
    let settings = settings_shortcut_hint();
    let quit = quit_app_hint();
    vec![
        format!("打开 {name}，按 {settings} 打开设置"),
        "进入 Cursor Settings → Models（或对应 AI 模型设置）".into(),
        "开启「Override OpenAI API Key / 使用自定义 API Key」".into(),
        format!("确认 API Key 与 Base URL 已填充，保存后 {quit} 完全退出再打开"),
    ]
}

fn verify_claude_code(expected_key: &str, profile: &ProviderProfile) -> IdeSyncVerifyItem {
    let Some(cc) = &profile.claude_code else {
        return IdeSyncVerifyItem {
            ide: "claude-code".into(),
            ide_name: "Claude Code".into(),
            ready: false,
            key_matched: false,
            base_url_ok: false,
            custom_enabled: false,
            message: "当前 LLM 服务商不支持 Claude Code 直连".into(),
            manual_steps: vec![
                "Claude Code 需要 Anthropic 协议端点，DeepSeek/Kimi 已支持".into(),
                "通义/智谱/OpenAI 请改用 Cursor 或 Codex".into(),
            ],
        };
    };

    let settings_path = dirs::home_dir().map(|h| h.join(".claude").join("settings.json"));
    let mut key_matched = false;
    let mut base_url_ok = false;

    if let Some(path) = settings_path.filter(|p| p.exists()) {
        if let Ok(raw) = fs::read_to_string(path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
                let token = json
                    .pointer("/env/ANTHROPIC_AUTH_TOKEN")
                    .or_else(|| json.pointer("/env/ANTHROPIC_API_KEY"))
                    .and_then(|v| v.as_str());
                key_matched = keys_match(expected_key, token);

                let base = json
                    .pointer("/env/ANTHROPIC_BASE_URL")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let expected_host = cc
                    .anthropic_base_url
                    .trim_start_matches("https://")
                    .trim_start_matches("http://")
                    .split('/')
                    .next()
                    .unwrap_or("");
                base_url_ok = base.contains(expected_host);
            }
        }
    }

    let ready = key_matched && base_url_ok;
    let mut manual_steps = Vec::new();
    if !key_matched {
        manual_steps.push("在向导中重新同步 API Key 到 Claude Code".into());
    }
    if !base_url_ok {
        manual_steps.push(format!(
            "确认 ~/.claude/settings.json 中 ANTHROPIC_BASE_URL 为 {}",
            cc.anthropic_base_url
        ));
    }
    if ready {
        manual_steps.push("关闭旧终端窗口，重新运行 claude".into());
    }

    IdeSyncVerifyItem {
        ide: "claude-code".into(),
        ide_name: "Claude Code".into(),
        ready,
        key_matched,
        base_url_ok,
        custom_enabled: base_url_ok,
        message: if ready {
            "Claude Code 已指向第三方 Anthropic 兼容端点".into()
        } else if !base_url_ok {
            "仍指向 api.anthropic.com 或未配置 ANTHROPIC_BASE_URL".into()
        } else {
            "Claude Code 未检测到匹配的 API Key".into()
        },
        manual_steps,
    }
}

fn verify_codex(expected_key: &str, _profile: &ProviderProfile) -> IdeSyncVerifyItem {
    let env_path = dirs::home_dir().map(|h| h.join(".codex").join(".env"));
    let mut key_matched = false;
    if let Some(path) = env_path.filter(|p| p.exists()) {
        if let Ok(raw) = fs::read_to_string(path) {
            for line in raw.lines() {
                if line.starts_with("OPENAI_API_KEY=") {
                    let val = line.trim_start_matches("OPENAI_API_KEY=").trim();
                    key_matched = keys_match(expected_key, Some(val));
                    break;
                }
            }
        }
    }

    let config_path = dirs::home_dir().map(|h| h.join(".codex").join("config.toml"));
    let mut base_url_ok = false;
    let mut bridge_config_ok = false;
    if let Some(path) = config_path.as_ref().filter(|p| p.exists()) {
        if let Ok(raw) = fs::read_to_string(path) {
            base_url_ok = raw.contains("127.0.0.1") || raw.contains("model_provider = \"openai\"");
            bridge_config_ok =
                raw.contains("wire_api = \"responses\"") || raw.contains("model_provider = \"openai\"");
        }
    }

    let bridge_cfg = codex_bridge::get_codex_bridge_config();
    let _ = bridge_cfg;

    let config_ok = config_path.as_ref().is_some_and(|p| p.exists());
    let ready = key_matched && config_ok && bridge_config_ok;
    let mut manual_steps = vec![
        "API Key 已同步到 ~/.codex，但桥接需在 CC Switch 或 DeepSeek 桥中单独配置 Key".into(),
        "完成桥接配置并通过健康检查后，在终端运行 codex".into(),
    ];
    if !base_url_ok {
        manual_steps.insert(
            0,
            "config.toml 未指向 localhost 桥接，请重新同步 Codex 配置".into(),
        );
    }

    IdeSyncVerifyItem {
        ide: "codex".into(),
        ide_name: "Codex".into(),
        ready,
        key_matched,
        base_url_ok: base_url_ok && bridge_config_ok,
        custom_enabled: true,
        message: if ready {
            "Codex 本地配置已写入（API Key 有效）".into()
        } else if key_matched && config_ok {
            "Key 已同步，桥接配置待完成".into()
        } else {
            "Codex 配置不完整，请重新同步".into()
        },
        manual_steps,
    }
}

fn verify_tongyi_lingma(expected_key: &str, profile: &ProviderProfile) -> IdeSyncVerifyItem {
    let mut key_matched = false;
    if let Some(path) = vscode_user_settings_path("Lingma").filter(|p| p.exists()) {
        if let Ok(raw) = fs::read_to_string(path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
                let env_key = if cfg!(target_os = "macos") {
                    "/terminal.integrated.env.osx"
                } else if cfg!(target_os = "windows") {
                    "/terminal.integrated.env.windows"
                } else {
                    "/terminal.integrated.env.linux"
                };
                let val = json
                    .pointer(&format!("{env_key}/{}/", profile.env_var))
                    .or_else(|| json.pointer(&format!("{env_key}/OPENAI_API_KEY")))
                    .and_then(|v| v.as_str());
                key_matched = keys_match(expected_key, val);
            }
        }
    }
    IdeSyncVerifyItem {
        ide: "tongyi-lingma".into(),
        ide_name: "通义灵码".into(),
        ready: key_matched,
        key_matched,
        base_url_ok: true,
        custom_enabled: false,
        message: if key_matched {
            "环境变量已写入，请在 Lingma 设置中确认百炼 Key".into()
        } else {
            "建议在 Lingma 设置 → 模型中添加百炼 API Key".into()
        },
        manual_steps: vec![
            "打开 Lingma → 设置 → 模型 → 添加".into(),
            "服务商选「阿里云百炼」，粘贴与向导中相同的 API Key".into(),
            "在对话框选择对应模型后开始编程".into(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_profiles_exist() {
        assert!(provider_profile("deepseek").is_some());
        assert!(provider_profile("openai").is_some());
    }

    #[test]
    fn deepseek_supports_claude_code_anthropic_endpoint() {
        let p = provider_profile("deepseek").unwrap();
        let cc = p.claude_code.as_ref().unwrap();
        assert_eq!(cc.anthropic_base_url, "https://api.deepseek.com/anthropic");
    }

    #[test]
    fn openai_does_not_support_claude_code_direct() {
        let p = provider_profile("openai").unwrap();
        assert!(p.claude_code.is_none());
    }
}
