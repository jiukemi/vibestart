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

#[derive(Debug, Default, Serialize, Deserialize)]
struct AppConfig {
    #[serde(default)]
    llm: Option<LlmConfig>,
}

struct ProviderEndpoint {
    url: &'static str,
    model: &'static str,
}

fn provider_endpoint(provider: &str, base_url: Option<&str>) -> Result<(String, String), String> {
    if let Some(url) = base_url {
        let model = match provider {
            "deepseek" => "deepseek-chat",
            "tongyi" => "qwen-turbo",
            "zhipu" => "glm-4-flash",
            "kimi" => "moonshot-v1-8k",
            "openai" => "gpt-4o-mini",
            _ => return Err(format!("未知服务商: {provider}")),
        };
        return Ok((url.to_string(), model.to_string()));
    }

    let endpoint = match provider {
        "deepseek" => ProviderEndpoint {
            url: "https://api.deepseek.com/v1/chat/completions",
            model: "deepseek-chat",
        },
        "tongyi" => ProviderEndpoint {
            url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
            model: "qwen-turbo",
        },
        "zhipu" => ProviderEndpoint {
            url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            model: "glm-4-flash",
        },
        "kimi" => ProviderEndpoint {
            url: "https://api.moonshot.cn/v1/chat/completions",
            model: "moonshot-v1-8k",
        },
        "openai" => ProviderEndpoint {
            url: "https://api.openai.com/v1/chat/completions",
            model: "gpt-4o-mini",
        },
        _ => return Err(format!("未知服务商: {provider}")),
    };

    Ok((endpoint.url.to_string(), endpoint.model.to_string()))
}

fn vibestart_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home.join(".vibestart"))
}

fn config_path() -> Result<PathBuf, String> {
    Ok(vibestart_dir()?.join("config.json"))
}

fn load_config() -> AppConfig {
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

fn save_config(config: &AppConfig) -> Result<(), String> {
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

pub fn get_llm_config() -> Option<LlmConfig> {
    load_config().llm
}

pub async fn test_api(
    provider: &str,
    api_key: &str,
    base_url: Option<&str>,
) -> Result<String, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API Key 不能为空".into());
    }

    let (url, model) = provider_endpoint(provider, base_url)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 5
    });

    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {e}"))?;

    let status = res.status();
    if status.is_success() {
        let mut config = load_config();
        config.llm = Some(LlmConfig {
            provider: provider.to_string(),
            api_key: key.to_string(),
            base_url: base_url.map(str::to_string),
        });
        save_config(&config)?;
        Ok("API Key 验证成功".into())
    } else {
        let detail = res.text().await.unwrap_or_default();
        Err(format!("验证失败 ({status}): {detail}"))
    }
}
