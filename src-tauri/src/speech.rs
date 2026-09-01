use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::{header, Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::media::{require_command, run};
use crate::secrets::{has_secret, read_secret, write_secret};

const API_KEY_FILE: &str = "speech-api-key";
const ASR_CHUNK_SECONDS: u64 = 480;
const MAX_RAW_AUDIO_BYTES: u64 = 7_500_000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSpeechConfig {
    base_url: String,
    tts_model: String,
    tts_voice: String,
    tts_style: String,
    asr_model: String,
    asr_language: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechProgressEvent {
    job_id: String,
    phase: String,
    message: String,
    progress: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudAsrSegment {
    start_seconds: f64,
    end_seconds: f64,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudAsrTranscript {
    language: String,
    text: String,
    segments: Vec<CloudAsrSegment>,
    device: String,
}

#[derive(Default)]
pub struct SpeechRequestState {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl SpeechRequestState {
    fn begin(&self, job_id: &str) -> Result<Arc<AtomicBool>, String> {
        if job_id.trim().is_empty() {
            return Err("语音任务 ID 不能为空".into());
        }
        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| "语音任务状态不可用".to_string())?;
        if jobs.contains_key(job_id) {
            return Err("语音任务已经在运行".into());
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        jobs.insert(job_id.into(), cancelled.clone());
        Ok(cancelled)
    }

    fn finish(&self, job_id: &str) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.remove(job_id);
        }
    }
}

fn api_key(app: &AppHandle) -> Result<String, String> {
    read_secret(app, API_KEY_FILE).map_err(|_| "尚未保存云端语音 API Key".to_string())
}

#[tauri::command]
pub fn save_speech_api_key(app: AppHandle, api_key: String) -> Result<(), String> {
    write_secret(&app, API_KEY_FILE, &api_key)
}

#[tauri::command]
pub fn has_speech_api_key(app: AppHandle) -> bool {
    has_secret(&app, API_KEY_FILE)
}

fn provider_root(value: &str) -> String {
    let base = value.trim().trim_end_matches('/');
    base.strip_suffix("/chat/completions")
        .unwrap_or(base)
        .to_string()
}

fn endpoint(config: &CloudSpeechConfig, suffix: &str) -> Result<Url, String> {
    let root = provider_root(&config.base_url);
    let parsed = Url::parse(&root).map_err(|_| "云端语音 Base URL 无效".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("云端语音 Base URL 只支持 HTTP 或 HTTPS".into());
    }
    let value = if root.ends_with("/v1") {
        format!("{root}/{suffix}")
    } else {
        format!("{root}/v1/{suffix}")
    };
    Url::parse(&value).map_err(|_| "云端语音请求地址无效".to_string())
}

fn validate_config(config: &CloudSpeechConfig) -> Result<(), String> {
    endpoint(config, "chat/completions")?;
    if config.tts_model.trim().is_empty() || config.asr_model.trim().is_empty() {
        return Err("TTS 与 ASR 模型 ID 不能为空".into());
    }
    if !matches!(config.asr_language.as_str(), "auto" | "zh" | "en") {
        return Err("ASR 语言只支持 auto、zh 或 en".into());
    }
    Ok(())
}

fn provider_error(status: u16, body: &Value) -> String {
    body.pointer("/error/message")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| format!("云端语音请求失败（HTTP {status}）"))
}

async fn send_json(
    client: &Client,
    url: Url,
    key: &str,
    payload: &Value,
    cancelled: Option<&AtomicBool>,
) -> Result<Value, String> {
    let request = client
        .post(url)
        .header(header::CONTENT_TYPE, "application/json")
        .bearer_auth(key)
        .json(payload)
        .send();
    tokio::pin!(request);
    let response = loop {
        tokio::select! {
            result = &mut request => break result.map_err(|error| format!("云端语音网络请求失败: {error}"))?,
            _ = tokio::time::sleep(Duration::from_millis(75)) => {
                if cancelled.is_some_and(|value| value.load(Ordering::Relaxed)) {
                    return Err("云端字幕识别已取消".into());
                }
            }
        }
    };
    let status = response.status().as_u16();
    let body = response
        .json::<Value>()
        .await
        .map_err(|error| format!("云端语音响应格式无效: {error}"))?;
    if !(200..300).contains(&status) {
        return Err(provider_error(status, &body));
    }
    Ok(body)
}

fn response_content(body: &Value) -> Option<String> {
    let content = body.pointer("/choices/0/message/content")?;
    if let Some(text) = content.as_str() {
        return Some(text.trim().to_string());
    }
    content.as_array().map(|parts| {
        parts
            .iter()
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("")
            .trim()
            .to_string()
    })
}

fn tts_payload(config: &CloudSpeechConfig, text: &str) -> Result<Value, String> {
    let style = config.tts_style.trim();
    let mut messages = Vec::new();
    if config.tts_model == "mimo-v2.5-tts-voicedesign" && style.is_empty() {
        return Err("音色设计模型必须填写音色设计描述".into());
    }
    if config.tts_model != "mimo-v2.5-tts-voicedesign" && config.tts_voice.trim().is_empty() {
        return Err("预置音色不能为空".into());
    }
    if !style.is_empty() {
        messages.push(json!({ "role": "user", "content": style }));
    }
    messages.push(json!({ "role": "assistant", "content": text }));
    let audio = if config.tts_model == "mimo-v2.5-tts-voicedesign" {
        json!({ "format": "wav", "optimize_text_preview": false })
    } else {
        json!({ "format": "wav", "voice": config.tts_voice.trim() })
    };
    Ok(json!({ "model": config.tts_model, "messages": messages, "audio": audio }))
}

fn audio_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("audio");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建音频目录: {error}"))?;
    Ok(path)
}

#[tauri::command]
pub async fn verify_cloud_speech(
    app: AppHandle,
    config: CloudSpeechConfig,
) -> Result<String, String> {
    validate_config(&config)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get(endpoint(&config, "models")?)
        .bearer_auth(api_key(&app)?)
        .send()
        .await
        .map_err(|error| format!("云端语音连接失败: {error}"))?;
    let status = response.status().as_u16();
    let body = response
        .json::<Value>()
        .await
        .map_err(|error| format!("模型列表响应无效: {error}"))?;
    if !(200..300).contains(&status) {
        return Err(provider_error(status, &body));
    }
    let model_ids = body
        .get("data")
        .and_then(Value::as_array)
        .map(|models| {
            models
                .iter()
                .filter_map(|model| model.get("id").and_then(Value::as_str))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let missing = [&config.tts_model, &config.asr_model]
        .into_iter()
        .filter(|model| !model_ids.contains(&model.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        return Err(format!(
            "服务端未返回配置的语音模型：{}",
            missing.join("、")
        ));
    }
    Ok(format!(
        "凭证与语音模型可用，共返回 {} 个模型；此检查不验证推理余额",
        model_ids.len()
    ))
}

#[tauri::command]
pub async fn synthesize_cloud_speech(
    app: AppHandle,
    config: CloudSpeechConfig,
    text: String,
) -> Result<String, String> {
    validate_config(&config)?;
    let text = text.trim();
    if text.is_empty() {
        return Err("配音文字不能为空".into());
    }
    if text.chars().count() > 20_000 {
        return Err("单次配音文字不能超过 20000 字".into());
    }
    let payload = tts_payload(&config, text)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|error| error.to_string())?;
    let body = send_json(
        &client,
        endpoint(&config, "chat/completions")?,
        &api_key(&app)?,
        &payload,
        None,
    )
    .await?;
    let encoded = body
        .pointer("/choices/0/message/audio/data")
        .and_then(Value::as_str)
        .ok_or("TTS 响应缺少音频数据")?;
    let bytes = BASE64
        .decode(encoded)
        .map_err(|error| format!("TTS 音频数据无效: {error}"))?;
    if bytes.len() <= 44 {
        return Err("TTS 没有生成有效 WAV 音频".into());
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let output = audio_directory(&app)?.join(format!("mimo-speech-{stamp}.wav"));
    fs::write(&output, bytes).map_err(|error| format!("保存 TTS 音频失败: {error}"))?;
    Ok(output.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn merge_cloud_speech_segments(app: AppHandle, paths: Vec<String>) -> Result<String, String> {
    if !(2..=100).contains(&paths.len()) {
        return Err("逐句配音合并需要 2 到 100 个音频片段".into());
    }
    let directory = audio_directory(&app)?.canonicalize().map_err(|error| format!("无法访问配音目录: {error}"))?;
    let mut sources = Vec::with_capacity(paths.len());
    for path in paths {
        let source = PathBuf::from(path).canonicalize().map_err(|_| "待合并的配音片段不存在".to_string())?;
        if source.parent() != Some(directory.as_path()) || source.extension().and_then(|value| value.to_str()) != Some("wav") {
            return Err("只能合并客户端生成的 WAV 配音片段".into());
        }
        sources.push(source);
    }
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_millis();
    let output = directory.join(format!("mimo-speech-merged-{stamp}.wav"));
    let mut command = Command::new(require_command(&app, "ffmpeg")?);
    command.arg("-y");
    for source in &sources { command.arg("-i").arg(source); }
    let inputs = (0..sources.len()).map(|index| format!("[{index}:a:0]")).collect::<String>();
    let filter = format!("{inputs}concat=n={}:v=0:a=1[out]", sources.len());
    command.args(["-filter_complex", &filter, "-map", "[out]", "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le"]).arg(&output);
    run(command, "合并逐句配音")?;
    for source in sources { let _ = fs::remove_file(source); }
    Ok(output.to_string_lossy().into_owned())
}

fn prepare_asr_chunks(
    app: &AppHandle,
    source: &Path,
    job_id: &str,
) -> Result<(PathBuf, Vec<PathBuf>), String> {
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("cloud-asr")
        .join(job_id);
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建云端字幕缓存: {error}"))?;
    let pattern = directory.join("chunk-%03d.mp3");
    let mut command = Command::new(require_command(app, "ffmpeg")?);
    command
        .args(["-y", "-i"])
        .arg(source)
        .args([
            "-map",
            "0:a:0",
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "64k",
            "-f",
            "segment",
            "-segment_time",
            &ASR_CHUNK_SECONDS.to_string(),
            "-reset_timestamps",
            "1",
        ])
        .arg(&pattern);
    run(command, "准备云端字幕音频")?;
    let mut chunks = fs::read_dir(&directory)
        .map_err(|error| format!("无法读取云端字幕缓存: {error}"))?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("mp3"))
        .collect::<Vec<_>>();
    chunks.sort();
    if chunks.is_empty() {
        return Err("素材没有可识别的音轨".into());
    }
    if chunks.iter().any(|path| {
        fs::metadata(path)
            .map(|value| value.len() > MAX_RAW_AUDIO_BYTES)
            .unwrap_or(true)
    }) {
        return Err("云端 ASR 音频分片超过 MiMo 10MB Base64 限制".into());
    }
    Ok((directory, chunks))
}

fn emit_progress(
    channel: &Channel<SpeechProgressEvent>,
    job_id: &str,
    phase: &str,
    message: String,
    progress: f64,
) {
    let _ = channel.send(SpeechProgressEvent {
        job_id: job_id.into(),
        phase: phase.into(),
        message,
        progress,
    });
}

#[tauri::command]
pub async fn transcribe_cloud_media(
    app: AppHandle,
    state: State<'_, SpeechRequestState>,
    path: String,
    duration_us: u64,
    config: CloudSpeechConfig,
    job_id: String,
    on_event: Channel<SpeechProgressEvent>,
) -> Result<CloudAsrTranscript, String> {
    validate_config(&config)?;
    let source = PathBuf::from(path);
    if !source.is_file() {
        return Err("待识别素材不存在".into());
    }
    let cancelled = state.begin(&job_id)?;
    emit_progress(
        &on_event,
        &job_id,
        "extracting",
        "正在准备云端识别音频".into(),
        0.02,
    );
    let prepared = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        let source = source.clone();
        let job_id = job_id.clone();
        move || prepare_asr_chunks(&app, &source, &job_id)
    })
    .await
    .map_err(|error| format!("音频准备任务异常: {error}"));
    let (directory, chunks) = match prepared {
        Ok(Ok(value)) => value,
        Ok(Err(error)) | Err(error) => {
            state.finish(&job_id);
            return Err(error);
        }
    };
    let result = async {
        let client = Client::builder().timeout(Duration::from_secs(180)).build().map_err(|error| error.to_string())?;
        let key = api_key(&app)?;
        let url = endpoint(&config, "chat/completions")?;
        let mut segments = Vec::new();
        let mut texts = Vec::new();
        for (index, chunk) in chunks.iter().enumerate() {
            if cancelled.load(Ordering::Relaxed) {
                return Err("云端字幕识别已取消".into());
            }
            let progress = 0.08 + index as f64 / chunks.len() as f64 * 0.84;
            emit_progress(&on_event, &job_id, "uploading", format!("正在识别第 {}/{} 段音频", index + 1, chunks.len()), progress);
            let bytes = fs::read(chunk).map_err(|error| format!("无法读取 ASR 音频分片: {error}"))?;
            let data = format!("data:audio/mpeg;base64,{}", BASE64.encode(bytes));
            let payload = json!({
                "model": config.asr_model,
                "messages": [{ "role": "user", "content": [{ "type": "input_audio", "input_audio": { "data": data } }] }],
                "asr_options": { "language": config.asr_language }
            });
            let body = send_json(&client, url.clone(), &key, &payload, Some(&cancelled)).await?;
            let text = response_content(&body).filter(|value| !value.is_empty()).ok_or("ASR 响应没有识别文本")?;
            let start_seconds = index as u64 * ASR_CHUNK_SECONDS;
            let end_seconds = if duration_us > 0 {
                ((start_seconds * 1_000_000 + ASR_CHUNK_SECONDS * 1_000_000).min(duration_us) as f64) / 1_000_000.0
            } else {
                (start_seconds + ASR_CHUNK_SECONDS) as f64
            };
            segments.push(CloudAsrSegment { start_seconds: start_seconds as f64, end_seconds, text: text.clone() });
            texts.push(text);
        }
        emit_progress(&on_event, &job_id, "ready", "云端字幕识别完成".into(), 1.0);
        Ok(CloudAsrTranscript {
            language: config.asr_language.clone(),
            text: texts.join("\n"),
            segments,
            device: format!("cloud:{}", config.asr_model),
        })
    }.await;
    state.finish(&job_id);
    let _ = fs::remove_dir_all(directory);
    result
}

#[tauri::command]
pub fn cancel_cloud_speech_request(state: State<'_, SpeechRequestState>, job_id: String) -> bool {
    state
        .jobs
        .lock()
        .ok()
        .and_then(|jobs| jobs.get(&job_id).cloned())
        .map(|cancelled| {
            cancelled.store(true, Ordering::Relaxed);
            true
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(base_url: &str) -> CloudSpeechConfig {
        CloudSpeechConfig {
            base_url: base_url.into(),
            tts_model: "mimo-v2.5-tts".into(),
            tts_voice: "冰糖".into(),
            tts_style: "自然".into(),
            asr_model: "mimo-v2.5-asr".into(),
            asr_language: "zh".into(),
        }
    }

    #[test]
    fn builds_mimo_compatible_endpoints() {
        assert_eq!(
            endpoint(&config("https://api.xiaomimimo.com/v1"), "chat/completions")
                .unwrap()
                .as_str(),
            "https://api.xiaomimimo.com/v1/chat/completions"
        );
        assert_eq!(
            endpoint(
                &config("https://api.xiaomimimo.com/v1/chat/completions"),
                "models"
            )
            .unwrap()
            .as_str(),
            "https://api.xiaomimimo.com/v1/models"
        );
    }

    #[test]
    fn extracts_openai_message_content() {
        assert_eq!(
            response_content(&json!({ "choices": [{ "message": { "content": " 识别结果 " } }] })),
            Some("识别结果".into())
        );
    }

    #[test]
    fn builds_documented_tts_messages_and_requires_voice_design_description() {
        let preset = tts_payload(&config("https://api.xiaomimimo.com/v1"), "测试配音").unwrap();
        assert_eq!(preset.pointer("/messages/0/role"), Some(&json!("user")));
        assert_eq!(
            preset.pointer("/messages/1/role"),
            Some(&json!("assistant"))
        );
        assert_eq!(preset.pointer("/audio/voice"), Some(&json!("冰糖")));

        let mut voice_design = config("https://api.xiaomimimo.com/v1");
        voice_design.tts_model = "mimo-v2.5-tts-voicedesign".into();
        voice_design.tts_style.clear();
        assert_eq!(
            tts_payload(&voice_design, "测试配音").unwrap_err(),
            "音色设计模型必须填写音色设计描述"
        );
    }
}
