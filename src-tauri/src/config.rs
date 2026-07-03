use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[cfg(unix)]
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: String,
    pub api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub enabled: bool,
    pub http_proxy: String,
    #[serde(default)]
    pub socks_proxy: Option<String>,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            http_proxy: "http://127.0.0.1:7890".to_string(),
            socks_proxy: Some("127.0.0.1:7890".to_string()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ToolsInstallMode {
    #[default]
    Recommended,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsInstallConfig {
    #[serde(default)]
    pub mode: ToolsInstallMode,
    #[serde(default)]
    pub custom_dir: Option<String>,
}

impl Default for ToolsInstallConfig {
    fn default() -> Self {
        Self {
            mode: ToolsInstallMode::Recommended,
            custom_dir: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum BrowserPreset {
    /// 推荐：优先用 Google Chrome 打开网页链接
    #[default]
    GoogleChrome,
    /// 使用系统默认浏览器
    SystemDefault,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserConfig {
    #[serde(default)]
    pub preset: BrowserPreset,
}

impl Default for BrowserConfig {
    fn default() -> Self {
        Self {
            preset: BrowserPreset::GoogleChrome,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum CodexBridgeMode {
    #[default]
    CcSwitch,
    DeepseekBridge,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexBridgeConfig {
    #[serde(default)]
    pub mode: CodexBridgeMode,
    #[serde(default = "default_cc_switch_port")]
    pub cc_switch_port: u16,
    #[serde(default = "default_deepseek_bridge_port")]
    pub deepseek_bridge_port: u16,
    #[serde(default)]
    pub last_provider: Option<String>,
}

fn default_cc_switch_port() -> u16 {
    15721
}

fn default_deepseek_bridge_port() -> u16 {
    8098
}

impl Default for CodexBridgeConfig {
    fn default() -> Self {
        Self {
            mode: CodexBridgeMode::CcSwitch,
            cc_switch_port: default_cc_switch_port(),
            deepseek_bridge_port: default_deepseek_bridge_port(),
            last_provider: None,
        }
    }
}

impl CodexBridgeMode {
    pub fn from_str_id(s: &str) -> Option<Self> {
        match s {
            "cc-switch" => Some(Self::CcSwitch),
            "deepseek-bridge" => Some(Self::DeepseekBridge),
            "none" => Some(Self::None),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::CcSwitch => "cc-switch",
            Self::DeepseekBridge => "deepseek-bridge",
            Self::None => "none",
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub llm: Option<LlmConfig>,
    #[serde(default)]
    pub network: Option<NetworkConfig>,
    #[serde(default)]
    pub tools_install: Option<ToolsInstallConfig>,
    #[serde(default)]
    pub browser: Option<BrowserConfig>,
    #[serde(default)]
    pub codex_bridge: Option<CodexBridgeConfig>,
}

pub fn vibestart_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home.join(".vibestart"))
}

pub fn config_path() -> Result<PathBuf, String> {
    Ok(vibestart_dir()?.join("config.json"))
}

pub fn load_config() -> AppConfig {
    let path = match config_path() {
        Ok(path) => path,
        Err(_) => return AppConfig::default(),
    };

    if !path.exists() {
        return AppConfig::default();
    }

    fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let dir = vibestart_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建配置目录失败: {e}"))?;

    #[cfg(unix)]
    {
        let mut dir_perms = fs::metadata(&dir)
            .map_err(|e| format!("读取目录权限失败: {e}"))?
            .permissions();
        dir_perms.set_mode(0o700);
        fs::set_permissions(&dir, dir_perms).map_err(|e| format!("设置目录权限失败: {e}"))?;
    }

    let path = dir.join("config.json");
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&path)
            .map_err(|e| format!("写入配置文件失败: {e}"))?;
        file.write_all(json.as_bytes())
            .map_err(|e| format!("写入配置文件失败: {e}"))?;
    }

    #[cfg(not(unix))]
    {
        fs::write(&path, json).map_err(|e| format!("写入配置文件失败: {e}"))?;
    }

    Ok(())
}
