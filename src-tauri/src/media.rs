use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    env,
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Command, Output, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, AppHandle, Manager, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaToolStatus {
    ffmpeg_path: Option<String>,
    ffprobe_path: Option<String>,
    ready: bool,
    message: String,
    available_encoders: Vec<String>,
    recommended_encoder: String,
    bundled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbe {
    duration_us: u64,
    width: u32,
    height: u32,
    fps_numerator: u32,
    fps_denominator: u32,
    video_codec: String,
    audio_codec: Option<String>,
    has_video: bool,
    has_audio: bool,
    file_size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDerivatives {
    thumbnail_path: Option<String>,
    waveform_path: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyJobEvent {
    job_id: String,
    message: String,
    progress: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyMediaResult {
    proxy_path: String,
    height: u32,
}

#[derive(Serialize)]
pub struct AudioExtractionResult {
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderPlan {
    width: u32,
    height: u32,
    fps: f64,
    output_path: String,
    encoder: Option<String>,
    segments: Vec<RenderSegment>,
    overlays: Vec<RenderOverlay>,
    audios: Vec<RenderAudioClip>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportJobEvent {
    job_id: String,
    phase: String,
    message: String,
    progress: f64,
    segment_index: usize,
    segment_count: usize,
}

#[derive(Default)]
pub struct ExportManagerState {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl ExportManagerState {
    fn begin(&self, job_id: &str) -> Result<Arc<AtomicBool>, String> {
        if job_id.trim().is_empty() { return Err("导出任务 ID 不能为空".into()); }
        let mut jobs = self.jobs.lock().map_err(|_| "导出任务状态不可用".to_string())?;
        if jobs.contains_key(job_id) { return Err("导出任务已经在运行".into()); }
        let cancelled = Arc::new(AtomicBool::new(false));
        jobs.insert(job_id.into(), cancelled.clone());
        Ok(cancelled)
    }

    fn finish(&self, job_id: &str) {
        if let Ok(mut jobs) = self.jobs.lock() { jobs.remove(job_id); }
    }
}

struct ExportReporter {
    job_id: String,
    channel: Option<Channel<ExportJobEvent>>,
    cancelled: Arc<AtomicBool>,
}

impl ExportReporter {
    #[cfg(test)]
    fn silent() -> Self { Self { job_id: "test".into(), channel: None, cancelled: Arc::new(AtomicBool::new(false)) } }

    fn emit(&self, phase: &str, message: impl Into<String>, progress: f64, segment_index: usize, segment_count: usize) -> Result<(), String> {
        if self.cancelled.load(Ordering::Relaxed) { return Err("视频导出已取消".into()); }
        if let Some(channel) = &self.channel {
            channel.send(ExportJobEvent { job_id: self.job_id.clone(), phase: phase.into(), message: message.into(), progress: progress.clamp(0.0, 1.0), segment_index, segment_count }).map_err(|error| format!("无法上报导出进度: {error}"))?;
        }
        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderSegment {
    kind: String,
    duration_us: u64,
    path: Option<String>,
    source_in_us: Option<u64>,
    playback_rate: Option<f64>,
    volume: Option<f64>,
    fit: Option<String>,
    has_audio: Option<bool>,
    #[serde(rename = "loop")]
    loop_media: Option<bool>,
    camera: Option<RenderCameraMotion>,
    camera_offset_us: Option<u64>,
    camera_duration_us: Option<u64>,
    color: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderCameraMotion {
    start_scale: f64,
    end_scale: f64,
    start_x: f64,
    end_x: f64,
    start_y: f64,
    end_y: f64,
    easing: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderOverlay {
    kind: Option<String>,
    start_us: u64,
    duration_us: u64,
    x: f64,
    y: f64,
    opacity: Option<f64>,
    rotation: Option<f64>,
    speed: Option<f64>,
    recipe: Option<RenderEffectRecipe>,
    image_data_base64: Option<String>,
    image_path: Option<String>,
    target_width_px: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderEffectRecipe {
    entrance: String,
    animation: Option<RenderEffectAnimation>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderEffectAnimation {
    duration_seconds: f64,
    easing: String,
    keyframes: Vec<RenderEffectKeyframe>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderEffectKeyframe {
    offset: f64,
    translate_x: f64,
    translate_y: f64,
    scale: f64,
    rotation: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderAudioClip {
    path: String,
    start_us: u64,
    duration_us: u64,
    source_in_us: u64,
    playback_rate: f64,
    volume: f64,
    fade_in_us: u64,
    fade_out_us: u64,
    role: String,
}

fn command_candidates(app: &AppHandle, name: &str) -> Vec<PathBuf> {
    let env_key = format!("BVIDEO_{}_PATH", name.to_ascii_uppercase());
    let mut candidates = env::var_os(env_key).map(PathBuf::from).into_iter().collect::<Vec<_>>();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("binaries").join(name));
        candidates.push(resource_dir.join("binaries").join(format!("{name}.exe")));
    }
    if let Ok(executable) = env::current_exe() {
        if let Some(directory) = executable.parent() {
            candidates.push(directory.join(name));
            candidates.push(directory.join(format!("{name}.exe")));
        }
    }
    if cfg!(target_os = "macos") {
        candidates.push(PathBuf::from(format!("/opt/homebrew/bin/{name}")));
        candidates.push(PathBuf::from(format!("/usr/local/bin/{name}")));
    }
    candidates
}

fn find_command(app: &AppHandle, name: &str) -> Option<PathBuf> {
    for candidate in command_candidates(app, name) {
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    let output = Command::new(name).arg("-version").output().ok()?;
    output.status.success().then(|| PathBuf::from(name))
}

pub(crate) fn require_command(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    find_command(app, name).ok_or_else(|| {
        format!("未找到 {name}。请安装 FFmpeg，或通过 BVIDEO_{}_PATH 指定可执行文件。", name.to_ascii_uppercase())
    })
}

pub(crate) fn run(mut command: Command, operation: &str) -> Result<Output, String> {
    #[cfg(test)]
    eprintln!("starting {operation}: {command:?}");
    let output = command.output().map_err(|error| format!("{operation}启动失败: {error}"))?;
    #[cfg(test)]
    eprintln!("finished {operation}");
    if output.status.success() {
        Ok(output)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("{operation}失败: {}", stderr.lines().rev().take(40).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n")))
    }
}

fn run_export_command(
    mut command: Command,
    operation: &str,
    expected_duration_us: u64,
    progress_start: f64,
    progress_span: f64,
    reporter: &ExportReporter,
    segment_index: usize,
    segment_count: usize,
    log_path: &Path,
) -> Result<(), String> {
    reporter.emit("rendering", operation, progress_start, segment_index, segment_count)?;
    let log = fs::File::create(log_path).map_err(|error| format!("无法创建导出日志: {error}"))?;
    command.stdout(Stdio::piped()).stderr(Stdio::from(log));
    let mut child = command.spawn().map_err(|error| format!("{operation}启动失败: {error}"))?;
    let stdout = child.stdout.take().ok_or_else(|| format!("{operation}没有进度输出"))?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    loop {
        line.clear();
        let count = reader.read_line(&mut line).map_err(|error| format!("{operation}进度读取失败: {error}"))?;
        if reporter.cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("视频导出已取消".into());
        }
        if count == 0 { break; }
        if let Some(value) = line.trim().strip_prefix("out_time_us=").or_else(|| line.trim().strip_prefix("out_time_ms=")) {
            if let Ok(time_us) = value.parse::<u64>() {
                let local = if expected_duration_us == 0 { 0.0 } else { time_us as f64 / expected_duration_us as f64 };
                reporter.emit("rendering", operation, progress_start + progress_span * local.clamp(0.0, 1.0), segment_index, segment_count)?;
            }
        }
    }
    let status = child.wait().map_err(|error| format!("{operation}状态读取失败: {error}"))?;
    if status.success() {
        reporter.emit("rendering", operation, progress_start + progress_span, segment_index, segment_count)
    } else {
        let stderr = fs::read_to_string(log_path).unwrap_or_default();
        Err(format!("{operation}失败: {}", stderr.lines().rev().take(40).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n")))
    }
}

fn encoder_codec(id: &str) -> Option<&'static str> {
    match id {
        "software" => Some("libx264"),
        "videotoolbox" => Some("h264_videotoolbox"),
        "nvenc" => Some("h264_nvenc"),
        "qsv" => Some("h264_qsv"),
        _ => None,
    }
}

fn encoder_usable(ffmpeg: &Path, id: &str) -> bool {
    let Some(codec) = encoder_codec(id) else { return false };
    Command::new(ffmpeg).args(["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=10:d=0.1", "-frames:v", "1", "-c:v", codec, "-f", "null", "-"]).output().map(|output| output.status.success()).unwrap_or(false)
}

fn available_encoders(ffmpeg: &Path) -> Vec<String> {
    ["software", "videotoolbox", "nvenc", "qsv"].into_iter().filter(|id| encoder_usable(ffmpeg, id)).map(str::to_owned).collect()
}

fn recommended_encoder(encoders: &[String]) -> String {
    let preferred = if cfg!(target_os = "macos") { "videotoolbox" } else if cfg!(target_os = "windows") { "nvenc" } else { "qsv" };
    if encoders.iter().any(|value| value == preferred) { preferred.into() } else { "software".into() }
}

fn resolve_encoder(ffmpeg: &Path, requested: Option<&str>) -> Result<String, String> {
    let available = available_encoders(ffmpeg);
    let requested = requested.unwrap_or("auto");
    if requested == "auto" { return Ok(recommended_encoder(&available)); }
    if encoder_codec(requested).is_none() { return Err("不支持此视频编码器".into()); }
    available.into_iter().find(|value| value == requested).ok_or_else(|| format!("当前设备无法使用 {requested} 编码器"))
}

fn apply_video_encoder(command: &mut Command, encoder: &str) {
    match encoder {
        "videotoolbox" => { command.args(["-c:v", "h264_videotoolbox", "-q:v", "55", "-allow_sw", "1"]); }
        "nvenc" => { command.args(["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", "20"]); }
        "qsv" => { command.args(["-c:v", "h264_qsv", "-preset", "medium", "-global_quality", "20"]); }
        _ => { command.args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]); }
    }
}

fn ensure_source(path: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(path).map_err(|error| format!("无法访问素材文件: {error}"))?;
    if !path.is_file() {
        return Err("素材路径不是文件".into());
    }
    Ok(path)
}

#[tauri::command]
pub fn media_tool_status(app: AppHandle) -> MediaToolStatus {
    let ffmpeg = find_command(&app, "ffmpeg");
    let ffprobe = find_command(&app, "ffprobe");
    let ready = ffmpeg.is_some() && ffprobe.is_some();
    let encoders = ffmpeg.as_deref().map(available_encoders).unwrap_or_default();
    let preferred = recommended_encoder(&encoders);
    let bundled = ffmpeg.as_ref().map(|path| {
        let in_resources = app.path().resource_dir().ok().map(|resource| path.starts_with(resource.join("binaries"))).unwrap_or(false);
        let beside_executable = env::current_exe().ok().and_then(|executable| executable.parent().map(|directory| path.starts_with(directory))).unwrap_or(false);
        in_resources || beside_executable
    }).unwrap_or(false);
    MediaToolStatus {
        ffmpeg_path: ffmpeg.as_ref().map(|path| path.to_string_lossy().into_owned()),
        ffprobe_path: ffprobe.as_ref().map(|path| path.to_string_lossy().into_owned()),
        ready,
        message: if ready { "本地媒体引擎可用".into() } else { "需要安装 FFmpeg（同时包含 ffprobe）".into() },
        available_encoders: encoders,
        recommended_encoder: preferred,
        bundled,
    }
}

#[tauri::command]
pub fn probe_media(app: AppHandle, path: String) -> Result<MediaProbe, String> {
    let source = ensure_source(&path)?;
    let ffprobe = require_command(&app, "ffprobe")?;
    let mut command = Command::new(ffprobe);
    command.args(["-v", "error", "-show_streams", "-show_format", "-of", "json"]).arg(&source);
    let output = run(command, "媒体探测")?;
    let value: Value = serde_json::from_slice(&output.stdout).map_err(|error| format!("无法解析 ffprobe 输出: {error}"))?;
    let streams = value["streams"].as_array().ok_or("ffprobe 没有返回媒体流")?;
    let video = streams.iter().find(|stream| stream["codec_type"] == "video");
    let audio = streams.iter().find(|stream| stream["codec_type"] == "audio");
    if video.is_none() && audio.is_none() { return Err("文件中没有可用的音视频流".into()); }
    let duration = value["format"]["duration"].as_str().and_then(|value| value.parse::<f64>().ok())
        .or_else(|| video.and_then(|stream| stream["duration"].as_str()).and_then(|value| value.parse::<f64>().ok()))
        .or_else(|| audio.and_then(|stream| stream["duration"].as_str()).and_then(|value| value.parse::<f64>().ok())).unwrap_or(0.0);
    let rate = video.and_then(|stream| stream["avg_frame_rate"].as_str()).unwrap_or("30/1");
    let mut rate_parts = rate.split('/').filter_map(|part| part.parse::<u32>().ok());
    let fps_numerator = rate_parts.next().unwrap_or(30).max(1);
    let fps_denominator = rate_parts.next().unwrap_or(1).max(1);
    Ok(MediaProbe {
        duration_us: (duration.max(0.0) * 1_000_000.0).round() as u64,
        width: video.and_then(|stream| stream["width"].as_u64()).unwrap_or(0) as u32,
        height: video.and_then(|stream| stream["height"].as_u64()).unwrap_or(0) as u32,
        fps_numerator,
        fps_denominator,
        video_codec: video.and_then(|stream| stream["codec_name"].as_str()).unwrap_or("none").into(),
        audio_codec: audio.and_then(|stream| stream["codec_name"].as_str()).map(str::to_owned),
        has_video: video.is_some(),
        has_audio: audio.is_some(),
        file_size: fs::metadata(source).map(|metadata| metadata.len()).unwrap_or(0),
    })
}

#[tauri::command]
pub fn generate_media_derivatives(app: AppHandle, path: String, asset_id: String, has_video: bool, has_audio: bool) -> Result<MediaDerivatives, String> {
    let source = ensure_source(&path)?;
    let ffmpeg = require_command(&app, "ffmpeg")?;
    let cache_dir = app.path().app_cache_dir().map_err(|error| error.to_string())?.join("media").join(safe_component(&asset_id));
    fs::create_dir_all(&cache_dir).map_err(|error| format!("无法创建媒体缓存: {error}"))?;
    let thumbnail = cache_dir.join("thumbnail.jpg");
    let thumbnail_path = if has_video {
        let mut thumbnail_command = Command::new(&ffmpeg);
        thumbnail_command.args(["-y", "-ss", "1", "-i"]).arg(&source).args(["-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "3"]).arg(&thumbnail);
        run(thumbnail_command, "生成缩略图")?;
        Some(thumbnail.to_string_lossy().into_owned())
    } else { None };
    let waveform = cache_dir.join("waveform.png");
    let waveform_path = if has_audio {
        let mut waveform_command = Command::new(&ffmpeg);
        waveform_command.args(["-y", "-i"]).arg(&source).args(["-filter_complex", "aformat=channel_layouts=mono,showwavespic=s=1200x160:colors=4f8cff", "-frames:v", "1"]).arg(&waveform);
        run(waveform_command, "生成波形")?;
        Some(waveform.to_string_lossy().into_owned())
    } else {
        None
    };
    Ok(MediaDerivatives { thumbnail_path, waveform_path })
}

fn generate_proxy_blocking(
    ffmpeg: &Path,
    source: &Path,
    output: &Path,
    height: u32,
    duration_us: u64,
    job_id: &str,
    cancelled: &AtomicBool,
    channel: Option<&Channel<ProxyJobEvent>>,
    log_path: &Path,
) -> Result<(), String> {
    let partial = output.with_file_name(format!("{}.part.mp4", output.file_stem().unwrap_or_default().to_string_lossy()));
    let _ = fs::remove_file(&partial);
    let emit = |message: String, progress: f64| -> Result<(), String> {
        if let Some(channel) = channel { channel.send(ProxyJobEvent { job_id: job_id.into(), message, progress }).map_err(|error| error.to_string())?; }
        Ok(())
    };
    emit(format!("正在生成 {height}p 代理媒体"), 0.0)?;
    let log = fs::File::create(log_path).map_err(|error| format!("无法创建代理日志: {error}"))?;
    let mut command = Command::new(ffmpeg);
    command.args(["-y", "-i"]).arg(source).args(["-map", "0:v:0", "-map", "0:a?", "-vf", &format!("scale=-2:min({height}\\,ih)"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats"]).arg(&partial).stdout(Stdio::piped()).stderr(Stdio::from(log));
    let mut child = command.spawn().map_err(|error| format!("代理媒体生成启动失败: {error}"))?;
    let stdout = child.stdout.take().ok_or("代理媒体任务没有进度输出")?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    loop {
        line.clear();
        let count = reader.read_line(&mut line).map_err(|error| format!("代理媒体进度读取失败: {error}"))?;
        if cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_file(&partial);
            return Err("代理媒体生成已取消".into());
        }
        if count == 0 { break; }
        if let Some(value) = line.trim().strip_prefix("out_time_us=").or_else(|| line.trim().strip_prefix("out_time_ms=")) {
            if let Ok(time_us) = value.parse::<u64>() {
                emit(format!("正在生成 {height}p 代理媒体"), if duration_us == 0 { 0.0 } else { (time_us as f64 / duration_us as f64).clamp(0.0, 1.0) })?;
            }
        }
    }
    let status = child.wait().map_err(|error| format!("代理媒体任务异常: {error}"))?;
    if !status.success() {
        let stderr = fs::read_to_string(log_path).unwrap_or_default();
        let _ = fs::remove_file(&partial);
        return Err(format!("代理媒体生成失败: {}", stderr.lines().rev().take(30).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n")));
    }
    if output.exists() { fs::remove_file(output).map_err(|error| format!("无法替换旧代理媒体: {error}"))?; }
    fs::rename(&partial, output).map_err(|error| format!("无法完成代理媒体: {error}"))?;
    emit("代理媒体已就绪".into(), 1.0)?;
    Ok(())
}

#[tauri::command]
pub async fn generate_proxy_media(
    app: AppHandle,
    state: State<'_, ExportManagerState>,
    path: String,
    asset_id: String,
    height: u32,
    duration_us: u64,
    job_id: String,
    on_event: Channel<ProxyJobEvent>,
) -> Result<ProxyMediaResult, String> {
    if !matches!(height, 540 | 720) { return Err("代理分辨率只支持 540p 或 720p".into()); }
    let source = ensure_source(&path)?;
    let ffmpeg = require_command(&app, "ffmpeg")?;
    let cache_dir = app.path().app_cache_dir().map_err(|error| error.to_string())?.join("media").join(safe_component(&asset_id));
    fs::create_dir_all(&cache_dir).map_err(|error| format!("无法创建媒体缓存: {error}"))?;
    let output = cache_dir.join(format!("proxy-{height}.mp4"));
    let log = cache_dir.join(format!("proxy-{height}.log"));
    let cancelled = state.begin(&job_id)?;
    let worker_output = output.clone();
    let worker_job_id = job_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || generate_proxy_blocking(&ffmpeg, &source, &worker_output, height, duration_us, &worker_job_id, &cancelled, Some(&on_event), &log)).await;
    state.finish(&job_id);
    match result {
        Ok(Ok(())) => Ok(ProxyMediaResult { proxy_path: output.to_string_lossy().into_owned(), height }),
        Ok(Err(error)) => Err(error),
        Err(error) => Err(format!("代理媒体任务异常结束: {error}")),
    }
}

fn audio_output(app: &AppHandle, asset_id: &str, job_id: &str, output_path: Option<&str>) -> Result<PathBuf, String> {
    let output = if let Some(path) = output_path.filter(|value| !value.trim().is_empty()) {
        PathBuf::from(path)
    } else {
        app.path().app_data_dir().map_err(|error| error.to_string())?.join("audio").join(format!("extracted-{}-{}.m4a", safe_component(asset_id), safe_component(job_id)))
    };
    let extension = output.extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase();
    if !matches!(extension.as_str(), "m4a" | "wav" | "mp3" | "flac") {
        return Err("音频分离只支持 M4A、WAV、MP3 或 FLAC".into());
    }
    if let Some(parent) = output.parent() { fs::create_dir_all(parent).map_err(|error| format!("无法创建音频目录: {error}"))?; }
    Ok(output)
}

fn extract_audio_blocking(
    ffmpeg: &Path,
    source: &Path,
    output: &Path,
    duration_us: u64,
    job_id: &str,
    cancelled: &AtomicBool,
    channel: Option<&Channel<ProxyJobEvent>>,
    log_path: &Path,
) -> Result<(), String> {
    let extension = output.extension().and_then(|value| value.to_str()).unwrap_or("m4a").to_ascii_lowercase();
    let stem = output.file_stem().and_then(|value| value.to_str()).unwrap_or("audio");
    let partial = output.with_file_name(format!(".{stem}.part.{extension}"));
    let _ = fs::remove_file(&partial);
    let emit = |message: &str, progress: f64| -> Result<(), String> {
        if let Some(channel) = channel {
            channel.send(ProxyJobEvent { job_id: job_id.into(), message: message.into(), progress: progress.clamp(0.0, 1.0) }).map_err(|error| error.to_string())?;
        }
        Ok(())
    };
    emit("正在使用 FFmpeg 分离音频", 0.0)?;
    let log = fs::File::create(log_path).map_err(|error| format!("无法创建音频分离日志: {error}"))?;
    let mut command = Command::new(ffmpeg);
    command.args(["-y", "-i"]).arg(source).args(["-map", "0:a:0", "-vn"]);
    match extension.as_str() {
        "wav" => { command.args(["-c:a", "pcm_s16le"]); }
        "mp3" => { command.args(["-c:a", "libmp3lame", "-b:a", "192k"]); }
        "flac" => { command.args(["-c:a", "flac"]); }
        _ => { command.args(["-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]); }
    }
    command.args(["-progress", "pipe:1", "-nostats"]).arg(&partial).stdout(Stdio::piped()).stderr(Stdio::from(log));
    let mut child = command.spawn().map_err(|error| format!("音频分离启动失败: {error}"))?;
    let stdout = child.stdout.take().ok_or("音频分离任务没有进度输出")?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    loop {
        line.clear();
        let count = reader.read_line(&mut line).map_err(|error| format!("音频分离进度读取失败: {error}"))?;
        if cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_file(&partial);
            return Err("音频分离已取消".into());
        }
        if count == 0 { break; }
        if let Some(value) = line.trim().strip_prefix("out_time_us=").or_else(|| line.trim().strip_prefix("out_time_ms=")) {
            if let Ok(time_us) = value.parse::<u64>() {
                emit("正在使用 FFmpeg 分离音频", if duration_us == 0 { 0.0 } else { time_us as f64 / duration_us as f64 })?;
            }
        }
    }
    let status = child.wait().map_err(|error| format!("音频分离任务异常: {error}"))?;
    if !status.success() {
        let stderr = fs::read_to_string(log_path).unwrap_or_default();
        let _ = fs::remove_file(&partial);
        return Err(format!("音频分离失败: {}", stderr.lines().rev().take(30).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n")));
    }
    if output.exists() { fs::remove_file(output).map_err(|error| format!("无法替换已有音频: {error}"))?; }
    fs::rename(&partial, output).map_err(|error| format!("无法完成音频分离: {error}"))?;
    emit("音频分离完成", 1.0)
}

#[tauri::command]
pub async fn extract_media_audio(
    app: AppHandle,
    state: State<'_, ExportManagerState>,
    path: String,
    asset_id: String,
    duration_us: u64,
    output_path: Option<String>,
    job_id: String,
    on_event: Channel<ProxyJobEvent>,
) -> Result<AudioExtractionResult, String> {
    let source = ensure_source(&path)?;
    let output = audio_output(&app, &asset_id, &job_id, output_path.as_deref())?;
    if fs::canonicalize(&output).ok().as_ref() == Some(&source) { return Err("输出音频不能覆盖源视频".into()); }
    let ffmpeg = require_command(&app, "ffmpeg")?;
    let log_dir = app.path().app_cache_dir().map_err(|error| error.to_string())?.join("media").join(safe_component(&asset_id));
    fs::create_dir_all(&log_dir).map_err(|error| format!("无法创建音频分离缓存: {error}"))?;
    let log = log_dir.join(format!("extract-{}.log", safe_component(&job_id)));
    let cancelled = state.begin(&job_id)?;
    let worker_output = output.clone();
    let worker_job_id = job_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || extract_audio_blocking(&ffmpeg, &source, &worker_output, duration_us, &worker_job_id, &cancelled, Some(&on_event), &log)).await;
    state.finish(&job_id);
    match result {
        Ok(Ok(())) => Ok(AudioExtractionResult { path: output.to_string_lossy().into_owned() }),
        Ok(Err(error)) => Err(error),
        Err(error) => Err(format!("音频分离任务异常结束: {error}")),
    }
}

fn safe_component(value: &str) -> String {
    value.chars().filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_')).collect()
}

fn seconds(value: u64) -> String {
    format!("{:.6}", value as f64 / 1_000_000.0)
}

fn safe_color(value: Option<&str>, fallback: &str) -> String {
    let value = value.unwrap_or(fallback).trim_start_matches('#');
    if value.len() == 6 && value.chars().all(|character| character.is_ascii_hexdigit()) { format!("0x{value}") } else { fallback.into() }
}

fn atempo_chain(rate: f64) -> String {
    let mut remaining = rate.clamp(0.25, 4.0);
    let mut factors = Vec::new();
    while remaining > 2.0 { factors.push(2.0); remaining /= 2.0; }
    while remaining < 0.5 { factors.push(0.5); remaining /= 0.5; }
    factors.push(remaining);
    factors.into_iter().map(|factor| format!("atempo={factor:.6}")).collect::<Vec<_>>().join(",")
}

fn unique_job_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
    let path = app.path().app_cache_dir().map_err(|error| error.to_string())?.join("exports").join(format!("job-{stamp}"));
    fs::create_dir_all(&path).map_err(|error| format!("无法创建导出缓存: {error}"))?;
    Ok(path)
}

fn keyframe_field(keyframe: &RenderEffectKeyframe, field: &str) -> f64 {
    match field {
        "translateX" => keyframe.translate_x.clamp(-400.0, 400.0),
        "translateY" => keyframe.translate_y.clamp(-400.0, 400.0),
        "scale" => keyframe.scale.clamp(0.05, 5.0),
        "rotation" => keyframe.rotation.clamp(-720.0, 720.0),
        _ => 0.0,
    }
}

fn easing_expression(progress: &str, easing: &str) -> String {
    match easing {
        "ease-in" => format!("({progress})*({progress})"),
        "ease-out" => format!("1-(1-({progress}))*(1-({progress}))"),
        "ease-in-out" => format!("if(lt(({progress}),0.5),2*({progress})*({progress}),1-pow(-2*({progress})+2,2)/2)"),
        _ => format!("({progress})"),
    }
}

fn keyframe_expression(animation: &RenderEffectAnimation, field: &str, local_time: &str, speed: f64) -> Option<String> {
    if animation.keyframes.len() < 2 { return None; }
    let duration = (animation.duration_seconds.clamp(0.05, 10.0) / speed.clamp(0.1, 4.0)).max(0.001);
    let progress = format!("min(max(({local_time})/{duration:.6},0),1)");
    let mut expression = format!("{:.9}", keyframe_field(animation.keyframes.last()?, field));
    for pair in animation.keyframes.windows(2).rev() {
        let left = &pair[0];
        let right = &pair[1];
        let span = (right.offset - left.offset).max(0.000_001);
        let local = format!("(({progress})-{:.9})/{span:.9}", left.offset);
        let eased = easing_expression(&local, &animation.easing);
        let from = keyframe_field(left, field);
        let delta = keyframe_field(right, field) - from;
        expression = format!("if(lte(({progress}),{:.9}),{from:.9}+({delta:.9})*({eased}),{expression})", right.offset);
    }
    Some(expression)
}

fn camera_filter(segment: &RenderSegment, width: u32, height: u32, fps: f64) -> Option<String> {
    let camera = segment.camera.as_ref()?;
    let start_scale = camera.start_scale.clamp(1.0, 3.0);
    let end_scale = camera.end_scale.clamp(1.0, 3.0);
    let start_x = camera.start_x.clamp(-100.0, 100.0);
    let end_x = camera.end_x.clamp(-100.0, 100.0);
    let start_y = camera.start_y.clamp(-100.0, 100.0);
    let end_y = camera.end_y.clamp(-100.0, 100.0);
    if (start_scale - 1.0).abs() < 0.000_001 && (end_scale - 1.0).abs() < 0.000_001
        && start_x.abs() < 0.000_001 && end_x.abs() < 0.000_001 && start_y.abs() < 0.000_001 && end_y.abs() < 0.000_001 {
        return None;
    }
    let duration = segment.camera_duration_us.unwrap_or(segment.duration_us).max(1) as f64 / 1_000_000.0;
    let offset = segment.camera_offset_us.unwrap_or(0) as f64 / 1_000_000.0;
    let progress = format!("min(max((on/{fps:.9}+{offset:.9})/{duration:.9},0),1)");
    let eased = easing_expression(&progress, &camera.easing);
    let interpolate = |start: f64, end: f64| format!("{start:.9}+({:.9})*({eased})", end - start);
    let zoom = interpolate(start_scale, end_scale);
    let x = interpolate(start_x, end_x);
    let y = interpolate(start_y, end_y);
    Some(format!(
        "zoompan=z='{zoom}':x='(iw-iw/zoom)/2*(1+({x})/100)':y='(ih-ih/zoom)/2*(1+({y})/100)':d=1:s={width}x{height}:fps={fps:.9}"
    ))
}

fn render_segment(ffmpeg: &Path, plan: &RenderPlan, segment: &RenderSegment, output: &Path, index: usize, encoder: &str, reporter: &ExportReporter, progress_start: f64, progress_span: f64, log_path: &Path) -> Result<(), String> {
    let duration = seconds(segment.duration_us.max(1));
    let fps = plan.fps.clamp(1.0, 120.0);
    let size = format!("{}x{}", plan.width, plan.height);
    let mut command = Command::new(ffmpeg);
    command.arg("-y");
    if segment.kind == "video" {
        let source = ensure_source(segment.path.as_deref().ok_or("视频片段缺少源路径")?)?;
        let rate = segment.playback_rate.unwrap_or(1.0).clamp(0.25, 4.0);
        let volume = segment.volume.unwrap_or(1.0).clamp(0.0, 2.0);
        if segment.loop_media.unwrap_or(false) { command.args(["-stream_loop", "-1"]); }
        command.args(["-ss", &seconds(segment.source_in_us.unwrap_or(0)), "-i"]).arg(source);
        command.args(["-f", "lavfi", "-t", &duration, "-i", "anullsrc=r=48000:cl=stereo"]);
        let scale = if segment.fit.as_deref() == Some("cover") {
            format!("scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}", plan.width, plan.height, plan.width, plan.height)
        } else {
            format!("scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black", plan.width, plan.height, plan.width, plan.height)
        };
        let audio_filter = if segment.has_audio.unwrap_or(false) {
            let source_duration = segment.duration_us as f64 * rate / 1_000_000.0;
            format!("[0:a]atrim=duration={source_duration:.6},asetpts=PTS-STARTPTS,{},volume={volume:.4}[a]", atempo_chain(rate))
        } else {
            format!("[1:a]atrim=duration={duration},asetpts=PTS-STARTPTS[a]")
        };
        let mut video_filters = vec![format!("setpts=(PTS-STARTPTS)/{rate:.6}"), scale];
        if let Some(camera) = camera_filter(segment, plan.width, plan.height, fps) { video_filters.push(camera); }
        else { video_filters.push(format!("fps={fps:.6}")); }
        video_filters.push("format=yuv420p".into());
        let filter = format!("[0:v]{}[v];{audio_filter}", video_filters.join(","));
        command.args(["-filter_complex", &filter, "-map", "[v]", "-map", "[a]"]);
    } else {
        let color = safe_color(segment.color.as_deref(), "0x171a1e");
        command.args(["-f", "lavfi", "-t", &duration, "-i", &format!("color=c={color}:s={size}:r={fps:.6}")]);
        command.args(["-f", "lavfi", "-t", &duration, "-i", "anullsrc=r=48000:cl=stereo"]);
        let video_filter = "[0:v]format=yuv420p[v]";
        command.args(["-filter_complex", &video_filter, "-map", "[v]", "-map", "1:a"]);
    }
    command.args(["-t", &duration]);
    apply_video_encoder(&mut command, encoder);
    command.args(["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats"]).arg(output);
    run_export_command(command, &format!("渲染第 {} 个片段", index + 1), segment.duration_us, progress_start, progress_span, reporter, index + 1, plan.segments.len(), log_path)
}

fn render_overlays(ffmpeg: &Path, plan: &RenderPlan, input: &Path, output: &Path, job_dir: &Path, encoder: &str, reporter: &ExportReporter, progress_start: f64, progress_span: f64) -> Result<(), String> {
    if plan.overlays.is_empty() {
        fs::copy(input, output).map_err(|error| format!("无法写入导出文件: {error}"))?;
        reporter.emit("overlays", "无需合成视觉图层", progress_start + progress_span, plan.segments.len(), plan.segments.len())?;
        return Ok(());
    }
    let mut command = Command::new(ffmpeg);
    command.arg("-y").arg("-i").arg(input);
    let mut chain = String::new();
    for (index, overlay) in plan.overlays.iter().enumerate() {
        let is_image = overlay.kind.as_deref() == Some("image");
        let image_path = if is_image {
            ensure_source(overlay.image_path.as_deref().ok_or("贴图图层缺少源路径")?)?
        } else {
            let path = job_dir.join(format!("overlay-{index}.png"));
            let data = overlay.image_data_base64.as_deref().ok_or("文字动效缺少栅格图层")?;
            let image = BASE64.decode(data).map_err(|error| format!("动效图层数据无效: {error}"))?;
            fs::write(&path, image).map_err(|error| format!("无法写入动效图层: {error}"))?;
            path
        };
        let overlay_duration = seconds(overlay.duration_us.max(1));
        command.args(["-loop", "1", "-framerate", &format!("{:.6}", plan.fps.clamp(1.0, 120.0)), "-t", &overlay_duration, "-i"]).arg(&image_path);
        let input_label = if index == 0 { "0:v".into() } else { format!("v{}", index - 1) };
        let start = overlay.start_us as f64 / 1_000_000.0;
        let end = (overlay.start_us + overlay.duration_us) as f64 / 1_000_000.0;
        let speed = overlay.speed.unwrap_or(1.0).clamp(0.1, 4.0);
        let animation_duration = (0.45 / speed).min((overlay.duration_us as f64 / 2_000_000.0).max(0.001));
        let entrance = overlay.recipe.as_ref().map(|recipe| recipe.entrance.as_str()).unwrap_or("none");
        let keyframes = overlay.recipe.as_ref().and_then(|recipe| recipe.animation.as_ref());
        let source_label = format!("ovsrc{index}");
        let mut source_filters = Vec::new();
        if is_image {
            let width = overlay.target_width_px.unwrap_or(plan.width / 3).clamp(8, plan.width.saturating_mul(4).max(8));
            source_filters.push(format!("scale=w={width}:h=-1"));
            source_filters.push("format=rgba".into());
            source_filters.push(format!("colorchannelmixer=aa={:.6}", overlay.opacity.unwrap_or(1.0).clamp(0.0, 1.0)));
        } else {
            source_filters.push("format=rgba".into());
        }
        if let Some(animation) = keyframes {
            if let Some(factor) = keyframe_expression(animation, "scale", "t", speed) {
                source_filters.push(format!("scale=w='iw*({factor})':h='ih*({factor})':eval=frame"));
            }
            if let Some(rotation) = keyframe_expression(animation, "rotation", "t", speed) {
                let base_rotation = if is_image { overlay.rotation.unwrap_or(0.0).clamp(-360.0, 360.0) } else { 0.0 };
                let angle = format!("({base_rotation:.9}+({rotation}))*PI/180");
                source_filters.push(format!("rotate=a='{angle}':ow='sqrt(iw*iw+ih*ih)':oh='sqrt(iw*iw+ih*ih)':c=none"));
            }
        } else if is_image {
            let radians = overlay.rotation.unwrap_or(0.0).clamp(-360.0, 360.0).to_radians();
            if radians.abs() > 0.000_001 {
                source_filters.push(format!("rotate=a={radians:.9}:ow=rotw({radians:.9}):oh=roth({radians:.9}):c=none"));
            }
        }
        if keyframes.is_none() && entrance == "pop" {
            let first_stage = animation_duration * 0.7;
            let last_stage = animation_duration * 0.3;
            let factor = format!(
                "if(lt(t,{first_stage:.6}),0.45+0.70*t/{first_stage:.6},if(lt(t,{animation_duration:.6}),1.15-0.15*(t-{first_stage:.6})/{last_stage:.6},1))"
            );
            source_filters.push(format!("scale=w='iw*({factor})':h='ih*({factor})':eval=frame"));
        }
        if keyframes.is_none() && entrance != "none" {
            source_filters.push(format!("fade=t=in:st=0:d={animation_duration:.6}:alpha=1"));
        }
        source_filters.push(format!("setpts=PTS+{start:.6}/TB"));
        chain.push_str(&format!("[{}:v]{}[{source_label}];", index + 1, source_filters.join(",")));
        let progress = format!("min(max((t-{start:.6})/{animation_duration:.6},0),1)");
        let target_x = format!("main_w*{:.6}-overlay_w/2", (overlay.x / 100.0).clamp(0.0, 1.0));
        let target_y = format!("main_h*{:.6}-overlay_h/2", (overlay.y / 100.0).clamp(0.0, 1.0));
        let (x, y) = if let Some(animation) = keyframes {
            let local_time = format!("t-{start:.6}");
            let translate_x = keyframe_expression(animation, "translateX", &local_time, speed).unwrap_or_else(|| "0".into());
            let translate_y = keyframe_expression(animation, "translateY", &local_time, speed).unwrap_or_else(|| "0".into());
            (format!("{target_x}+overlay_w*({translate_x})/100"), format!("{target_y}+overlay_h*({translate_y})/100"))
        } else {
            (
                if entrance == "slide-left" { format!("{target_x}-overlay_w*0.15*(1-{progress})") } else { target_x },
                if entrance == "fade-up" { format!("{target_y}+overlay_h*0.25*(1-{progress})") } else { target_y },
            )
        };
        chain.push_str(&format!(
            "[{input_label}][{source_label}]overlay=x='{x}':y='{y}':enable='between(t,{start:.6},{end:.6})':eof_action=pass[v{index}];"
        ));
    }
    chain.pop();
    let final_label = format!("[v{}]", plan.overlays.len() - 1);
    let total_duration_us = plan.segments.iter().map(|segment| segment.duration_us).sum::<u64>();
    command.args(["-filter_complex", &chain, "-map", &final_label, "-map", "0:a?", "-t", &seconds(total_duration_us)]);
    apply_video_encoder(&mut command, encoder);
    command.args(["-c:a", "copy", "-shortest", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats"]).arg(output);
    run_export_command(command, "合成贴图、文字与动效", total_duration_us, progress_start, progress_span, reporter, plan.segments.len(), plan.segments.len(), &job_dir.join("overlay.log"))
}

fn combine_audio_labels(chains: &mut Vec<String>, labels: &[String], output: &str) -> Option<String> {
    if labels.is_empty() { return None; }
    if labels.len() == 1 { return Some(labels[0].clone()); }
    let inputs = labels.iter().map(|label| format!("[{label}]")).collect::<String>();
    chains.push(format!("{inputs}amix=inputs={}:normalize=0:duration=longest[{output}]", labels.len()));
    Some(output.into())
}

fn mix_audio(ffmpeg: &Path, plan: &RenderPlan, input: &Path, output: &Path, job_dir: &Path, reporter: &ExportReporter, progress_start: f64, progress_span: f64) -> Result<(), String> {
    if plan.audios.is_empty() {
        fs::copy(input, output).map_err(|error| format!("无法写入导出文件: {error}"))?;
        reporter.emit("audio", "无需混合额外音频", progress_start + progress_span, plan.segments.len(), plan.segments.len())?;
        return Ok(());
    }
    let mut command = Command::new(ffmpeg);
    command.arg("-y").arg("-i").arg(input);
    for audio in &plan.audios {
        command.args(["-ss", &seconds(audio.source_in_us), "-i"]).arg(ensure_source(&audio.path)?);
    }
    let mut chains = Vec::new();
    let mut voice_labels = Vec::new();
    let mut music_labels = Vec::new();
    let mut sound_labels = Vec::new();
    for (index, audio) in plan.audios.iter().enumerate() {
        let rate = audio.playback_rate.clamp(0.25, 4.0);
        let duration = audio.duration_us as f64 / 1_000_000.0;
        let source_duration = duration * rate;
        let fade_in = (audio.fade_in_us.min(audio.duration_us) as f64 / 1_000_000.0).min(duration);
        let fade_out = (audio.fade_out_us.min(audio.duration_us) as f64 / 1_000_000.0).min(duration);
        let mut filters = vec![
            format!("atrim=duration={source_duration:.6}"),
            "asetpts=PTS-STARTPTS".into(),
            atempo_chain(rate),
            format!("volume={:.4}", audio.volume.clamp(0.0, 2.0)),
        ];
        if fade_in > 0.0 { filters.push(format!("afade=t=in:st=0:d={fade_in:.6}")); }
        if fade_out > 0.0 { filters.push(format!("afade=t=out:st={:.6}:d={fade_out:.6}", (duration - fade_out).max(0.0))); }
        filters.push(format!("adelay={}:all=1", audio.start_us / 1_000));
        let label = format!("audio{index}");
        chains.push(format!("[{}:a]{}[{label}]", index + 1, filters.join(",")));
        match audio.role.as_str() {
            "voice" => voice_labels.push(label),
            "music" => music_labels.push(label),
            _ => sound_labels.push(label),
        }
    }
    let voice = combine_audio_labels(&mut chains, &voice_labels, "voicebase");
    let music = combine_audio_labels(&mut chains, &music_labels, "musicbase");
    let mut final_labels = vec!["0:a".to_string()];
    match (voice, music) {
        (Some(voice), Some(music)) => {
            chains.push(format!("[{voice}]asplit=2[voiceout][voicekey]"));
            chains.push(format!("[{music}][voicekey]sidechaincompress=threshold=0.035:ratio=8:attack=20:release=400[ducked]"));
            final_labels.extend(["voiceout".into(), "ducked".into()]);
        }
        (Some(voice), None) => final_labels.push(voice),
        (None, Some(music)) => final_labels.push(music),
        (None, None) => {}
    }
    final_labels.extend(sound_labels);
    let mix_inputs = final_labels.iter().map(|label| format!("[{label}]")).collect::<String>();
    chains.push(format!("{mix_inputs}amix=inputs={}:normalize=0:duration=longest,alimiter=limit=0.95[mix]", final_labels.len()));
    let total_duration_us = plan.segments.iter().map(|segment| segment.duration_us).sum::<u64>();
    command.args(["-filter_complex", &chains.join(";"), "-map", "0:v", "-map", "[mix]", "-t", &seconds(total_duration_us), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats"]).arg(output);
    run_export_command(command, "混合配音与音乐", total_duration_us, progress_start, progress_span, reporter, plan.segments.len(), plan.segments.len(), &job_dir.join("audio.log"))
}

fn execute_export(ffmpeg: &Path, plan: &RenderPlan, job_dir: &Path, output: &Path, reporter: &ExportReporter) -> Result<(), String> {
    let encoder = resolve_encoder(ffmpeg, plan.encoder.as_deref())?;
    reporter.emit("preparing", format!("使用 {encoder} 编码器"), 0.0, 0, plan.segments.len())?;
    let mut segment_paths = Vec::new();
    let segment_span = 0.65 / plan.segments.len().max(1) as f64;
    for (index, segment) in plan.segments.iter().enumerate() {
        let segment_path = job_dir.join(format!("segment-{index:05}.mp4"));
        render_segment(ffmpeg, plan, segment, &segment_path, index, &encoder, reporter, index as f64 * segment_span, segment_span, &job_dir.join(format!("segment-{index:05}.log")))?;
        segment_paths.push(segment_path);
    }
    let concat_list = job_dir.join("concat.txt");
    let concat_text = segment_paths.iter().map(|path| format!("file '{}'", path.to_string_lossy().replace('\'', "'\\''"))).collect::<Vec<_>>().join("\n");
    fs::write(&concat_list, concat_text).map_err(|error| format!("无法创建合并清单: {error}"))?;
    let base = job_dir.join("base.mp4");
    let mut concat = Command::new(ffmpeg);
    concat.args(["-y", "-f", "concat", "-safe", "0", "-i"]).arg(&concat_list).args(["-c", "copy", "-progress", "pipe:1", "-nostats"]).arg(&base);
    let total_duration_us = plan.segments.iter().map(|segment| segment.duration_us).sum::<u64>();
    run_export_command(concat, "合并视频片段", total_duration_us, 0.65, 0.07, reporter, plan.segments.len(), plan.segments.len(), &job_dir.join("concat.log"))?;
    let visual = job_dir.join("visual.mp4");
    render_overlays(ffmpeg, plan, &base, &visual, job_dir, &encoder, reporter, 0.72, 0.18)?;
    mix_audio(ffmpeg, plan, &visual, output, job_dir, reporter, 0.90, 0.10)?;
    reporter.emit("complete", "视频渲染完成", 1.0, plan.segments.len(), plan.segments.len())
}

#[tauri::command]
pub async fn export_render_plan(app: AppHandle, state: State<'_, ExportManagerState>, plan: RenderPlan, job_id: String, on_event: Channel<ExportJobEvent>) -> Result<String, String> {
    if plan.width == 0 || plan.height == 0 || plan.width > 7680 || plan.height > 4320 { return Err("导出画布尺寸无效".into()); }
    if plan.segments.is_empty() { return Err("时间线上没有可导出的内容".into()); }
    let ffmpeg = require_command(&app, "ffmpeg")?;
    let output = PathBuf::from(&plan.output_path);
    if let Some(parent) = output.parent() { fs::create_dir_all(parent).map_err(|error| format!("无法创建导出目录: {error}"))?; }
    let job_dir = unique_job_dir(&app)?;
    let rendered = job_dir.join("result.mp4");
    let cancelled = state.begin(&job_id)?;
    let reporter = ExportReporter { job_id: job_id.clone(), channel: Some(on_event), cancelled: cancelled.clone() };
    let render_job_dir = job_dir.clone();
    let render_result = tauri::async_runtime::spawn_blocking(move || execute_export(&ffmpeg, &plan, &render_job_dir, &rendered, &reporter).map(|_| rendered)).await;
    let result = match render_result {
        Ok(result) => result.and_then(|rendered| {
            if cancelled.load(Ordering::Relaxed) { return Err("视频导出已取消".into()); }
            fs::copy(rendered, &output).map_err(|error| format!("无法写入导出文件: {error}"))?;
            Ok(output.to_string_lossy().into_owned())
        }),
        Err(error) => Err(format!("导出任务异常结束: {error}")),
    };
    state.finish(&job_id);
    let _ = fs::remove_dir_all(job_dir);
    result
}

#[tauri::command]
pub fn cancel_export_job(state: State<'_, ExportManagerState>, job_id: String) -> bool {
    state.jobs.lock().ok().and_then(|jobs| jobs.get(&job_id).cloned()).map(|cancelled| {
        cancelled.store(true, Ordering::Relaxed);
        true
    }).unwrap_or(false)
}

#[tauri::command]
pub fn save_project_file(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|error| format!("无法创建工程目录: {error}"))?; }
    fs::write(path, contents).map_err(|error| format!("保存工程失败: {error}"))
}

#[tauri::command]
pub fn read_project_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| format!("打开工程失败: {error}"))
}

#[tauri::command]
pub fn media_path_exists(path: String) -> bool {
    Path::new(&path).is_file()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_generated_video_with_png_overlay_when_ffmpeg_is_available() {
        let ffmpeg = [PathBuf::from("/opt/homebrew/bin/ffmpeg"), PathBuf::from("ffmpeg")]
            .into_iter().find(|candidate| Command::new(candidate).arg("-version").output().is_ok());
        let Some(ffmpeg) = ffmpeg else { return };
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let job_dir = env::temp_dir().join(format!("bvideo-media-test-{stamp}"));
        fs::create_dir_all(&job_dir).unwrap();
        let output = job_dir.join("result.mp4");
        let fixture = job_dir.join("fixture.png");
        let fixture_status = Command::new(&ffmpeg).args(["-y", "-f", "lavfi", "-i", "color=c=red@0.8:s=16x16", "-frames:v", "1"]).arg(&fixture).output().unwrap();
        assert!(fixture_status.status.success());
        let source = job_dir.join("source.mp4");
        let source_status = Command::new(&ffmpeg).args(["-y", "-f", "lavfi", "-i", "testsrc2=s=160x90:r=24:d=0.5", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5", "-c:v", "libx264", "-c:a", "aac", "-shortest"]).arg(&source).output().unwrap();
        assert!(source_status.status.success());
        let voice = job_dir.join("voice.wav");
        let music = job_dir.join("music.wav");
        assert!(Command::new(&ffmpeg).args(["-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=0.5", "-c:a", "pcm_s16le"]).arg(&voice).output().unwrap().status.success());
        assert!(Command::new(&ffmpeg).args(["-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=1", "-c:a", "pcm_s16le"]).arg(&music).output().unwrap().status.success());
        let plan = RenderPlan {
            width: 320,
            height: 180,
            fps: 24.0,
            output_path: output.to_string_lossy().into_owned(),
            encoder: Some("software".into()),
            segments: vec![
                RenderSegment { kind: "generated".into(), duration_us: 500_000, path: None, source_in_us: None, playback_rate: None, volume: None, fit: None, has_audio: None, loop_media: None, camera: None, camera_offset_us: None, camera_duration_us: None, color: Some("#171a1e".into()) },
                RenderSegment { kind: "video".into(), duration_us: 500_000, path: Some(source.to_string_lossy().into_owned()), source_in_us: Some(0), playback_rate: Some(1.0), volume: Some(0.8), fit: Some("cover".into()), has_audio: Some(true), loop_media: None, camera: Some(RenderCameraMotion { start_scale: 1.0, end_scale: 1.2, start_x: 0.0, end_x: 0.0, start_y: 0.0, end_y: 0.0, easing: "ease-in-out".into() }), camera_offset_us: Some(0), camera_duration_us: Some(500_000), color: None },
            ],
            overlays: vec![RenderOverlay {
                kind: Some("text".into()),
                start_us: 0,
                duration_us: 1_000_000,
                x: 25.0,
                y: 50.0,
                opacity: Some(1.0),
                rotation: Some(0.0),
                speed: Some(1.0),
                recipe: Some(RenderEffectRecipe {
                    entrance: "none".into(),
                    animation: Some(RenderEffectAnimation {
                        duration_seconds: 0.45,
                        easing: "ease-out".into(),
                        keyframes: vec![
                            RenderEffectKeyframe { offset: 0.0, translate_x: -120.0, translate_y: 0.0, scale: 0.1, rotation: -10.0 },
                            RenderEffectKeyframe { offset: 0.7, translate_x: 4.0, translate_y: 0.0, scale: 1.08, rotation: 2.0 },
                            RenderEffectKeyframe { offset: 1.0, translate_x: 0.0, translate_y: 0.0, scale: 1.0, rotation: 0.0 },
                        ],
                    }),
                }),
                image_data_base64: Some(BASE64.encode(fs::read(&fixture).unwrap())),
                image_path: None,
                target_width_px: None,
            }, RenderOverlay {
                kind: Some("text".into()),
                start_us: 0,
                duration_us: 1_000_000,
                x: 50.0,
                y: 50.0,
                opacity: Some(1.0),
                rotation: Some(0.0),
                speed: Some(1.0),
                recipe: Some(RenderEffectRecipe {
                    entrance: "fade-up".into(),
                    animation: None,
                }),
                image_data_base64: Some(BASE64.encode(fs::read(&fixture).unwrap())),
                image_path: None,
                target_width_px: None,
            }, RenderOverlay {
                kind: Some("image".into()),
                start_us: 0,
                duration_us: 1_000_000,
                x: 75.0,
                y: 50.0,
                opacity: Some(0.8),
                rotation: Some(12.0),
                speed: Some(1.0),
                recipe: Some(RenderEffectRecipe {
                    entrance: "pop".into(),
                    animation: None,
                }),
                image_data_base64: None,
                image_path: Some(fixture.to_string_lossy().into_owned()),
                target_width_px: Some(32),
            }],
            audios: vec![
                RenderAudioClip { path: voice.to_string_lossy().into_owned(), start_us: 200_000, duration_us: 500_000, source_in_us: 0, playback_rate: 1.0, volume: 1.0, fade_in_us: 50_000, fade_out_us: 50_000, role: "voice".into() },
                RenderAudioClip { path: music.to_string_lossy().into_owned(), start_us: 0, duration_us: 1_000_000, source_in_us: 0, playback_rate: 1.0, volume: 0.5, fade_in_us: 100_000, fade_out_us: 100_000, role: "music".into() },
            ],
        };
        let result = execute_export(&ffmpeg, &plan, &job_dir, &output, &ExportReporter::silent());
        assert!(result.is_ok(), "{}", result.unwrap_err());
        assert!(fs::metadata(&output).unwrap().len() > 1_000);
        let red_energy = |timestamp: &str| {
            let frame = Command::new(&ffmpeg)
                .args(["-v", "error", "-ss", timestamp, "-i"])
                .arg(&output)
                .args(["-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"])
                .output()
                .unwrap();
            assert!(frame.status.success());
            frame.stdout.chunks_exact(3).map(|pixel| pixel[0].saturating_sub(pixel[1]) as u64).sum::<u64>()
        };
        assert!(red_energy("0.400") > red_energy("0.020") * 3, "overlay entrance should change exported frames");
        let _ = fs::remove_dir_all(job_dir);
    }

    #[test]
    fn generates_a_low_resolution_proxy_when_ffmpeg_is_available() {
        let ffmpeg = [PathBuf::from("/opt/homebrew/bin/ffmpeg"), PathBuf::from("ffmpeg")]
            .into_iter().find(|candidate| Command::new(candidate).arg("-version").output().is_ok());
        let Some(ffmpeg) = ffmpeg else { return };
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let job_dir = env::temp_dir().join(format!("bvideo-proxy-test-{stamp}"));
        fs::create_dir_all(&job_dir).unwrap();
        let source = job_dir.join("source.mp4");
        assert!(Command::new(&ffmpeg).args(["-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=24:d=0.3", "-c:v", "libx264", "-pix_fmt", "yuv420p"]).arg(&source).output().unwrap().status.success());
        let output = job_dir.join("proxy.mp4");
        let cancelled = AtomicBool::new(false);
        generate_proxy_blocking(&ffmpeg, &source, &output, 180, 300_000, "proxy-test", &cancelled, None, &job_dir.join("proxy.log")).unwrap();
        assert!(fs::metadata(&output).unwrap().len() > 1_000);
        let ffprobe = if ffmpeg.file_name().and_then(|value| value.to_str()) == Some("ffmpeg") { ffmpeg.with_file_name("ffprobe") } else { PathBuf::from("ffprobe") };
        let probe = Command::new(ffprobe).args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0"]).arg(&output).output().unwrap();
        assert!(probe.status.success());
        assert_eq!(String::from_utf8_lossy(&probe.stdout).trim(), "180");
        let _ = fs::remove_dir_all(job_dir);
    }

    #[test]
    fn extracts_a_persistent_audio_file_with_ffmpeg_when_available() {
        let ffmpeg = [PathBuf::from("/opt/homebrew/bin/ffmpeg"), PathBuf::from("ffmpeg")]
            .into_iter().find(|candidate| Command::new(candidate).arg("-version").output().is_ok());
        let Some(ffmpeg) = ffmpeg else { return };
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let job_dir = env::temp_dir().join(format!("bvideo-audio-extract-test-{stamp}"));
        fs::create_dir_all(&job_dir).unwrap();
        let source = job_dir.join("source.mp4");
        assert!(Command::new(&ffmpeg).args(["-y", "-f", "lavfi", "-i", "testsrc2=s=160x90:r=24:d=0.5", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5", "-c:v", "libx264", "-c:a", "aac", "-shortest"]).arg(&source).output().unwrap().status.success());
        let output = job_dir.join("extracted.m4a");
        let cancelled = AtomicBool::new(false);
        extract_audio_blocking(&ffmpeg, &source, &output, 500_000, "audio-test", &cancelled, None, &job_dir.join("extract.log")).unwrap();
        assert!(fs::metadata(&output).unwrap().len() > 1_000);
        let ffprobe = ffmpeg.with_file_name(if cfg!(target_os = "windows") { "ffprobe.exe" } else { "ffprobe" });
        let probe = Command::new(ffprobe).args(["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0"]).arg(&output).output().unwrap();
        assert!(probe.status.success());
        assert_eq!(String::from_utf8_lossy(&probe.stdout).trim(), "audio");
        let _ = fs::remove_dir_all(job_dir);
    }
}
