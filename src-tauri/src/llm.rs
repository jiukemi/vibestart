use crate::config::{load_config, save_config, LlmConfig};

#[derive(Debug, serde::Serialize)]
pub struct LlmTestResult {
    pub message: String,
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

pub fn get_llm_config() -> Option<LlmConfig> {
    load_config().llm
}

pub async fn test_api(
    provider: &str,
    api_key: &str,
    base_url: Option<&str>,
) -> Result<LlmTestResult, String> {
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
        Ok(LlmTestResult {
            message: "API Key 验证成功，已保存到 VibeStart".into(),
        })
    } else {
        let detail = res.text().await.unwrap_or_default();
        Err(format!("验证失败 ({status}): {detail}"))
    }
}
