use std::fs;
use std::path::{Path, PathBuf};

/// Claude Code "auto" theme + macOS Terminal default profile often yields an
/// unreadable first-run theme picker. Force ANSI themes and simpler rendering.
pub fn ensure_readable_terminal_settings() -> Result<(), String> {
    let settings_path = claude_settings_path()?;
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

    let obj = settings
        .as_object_mut()
        .ok_or_else(|| "Claude Code settings.json 格式异常".to_string())?;

    // Skip the colorful theme picker: use terminal-native 16-color palette.
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

    // AI replies in Chinese; CLI permission prompts remain English (upstream limitation).
    obj.insert(
        "language".to_string(),
        serde_json::Value::String("chinese".to_string()),
    );

    if !obj.contains_key("env") {
        obj.insert("env".to_string(), serde_json::json!({}));
    }
    if let Some(env) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
        env.insert(
            "CLAUDE_CODE_NO_FLICKER".to_string(),
            serde_json::Value::String("1".to_string()),
        );
        env.insert(
            "TERM".to_string(),
            serde_json::Value::String("xterm-256color".to_string()),
        );
        // 第三方端点只需 AUTH_TOKEN，避免与 API_KEY 冲突告警
        env.remove("ANTHROPIC_API_KEY");
    }

    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, raw).map_err(|e| format!("写入 Claude Code 配置失败: {e}"))?;
    Ok(())
}

/// Mark a project directory as trusted so Claude Code skips the English trust dialog.
pub fn trust_project_directory(project_dir: &str) -> Result<(), String> {
    let path = Path::new(project_dir);
    if !path.exists() {
        let _ = fs::create_dir_all(path);
    }
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("无法解析项目目录: {e}"))?
        .to_string_lossy()
        .into_owned();

    let claude_json_path = dirs::home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?
        .join(".claude.json");

    let mut state: serde_json::Value = if claude_json_path.exists() {
        fs::read_to_string(&claude_json_path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_else(|| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let root = state
        .as_object_mut()
        .ok_or_else(|| "~/.claude.json 格式异常".to_string())?;

    if !root.contains_key("projects") {
        root.insert("projects".to_string(), serde_json::json!({}));
    }

    let projects = root
        .get_mut("projects")
        .and_then(|v| v.as_object_mut())
        .ok_or_else(|| "~/.claude.json projects 字段异常".to_string())?;

    let entry = projects
        .entry(canonical.clone())
        .or_insert_with(|| serde_json::json!({}));

    if let Some(obj) = entry.as_object_mut() {
        obj.insert(
            "hasTrustDialogAccepted".to_string(),
            serde_json::Value::Bool(true),
        );
    }

    let raw = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&claude_json_path, raw).map_err(|e| format!("写入 ~/.claude.json 失败: {e}"))?;
    Ok(())
}

pub fn prepare_claude_code_launch(project_dir: &str) -> Result<(), String> {
    ensure_readable_terminal_settings()?;
    trust_project_directory(project_dir)
}

pub fn claude_settings_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|h| h.join(".claude").join("settings.json"))
        .ok_or_else(|| "无法获取用户主目录".to_string())
}

pub const CLAUDE_LAUNCH_ARGS: &str = "--ax-screen-reader";

pub const CLAUDE_LAUNCH_PREAMBLE_BAT: &str = r#"echo ========================================
echo   Claude Code 启动说明（中文）
echo ========================================
echo.
echo   1) 界面是英文，AI 回复会是中文（Claude Code 暂不支持中文界面）
echo.
echo   2) 若出现 Permission Required / y/n 提示：
echo      含义：是否信任当前项目文件夹，允许读写代码
echo      操作：输入 y 然后按 Enter（信任）
echo            输入 n 会退出
echo.
echo   3) 进入后直接用中文描述需求，例如：
echo      「帮我修改 index.html，做一个个人简介页」
echo.
echo   4) 仍看不清？输入 /theme 选 light-ansi 或 dark-ansi
echo      退出：Ctrl+C 或 /exit
echo.
echo   正在启动 Claude Code…
echo.
"#;

pub const CLAUDE_LAUNCH_PREAMBLE: &str = r#"echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Claude Code 启动说明（中文）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1) 界面是英文，AI 回复会是中文（Claude Code 暂不支持中文界面）"
echo ""
echo "  2) 若出现 Permission Required / y/n 提示："
echo "     含义：是否信任当前项目文件夹，允许读写代码"
echo "     操作：输入 y 然后按 Enter（信任）"
echo "           输入 n 会退出"
echo ""
echo "  3) 进入后直接用中文描述需求，例如："
echo "     「帮我修改 index.html，做一个个人简介页」"
echo ""
echo "  4) 仍看不清？输入 /theme 选 light-ansi 或 dark-ansi"
echo "     退出：Ctrl+C 或 /exit"
echo ""
echo "  正在启动 Claude Code…"
echo ""
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preamble_explains_trust_prompt() {
        assert!(CLAUDE_LAUNCH_PREAMBLE.contains("Permission Required"));
        assert!(CLAUDE_LAUNCH_PREAMBLE.contains("输入 y"));
        assert!(CLAUDE_LAUNCH_PREAMBLE_BAT.contains("Permission Required"));
    }
}
