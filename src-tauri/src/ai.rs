use futures_util::StreamExt;
use reqwest::{header, Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    error::Error as StdError,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{ipc::Channel, AppHandle, State};

use crate::secrets::{has_secret, read_secret, write_secret};

const API_KEY_FILE: &str = "ai-api-key";
const AI_CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const AI_RESPONSE_HEADER_TIMEOUT: Duration = Duration::from_secs(120);
const AI_STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(120);
const MAX_AI_RESPONSE_BYTES: usize = 32 * 1024 * 1024;
const MAX_AI_SSE_FRAME_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    protocol: String,
    base_url: String,
    model: String,
}

#[derive(Debug, Serialize)]
pub struct ProviderResponse {
    status: u16,
    body: Value,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamEvent {
    request_id: String,
    phase: String,
    message: String,
    data: Option<Value>,
}

#[derive(Default)]
pub struct AiRequestState {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl AiRequestState {
    fn begin(&self, request_id: &str) -> Result<Arc<AtomicBool>, String> {
        if request_id.trim().is_empty() {
            return Err("模型请求 ID 不能为空".into());
        }
        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| "模型请求状态不可用".to_string())?;
        if jobs.contains_key(request_id) {
            return Err("模型请求已经在运行".into());
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        jobs.insert(request_id.into(), cancelled.clone());
        Ok(cancelled)
    }

    fn finish(&self, request_id: &str) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.remove(request_id);
        }
    }
}

#[tauri::command]
pub fn save_ai_api_key(app: AppHandle, api_key: String) -> Result<(), String> {
    write_secret(&app, API_KEY_FILE, &api_key)
}

#[tauri::command]
pub fn has_ai_api_key(app: AppHandle) -> bool {
    has_secret(&app, API_KEY_FILE)
}

fn base_url(config: &AiProviderConfig) -> Result<String, String> {
    if !matches!(
        config.protocol.as_str(),
        "openai-responses" | "openai-chat" | "anthropic"
    ) {
        return Err("不支持的模型协议".into());
    }
    let base = config.base_url.trim().trim_end_matches('/');
    let url = Url::parse(base).map_err(|_| "Base URL 无效".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Base URL 只支持 HTTP 或 HTTPS".into());
    }
    Ok(base.to_string())
}

fn provider_root(value: &str) -> String {
    let base = value.trim().trim_end_matches('/');
    for suffix in ["/chat/completions", "/responses", "/messages"] {
        if let Some(root) = base.strip_suffix(suffix) {
            return root.to_string();
        }
    }
    base.to_string()
}

fn endpoint(config: &AiProviderConfig) -> Result<Url, String> {
    if config.model.trim().is_empty() {
        return Err("模型名称不能为空".into());
    }
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
    let endpoint = if base.ends_with("/v1") {
        format!("{base}/models")
    } else {
        format!("{base}/v1/models")
    };
    Url::parse(&endpoint).map_err(|_| "Base URL 无效".to_string())
}

fn authorize(
    request: reqwest::RequestBuilder,
    config: &AiProviderConfig,
    api_key: &str,
) -> reqwest::RequestBuilder {
    if config.protocol == "anthropic" {
        request
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
    } else {
        request.bearer_auth(api_key)
    }
}

async fn send_json(
    request: reqwest::RequestBuilder,
    cancelled: Arc<AtomicBool>,
) -> Result<ProviderResponse, String> {
    let future = request.send();
    tokio::pin!(future);
    let response = loop {
        tokio::select! {
            response = &mut future => break response.map_err(provider_request_error)?,
            _ = tokio::time::sleep(Duration::from_millis(100)) => {
                if cancelled.load(Ordering::Relaxed) { return Err("模型请求已取消".into()); }
            }
        }
    };
    let status = response.status().as_u16();
    let body = response.json::<Value>().await.unwrap_or_else(
        |_| serde_json::json!({ "error": { "message": "服务返回了非 JSON 响应" } }),
    );
    Ok(ProviderResponse { status, body })
}

fn provider_request_error(error: reqwest::Error) -> String {
    let detail = error
        .source()
        .map(|source| source.to_string())
        .filter(|source| !source.trim().is_empty());
    if error.is_timeout() {
        return detail
            .map(|value| format!("模型服务响应超时：{value}"))
            .unwrap_or_else(|| "模型服务响应超时".into());
    }
    if error.is_connect() {
        return detail
            .map(|value| format!("无法连接模型服务：{value}"))
            .unwrap_or_else(|| "无法连接模型服务，请检查网络和 Base URL".into());
    }
    detail
        .map(|value| format!("模型请求失败：{value}"))
        .unwrap_or_else(|| format!("模型请求失败：{error}"))
}

fn take_sse_frame(buffer: &mut Vec<u8>) -> Option<Vec<u8>> {
    let lf = buffer
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (index, 2));
    let crlf = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| (index, 4));
    let (index, delimiter_length) = match (lf, crlf) {
        (Some(left), Some(right)) => {
            if left.0 <= right.0 {
                left
            } else {
                right
            }
        }
        (Some(value), None) | (None, Some(value)) => value,
        (None, None) => return None,
    };
    let mut drained = buffer.drain(..index + delimiter_length).collect::<Vec<_>>();
    drained.truncate(index);
    Some(drained)
}

fn sse_data(frame: &[u8]) -> Result<Option<String>, String> {
    let text =
        std::str::from_utf8(frame).map_err(|_| "模型返回了无效的 UTF-8 流式数据".to_string())?;
    let data = text
        .lines()
        .filter_map(|line| {
            let line = line.trim_end_matches('\r');
            line.strip_prefix("data:")
                .map(|value| value.strip_prefix(' ').unwrap_or(value))
        })
        .collect::<Vec<_>>();
    if data.is_empty() {
        return Ok(None);
    }
    Ok(Some(data.join("\n")))
}

fn is_terminal_stream_event(value: &Value) -> bool {
    matches!(
        value.get("type").and_then(Value::as_str),
        Some(
            "response.completed"
                | "response.failed"
                | "response.incomplete"
                | "message_stop"
                | "error"
        )
    )
}

fn emit_stream_event(
    channel: &Channel<AiStreamEvent>,
    request_id: &str,
    phase: &str,
    message: &str,
    data: Option<Value>,
) -> Result<(), String> {
    channel
        .send(AiStreamEvent {
            request_id: request_id.into(),
            phase: phase.into(),
            message: message.into(),
            data,
        })
        .map_err(|error| format!("无法上报模型流式进度：{error}"))
}

fn parse_stream_frame(
    frame: &[u8],
    channel: &Channel<AiStreamEvent>,
    request_id: &str,
) -> Result<bool, String> {
    let Some(data) = sse_data(frame)? else {
        return Ok(false);
    };
    if data.trim() == "[DONE]" {
        return Ok(true);
    }
    let value = serde_json::from_str::<Value>(&data)
        .map_err(|_| "模型返回了无法解析的 SSE 事件".to_string())?;
    let terminal = is_terminal_stream_event(&value);
    emit_stream_event(channel, request_id, "data", "正在接收模型结果", Some(value))?;
    Ok(terminal)
}

async fn response_body(
    response: reqwest::Response,
    cancelled: &Arc<AtomicBool>,
) -> Result<Value, String> {
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    loop {
        let next = tokio::select! {
            result = tokio::time::timeout(AI_STREAM_IDLE_TIMEOUT, stream.next()) => {
                result.map_err(|_| "模型服务响应超时：长时间未收到响应内容".to_string())?
            }
            _ = async {
                while !cancelled.load(Ordering::Relaxed) {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            } => return Err("模型请求已取消".into()),
        };
        let Some(chunk) = next else { break };
        bytes.extend_from_slice(&chunk.map_err(provider_request_error)?);
        if bytes.len() > MAX_AI_RESPONSE_BYTES {
            return Err("模型响应超过 32MB 限制".into());
        }
    }
    Ok(serde_json::from_slice::<Value>(&bytes).unwrap_or_else(
        |_| serde_json::json!({ "error": { "message": "服务返回了非 JSON 响应" } }),
    ))
}

async fn send_stream(
    request: reqwest::RequestBuilder,
    request_id: &str,
    cancelled: Arc<AtomicBool>,
    channel: &Channel<AiStreamEvent>,
) -> Result<ProviderResponse, String> {
    emit_stream_event(channel, request_id, "connecting", "正在连接模型服务", None)?;
    let response = tokio::select! {
        result = tokio::time::timeout(AI_RESPONSE_HEADER_TIMEOUT, request.send()) => {
            result.map_err(|_| "模型服务响应超时：120 秒内未返回响应头".to_string())?
                .map_err(provider_request_error)?
        }
        _ = async {
            while !cancelled.load(Ordering::Relaxed) {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        } => return Err("模型请求已取消".into()),
    };
    let status = response.status().as_u16();
    let is_event_stream = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.to_ascii_lowercase().contains("text/event-stream"));
    if !is_event_stream || !(200..300).contains(&status) {
        return Ok(ProviderResponse {
            status,
            body: response_body(response, &cancelled).await?,
        });
    }

    emit_stream_event(
        channel,
        request_id,
        "connected",
        "模型已响应，正在接收结果",
        None,
    )?;
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();
    let mut received_event = false;
    let mut terminal = false;
    while !terminal {
        let next = tokio::select! {
            result = tokio::time::timeout(AI_STREAM_IDLE_TIMEOUT, stream.next()) => {
                result.map_err(|_| "模型流式响应超时：120 秒未收到新数据".to_string())?
            }
            _ = async {
                while !cancelled.load(Ordering::Relaxed) {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            } => return Err("模型请求已取消".into()),
        };
        let Some(chunk) = next else { break };
        let chunk = chunk.map_err(provider_request_error)?;
        buffer.extend_from_slice(&chunk);
        if buffer.len() > MAX_AI_SSE_FRAME_BYTES {
            return Err("模型单个流式事件超过 16MB 限制".into());
        }
        while let Some(frame) = take_sse_frame(&mut buffer) {
            let has_data = sse_data(&frame)?.is_some();
            terminal = parse_stream_frame(&frame, channel, request_id)?;
            received_event |= has_data;
            if terminal {
                break;
            }
        }
    }
    if !terminal && !buffer.is_empty() {
        let has_data = sse_data(&buffer)?.is_some();
        terminal = parse_stream_frame(&buffer, channel, request_id)?;
        received_event |= has_data;
    }
    if !received_event {
        return Err("模型服务没有返回可解析的流式事件".into());
    }
    let message = if terminal {
        "模型结果接收完成"
    } else {
        "模型流已结束，正在整理结果"
    };
    emit_stream_event(channel, request_id, "completed", message, None)?;
    Ok(ProviderResponse {
        status,
        body: serde_json::json!({ "streamed": true }),
    })
}

async fn managed_request<F>(
    state: &AiRequestState,
    request_id: &str,
    build: F,
) -> Result<ProviderResponse, String>
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
    app: AppHandle,
    state: State<'_, AiRequestState>,
    config: AiProviderConfig,
    payload: Value,
    request_id: String,
    on_event: Channel<AiStreamEvent>,
) -> Result<ProviderResponse, String> {
    let api_key = read_secret(&app, API_KEY_FILE)?;
    let url = endpoint(&config)?;
    let cancelled = state.begin(&request_id)?;
    let result = (|| {
        let client = Client::builder()
            .connect_timeout(AI_CONNECT_TIMEOUT)
            .build()
            .map_err(|error| error.to_string())?;
        Ok(authorize(
            client
                .post(url)
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::ACCEPT, "text/event-stream, application/json")
                .json(&payload),
            &config,
            &api_key,
        ))
    })();
    let result = match result {
        Ok(request) => send_stream(request, &request_id, cancelled, &on_event).await,
        Err(error) => Err(error),
    };
    state.finish(&request_id);
    result
}

#[tauri::command]
pub async fn list_ai_models(
    app: AppHandle,
    state: State<'_, AiRequestState>,
    config: AiProviderConfig,
    request_id: String,
) -> Result<ProviderResponse, String> {
    let api_key = read_secret(&app, API_KEY_FILE)?;
    let url = models_endpoint(&config)?;
    managed_request(&state, &request_id, |_| {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|error| error.to_string())?;
        Ok(authorize(
            client.get(url).header(header::ACCEPT, "application/json"),
            &config,
            &api_key,
        ))
    })
    .await
}

#[tauri::command]
pub fn cancel_ai_request(state: State<'_, AiRequestState>, request_id: String) -> bool {
    state
        .jobs
        .lock()
        .ok()
        .and_then(|jobs| jobs.get(&request_id).cloned())
        .map(|cancelled| {
            cancelled.store(true, Ordering::Relaxed);
            true
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(protocol: &str, base_url: &str) -> AiProviderConfig {
        AiProviderConfig {
            protocol: protocol.into(),
            base_url: base_url.into(),
            model: "test".into(),
        }
    }

    #[test]
    fn builds_provider_and_model_endpoints() {
        assert_eq!(
            endpoint(&config("openai-chat", "https://example.com/v1"))
                .unwrap()
                .as_str(),
            "https://example.com/v1/chat/completions"
        );
        assert_eq!(
            endpoint(&config(
                "openai-chat",
                "https://opencode.ai/zen/v1/chat/completions"
            ))
            .unwrap()
            .as_str(),
            "https://opencode.ai/zen/v1/chat/completions"
        );
        assert_eq!(
            models_endpoint(&config(
                "openai-chat",
                "https://opencode.ai/zen/v1/chat/completions"
            ))
            .unwrap()
            .as_str(),
            "https://opencode.ai/zen/v1/models"
        );
        assert_eq!(
            endpoint(&config("anthropic", "https://api.anthropic.com"))
                .unwrap()
                .as_str(),
            "https://api.anthropic.com/v1/messages"
        );
        assert_eq!(
            models_endpoint(&config("openai-responses", "https://example.com"))
                .unwrap()
                .as_str(),
            "https://example.com/v1/models"
        );
    }

    #[test]
    fn accepts_provider_config_without_client_output_limit() {
        let current: AiProviderConfig = serde_json::from_value(serde_json::json!({
            "protocol": "openai-responses",
            "baseUrl": "https://example.com",
            "model": "test"
        }))
        .unwrap();
        let legacy: AiProviderConfig = serde_json::from_value(serde_json::json!({
            "protocol": "openai-responses",
            "baseUrl": "https://example.com",
            "model": "test",
            "maxTokens": 4_000
        }))
        .unwrap();

        assert!(endpoint(&current).is_ok());
        assert!(endpoint(&legacy).is_ok());
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

    #[test]
    fn parses_sse_frames_across_lf_and_crlf_boundaries() {
        let mut buffer =
            b"event: message\r\ndata: {\"type\":\"response.created\"}\r\n\r\ndata: [DONE]\n\nrest"
                .to_vec();
        let first = take_sse_frame(&mut buffer).unwrap();
        let second = take_sse_frame(&mut buffer).unwrap();
        assert_eq!(
            sse_data(&first).unwrap().as_deref(),
            Some("{\"type\":\"response.created\"}")
        );
        assert_eq!(sse_data(&second).unwrap().as_deref(), Some("[DONE]"));
        assert_eq!(buffer, b"rest");
    }

    #[test]
    fn joins_multiline_sse_data_and_detects_terminal_events() {
        let frame = b"data: {\"type\":\ndata: \"response.completed\"}";
        let data = sse_data(frame).unwrap().unwrap();
        let value: Value = serde_json::from_str(&data).unwrap();
        assert!(is_terminal_stream_event(&value));
        assert!(!is_terminal_stream_event(
            &serde_json::json!({ "type": "response.output_text.delta" })
        ));
        assert!(is_terminal_stream_event(
            &serde_json::json!({ "type": "response.incomplete" })
        ));
    }
}
