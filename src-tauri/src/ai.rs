use keyring::Entry;
use reqwest::{header, Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::State;

const KEYRING_SERVICE: &str = "com.bvideo.studio.ai";
const KEYRING_ACCOUNT: &str = "default-provider";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    protocol: String,
    base_url: String,
    model: String,
    max_tokens: u32,
}

#[derive(Debug, Serialize)]
pub struct ProviderResponse {
    status: u16,
    body: Value,
}

#[derive(Default)]
pub struct AiRequestState {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl AiRequestState {
    fn begin(&self, request_id: &str) -> Result<Arc<AtomicBool>, String> {
        if request_id.trim().is_empty() { return Err("模型请求 ID 不能为空".into()); }
        let mut jobs = self.jobs.lock().map_err(|_| "模型请求状态不可用".to_string())?;
        if jobs.contains_key(request_id) { return Err("模型请求已经在运行".into()); }
        let cancelled = Arc::new(AtomicBool::new(false));
        jobs.insert(request_id.into(), cancelled.clone());
        Ok(cancelled)
    }

    fn finish(&self, request_id: &str) {
        if let Ok(mut jobs) = self.jobs.lock() { jobs.remove(request_id); }
    }
}

fn entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_ai_api_key(api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API Key 不能为空".into());
    }
    entry()?.set_password(api_key).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn has_ai_api_key() -> bool {
    entry().and_then(|value| value.get_password().map_err(|error| error.to_string()))
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

fn base_url(config: &AiProviderConfig) -> Result<String, String> {
    if !matches!(config.protocol.as_str(), "openai-responses" | "openai-chat" | "anthropic") {
        return Err("不支持的模型协议".into());
    }
    let base = config.base_url.trim().trim_end_matches('/');
    let url = Url::parse(base).map_err(|_| "Base URL 无效".to_string())?;
    if !matches!(url.scheme(), "http" | "https") { return Err("Base URL 只支持 HTTP 或 HTTPS".into()); }
    Ok(base.to_string())
}

fn provider_root(value: &str) -> String {
    let base = value.trim().trim_end_matches('/');
    for suffix in ["/chat/completions", "/responses", "/messages"] {
        if let Some(root) = base.strip_suffix(suffix) { return root.to_string(); }
    }
    base.to_string()
}

fn endpoint(config: &AiProviderConfig) -> Result<Url, String> {
    if config.model.trim().is_empty() { return Err("模型名称不能为空".into()); }
    if config.max_tokens == 0 || config.max_tokens > 1_000_000 { return Err("最大输出 Token 必须在 1 到 1000000 之间".into()); }
    let original = base_url(config)?;
    let suffix = match config.protocol.as_str() {
        "openai-responses" => "/responses",
        "openai-chat" => "/chat/completions",
        "anthropic" => "/messages",
        _ => return Err("不支持的模型协议".into()),
    };
    if original.ends_with(suffix) {
        return Url::parse(&original).map_err(|_| "Base URL 无效".to_string());
    }
    let base = provider_root(&original);
    let endpoint = if base.ends_with("/v1") {
        format!("{base}{suffix}")
    } else {
        format!("{base}/v1{suffix}")
    };
    Url::parse(&endpoint).map_err(|_| "Base URL 无效".to_string())
}

fn models_endpoint(config: &AiProviderConfig) -> Result<Url, String> {
    let base = provider_root(&base_url(config)?);
    let endpoint = if base.ends_with("/v1") { format!("{base}/models") } else { format!("{base}/v1/models") };
    Url::parse(&endpoint).map_err(|_| "Base URL 无效".to_string())
}

fn authorize(request: reqwest::RequestBuilder, config: &AiProviderConfig, api_key: &str) -> reqwest::RequestBuilder {
    if config.protocol == "anthropic" {
        request.header("x-api-key", api_key).header("anthropic-version", "2023-06-01")
    } else {
        request.bearer_auth(api_key)
    }
}

async fn send_json(request: reqwest::RequestBuilder, cancelled: Arc<AtomicBool>) -> Result<ProviderResponse, String> {
    let future = request.send();
    tokio::pin!(future);
    let response = loop {
        tokio::select! {
            response = &mut future => break response.map_err(|error| error.to_string())?,
            _ = tokio::time::sleep(Duration::from_millis(100)) => {
                if cancelled.load(Ordering::Relaxed) { return Err("模型请求已取消".into()); }
            }
        }
    };
    let status = response.status().as_u16();
    let body = response.json::<Value>().await.unwrap_or_else(|_| {
        serde_json::json!({ "error": { "message": "服务返回了非 JSON 响应" } })
    });
    Ok(ProviderResponse { status, body })
}

async fn managed_request<F>(state: &AiRequestState, request_id: &str, build: F) -> Result<ProviderResponse, String>
where
    F: FnOnce(Arc<AtomicBool>) -> Result<reqwest::RequestBuilder, String>,
{
    let cancelled = state.begin(request_id)?;
    let result = match build(cancelled.clone()) {
        Ok(request) => send_json(request, cancelled).await,
        Err(error) => Err(error),
    };
    state.finish(request_id);
    result
}

#[tauri::command]
pub async fn invoke_ai_provider(
    state: State<'_, AiRequestState>,
    config: AiProviderConfig,
    payload: Value,
    request_id: String,
) -> Result<ProviderResponse, String> {
    let api_key = entry()?
        .get_password()
        .map_err(|_| "尚未保存 API Key".to_string())?;
    let url = endpoint(&config)?;
    managed_request(&state, &request_id, |_| {
        let client = Client::builder().timeout(Duration::from_secs(90)).build().map_err(|error| error.to_string())?;
        Ok(authorize(client.post(url).header(header::CONTENT_TYPE, "application/json").json(&payload), &config, &api_key))
    }).await
}

#[tauri::command]
pub async fn list_ai_models(
    state: State<'_, AiRequestState>,
    config: AiProviderConfig,
    request_id: String,
) -> Result<ProviderResponse, String> {
    let api_key = entry()?.get_password().map_err(|_| "尚未保存 API Key".to_string())?;
    let url = models_endpoint(&config)?;
    managed_request(&state, &request_id, |_| {
        let client = Client::builder().timeout(Duration::from_secs(30)).build().map_err(|error| error.to_string())?;
        Ok(authorize(client.get(url).header(header::ACCEPT, "application/json"), &config, &api_key))
    }).await
}

#[tauri::command]
pub fn cancel_ai_request(state: State<'_, AiRequestState>, request_id: String) -> bool {
    state.jobs.lock().ok().and_then(|jobs| jobs.get(&request_id).cloned()).map(|cancelled| {
        cancelled.store(true, Ordering::Relaxed);
        true
    }).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(protocol: &str, base_url: &str) -> AiProviderConfig {
        AiProviderConfig { protocol: protocol.into(), base_url: base_url.into(), model: "test".into(), max_tokens: 100 }
    }

    #[test]
    fn builds_provider_and_model_endpoints() {
        assert_eq!(endpoint(&config("openai-chat", "https://example.com/v1")).unwrap().as_str(), "https://example.com/v1/chat/completions");
        assert_eq!(endpoint(&config("openai-chat", "https://opencode.ai/zen/v1/chat/completions")).unwrap().as_str(), "https://opencode.ai/zen/v1/chat/completions");
        assert_eq!(models_endpoint(&config("openai-chat", "https://opencode.ai/zen/v1/chat/completions")).unwrap().as_str(), "https://opencode.ai/zen/v1/models");
        assert_eq!(endpoint(&config("anthropic", "https://api.anthropic.com")).unwrap().as_str(), "https://api.anthropic.com/v1/messages");
        assert_eq!(models_endpoint(&config("openai-responses", "https://example.com")).unwrap().as_str(), "https://example.com/v1/models");
    }

    #[test]
    fn accepts_one_million_output_tokens_and_rejects_larger_values() {
        let mut maximum = config("openai-chat", "https://example.com/v1");
        maximum.max_tokens = 1_000_000;
        assert!(endpoint(&maximum).is_ok());
        maximum.max_tokens = 1_000_001;
        assert!(endpoint(&maximum).unwrap_err().contains("1000000"));
    }

    #[test]
    fn tracks_and_cancels_requests() {
        let state = AiRequestState::default();
        let cancelled = state.begin("request").unwrap();
        assert!(state.jobs.lock().unwrap().contains_key("request"));
        cancelled.store(true, Ordering::Relaxed);
        assert!(cancelled.load(Ordering::Relaxed));
        state.finish("request");
        assert!(state.jobs.lock().unwrap().is_empty());
    }
}
