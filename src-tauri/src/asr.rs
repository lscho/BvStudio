use futures_util::StreamExt;
use reqwest::{header, Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    env, fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, AppHandle, Manager, State};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrConfig {
    python_path: String,
    model_path: String,
    aligner_path: Option<String>,
    language: Option<String>,
    device: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrSegment {
    start_seconds: f64,
    end_seconds: f64,
    text: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrTranscript {
    language: String,
    text: String,
    segments: Vec<AsrSegment>,
    device: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrRuntimeStatus {
    ready: bool,
    message: String,
}

#[derive(Clone, Copy)]
struct ModelSpec {
    repository: &'static str,
    name: &'static str,
    kind: &'static str,
    recommended: bool,
}

const MODEL_SPECS: [ModelSpec; 3] = [
    ModelSpec {
        repository: "Qwen/Qwen3-ASR-0.6B",
        name: "Qwen3-ASR 0.6B",
        kind: "asr",
        recommended: true,
    },
    ModelSpec {
        repository: "Qwen/Qwen3-ASR-1.7B",
        name: "Qwen3-ASR 1.7B",
        kind: "asr",
        recommended: false,
    },
    ModelSpec {
        repository: "Qwen/Qwen3-ForcedAligner-0.6B",
        name: "Qwen3 Forced Aligner 0.6B",
        kind: "aligner",
        recommended: true,
    },
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrModelInfo {
    repository: String,
    name: String,
    kind: String,
    recommended: bool,
    installed: bool,
    path: String,
    installed_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrJobEvent {
    job_id: String,
    phase: String,
    message: String,
    downloaded_bytes: u64,
    total_bytes: u64,
    files_completed: usize,
    files_total: usize,
    current_file: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrTranscriptionEvent {
    job_id: String,
    phase: String,
    message: String,
    progress: f64,
}

#[derive(Deserialize)]
struct WorkerProgress {
    phase: String,
    message: String,
    progress: f64,
}

#[derive(Default)]
pub struct AsrManagerState {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl AsrManagerState {
    fn begin(&self, job_id: &str) -> Result<Arc<AtomicBool>, String> {
        if job_id.trim().is_empty() {
            return Err("任务 ID 不能为空".into());
        }
        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| "ASR 任务状态不可用".to_string())?;
        if jobs.contains_key(job_id) {
            return Err("任务已经在运行".into());
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        jobs.insert(job_id.to_string(), cancelled.clone());
        Ok(cancelled)
    }

    fn finish(&self, job_id: &str) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.remove(job_id);
        }
    }
}

#[derive(Deserialize)]
struct HfModelInfo {
    #[serde(default)]
    siblings: Vec<HfSibling>,
}

#[derive(Deserialize)]
struct HfSibling {
    rfilename: String,
    size: Option<u64>,
    lfs: Option<HfLfs>,
}

#[derive(Deserialize)]
struct HfLfs {
    size: u64,
    sha256: Option<String>,
}

impl HfSibling {
    fn expected_size(&self) -> u64 {
        self.lfs
            .as_ref()
            .map(|value| value.size)
            .or(self.size)
            .unwrap_or(0)
    }
    fn expected_sha256(&self) -> Option<&str> {
        self.lfs.as_ref().and_then(|value| value.sha256.as_deref())
    }
}

fn worker_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(path) = env::var_os("BVIDEO_QWEN_ASR_WORKER")
        .map(PathBuf::from)
        .filter(|path| path.is_file())
    {
        return Ok(path);
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path = resource_dir.join("scripts").join("qwen3_asr_worker.py");
        if path.is_file() {
            return Ok(path);
        }
    }
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("scripts")
        .join("qwen3_asr_worker.py");
    if development.is_file() {
        return Ok(development);
    }
    Err("未找到 Qwen3-ASR 本地 worker".into())
}

fn check_python(python_path: &str) -> Result<(), String> {
    let output = Command::new(python_path)
        .args(["-c", "import qwen_asr, torch"])
        .output()
        .map_err(|error| format!("无法启动 Python: {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err("Python 环境缺少 qwen-asr 或 torch，请先安装本地 ASR 运行环境".into())
    }
}

fn model_spec(repository: &str) -> Result<ModelSpec, String> {
    MODEL_SPECS
        .iter()
        .copied()
        .find(|spec| spec.repository == repository)
        .ok_or_else(|| "不支持此模型仓库".into())
}

fn asr_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("asr"))
}

fn model_directory(app: &AppHandle, repository: &str) -> Result<PathBuf, String> {
    model_spec(repository)?;
    Ok(asr_root(app)?
        .join("models")
        .join(repository.replace('/', "--")))
}

fn directory_size(path: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                directory_size(&path)
            } else {
                entry.metadata().map(|value| value.len()).unwrap_or(0)
            }
        })
        .sum()
}

fn model_installed(path: &Path) -> bool {
    path.join(".bvideo-model.json").is_file() && path.join("config.json").is_file()
}

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if value.trim().is_empty() || path.is_absolute() {
        return Err("模型文件路径无效".into());
    }
    if path
        .components()
        .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("模型文件路径包含不安全的目录".into());
    }
    Ok(path.to_path_buf())
}

fn hf_endpoint() -> Result<Url, String> {
    let endpoint =
        env::var("BVIDEO_HF_ENDPOINT").unwrap_or_else(|_| "https://huggingface.co".into());
    let url = Url::parse(&format!("{}/", endpoint.trim_end_matches('/')))
        .map_err(|_| "模型下载地址无效".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("模型下载地址只支持 HTTP 或 HTTPS".into());
    }
    Ok(url)
}

fn repository_url(repository: &str, api: bool, filename: Option<&str>) -> Result<Url, String> {
    model_spec(repository)?;
    let mut url = hf_endpoint()?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| "模型下载地址无效".to_string())?;
        if api {
            segments.extend(["api", "models"]);
        }
        for part in repository.split('/') {
            segments.push(part);
        }
        if api {
            segments.extend(["revision", "main"]);
        } else {
            segments.extend(["resolve", "main"]);
            if let Some(filename) = filename {
                for part in safe_relative_path(filename)?.components() {
                    if let Component::Normal(value) = part {
                        segments.push(&value.to_string_lossy());
                    }
                }
            }
        }
    }
    if api {
        url.query_pairs_mut().append_pair("blobs", "true");
    } else {
        url.query_pairs_mut().append_pair("download", "true");
    }
    Ok(url)
}

fn emit_job(channel: &Channel<AsrJobEvent>, event: AsrJobEvent) -> Result<(), String> {
    channel
        .send(event)
        .map_err(|error| format!("无法上报 ASR 任务进度: {error}"))
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| format!("无法校验模型文件: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("无法校验模型文件: {error}"))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

async fn download_model_files(
    app: &AppHandle,
    repository: &str,
    job_id: &str,
    cancelled: &AtomicBool,
    channel: &Channel<AsrJobEvent>,
) -> Result<PathBuf, String> {
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| error.to_string())?;
    emit_job(
        channel,
        AsrJobEvent {
            job_id: job_id.into(),
            phase: "manifest".into(),
            message: "正在读取模型文件清单".into(),
            downloaded_bytes: 0,
            total_bytes: 0,
            files_completed: 0,
            files_total: 0,
            current_file: None,
        },
    )?;
    let manifest = client
        .get(repository_url(repository, true, None)?)
        .send()
        .await
        .map_err(|error| format!("无法读取模型清单: {error}"))?
        .error_for_status()
        .map_err(|error| format!("模型清单请求失败: {error}"))?
        .json::<HfModelInfo>()
        .await
        .map_err(|error| format!("模型清单格式无效: {error}"))?;
    let files = manifest
        .siblings
        .into_iter()
        .filter(|file| file.rfilename != ".gitattributes")
        .collect::<Vec<_>>();
    if files.is_empty() {
        return Err("模型仓库没有可下载的文件".into());
    }
    let total_bytes = files.iter().map(HfSibling::expected_size).sum::<u64>();
    let target = model_directory(app, repository)?;
    fs::create_dir_all(&target).map_err(|error| format!("无法创建模型目录: {error}"))?;
    let mut downloaded_bytes = 0_u64;
    let mut files_completed = 0_usize;
    for file in &files {
        if cancelled.load(Ordering::Relaxed) {
            return Err("模型下载已取消，可稍后继续".into());
        }
        let relative = safe_relative_path(&file.rfilename)?;
        let destination = target.join(&relative);
        let partial = destination.with_extension(format!(
            "{}part",
            destination
                .extension()
                .map(|value| format!("{}.", value.to_string_lossy()))
                .unwrap_or_default()
        ));
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("无法创建模型子目录: {error}"))?;
        }
        let expected_size = file.expected_size();
        if destination.is_file() {
            let size_matches = expected_size == 0
                || fs::metadata(&destination)
                    .map(|value| value.len())
                    .unwrap_or(0)
                    == expected_size;
            let hash_matches = if size_matches {
                file.expected_sha256()
                    .map(|expected| {
                        file_sha256(&destination)
                            .map(|actual| actual == expected.to_ascii_lowercase())
                    })
                    .transpose()?
                    .unwrap_or(true)
            } else {
                false
            };
            if size_matches && hash_matches {
                downloaded_bytes = downloaded_bytes.saturating_add(expected_size);
                files_completed += 1;
                continue;
            }
            fs::remove_file(&destination)
                .map_err(|error| format!("无法替换损坏的模型文件: {error}"))?;
        }
        let mut existing = fs::metadata(&partial).map(|value| value.len()).unwrap_or(0);
        if expected_size > 0 && existing > expected_size {
            fs::remove_file(&partial)
                .map_err(|error| format!("无法重置损坏的断点文件: {error}"))?;
            existing = 0;
        }
        downloaded_bytes = downloaded_bytes.saturating_add(existing);
        let mut request = client.get(repository_url(repository, false, Some(&file.rfilename))?);
        if existing > 0 {
            request = request.header(header::RANGE, format!("bytes={existing}-"));
        }
        let response = request
            .send()
            .await
            .map_err(|error| format!("下载 {} 失败: {error}", file.rfilename))?;
        if response.status() == StatusCode::RANGE_NOT_SATISFIABLE
            && expected_size > 0
            && existing == expected_size
        {
            fs::rename(&partial, &destination)
                .map_err(|error| format!("无法完成模型文件: {error}"))?;
            files_completed += 1;
            continue;
        }
        let append = existing > 0 && response.status() == StatusCode::PARTIAL_CONTENT;
        let response = response
            .error_for_status()
            .map_err(|error| format!("下载 {} 失败: {error}", file.rfilename))?;
        if existing > 0 && !append {
            downloaded_bytes = downloaded_bytes.saturating_sub(existing);
        }
        let mut output = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .append(append)
            .truncate(!append)
            .open(&partial)
            .map_err(|error| format!("无法写入模型文件: {error}"))?;
        let mut stream = response.bytes_stream();
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        while let Some(chunk) = stream.next().await {
            if cancelled.load(Ordering::Relaxed) {
                return Err("模型下载已取消，可稍后继续".into());
            }
            let chunk = chunk.map_err(|error| format!("下载 {} 中断: {error}", file.rfilename))?;
            output
                .write_all(&chunk)
                .map_err(|error| format!("无法写入模型文件: {error}"))?;
            downloaded_bytes = downloaded_bytes.saturating_add(chunk.len() as u64);
            if last_emit.elapsed() >= Duration::from_millis(120) {
                emit_job(
                    channel,
                    AsrJobEvent {
                        job_id: job_id.into(),
                        phase: "downloading".into(),
                        message: format!("正在下载 {}", file.rfilename),
                        downloaded_bytes,
                        total_bytes,
                        files_completed,
                        files_total: files.len(),
                        current_file: Some(file.rfilename.clone()),
                    },
                )?;
                last_emit = Instant::now();
            }
        }
        output
            .flush()
            .map_err(|error| format!("无法完成模型文件: {error}"))?;
        if expected_size > 0
            && fs::metadata(&partial).map(|value| value.len()).unwrap_or(0) != expected_size
        {
            return Err(format!("模型文件 {} 大小校验失败", file.rfilename));
        }
        if let Some(expected_hash) = file.expected_sha256() {
            emit_job(
                channel,
                AsrJobEvent {
                    job_id: job_id.into(),
                    phase: "verifying".into(),
                    message: format!("正在校验 {}", file.rfilename),
                    downloaded_bytes,
                    total_bytes,
                    files_completed,
                    files_total: files.len(),
                    current_file: Some(file.rfilename.clone()),
                },
            )?;
            if file_sha256(&partial)? != expected_hash.to_ascii_lowercase() {
                return Err(format!("模型文件 {} SHA-256 校验失败", file.rfilename));
            }
        }
        fs::rename(&partial, &destination).map_err(|error| format!("无法完成模型文件: {error}"))?;
        files_completed += 1;
    }
    fs::write(
        target.join(".bvideo-model.json"),
        serde_json::to_vec_pretty(
            &serde_json::json!({ "repository": repository, "revision": "main" }),
        )
        .map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("无法写入模型安装记录: {error}"))?;
    emit_job(
        channel,
        AsrJobEvent {
            job_id: job_id.into(),
            phase: "ready".into(),
            message: "模型安装完成".into(),
            downloaded_bytes: total_bytes.max(downloaded_bytes),
            total_bytes,
            files_completed: files.len(),
            files_total: files.len(),
            current_file: None,
        },
    )?;
    Ok(target)
}

async fn run_managed_child(
    command: &mut Command,
    cancelled: &AtomicBool,
    operation: &str,
) -> Result<(), String> {
    command.stdout(Stdio::null()).stderr(Stdio::null());
    let mut child = command
        .spawn()
        .map_err(|error| format!("{operation}启动失败: {error}"))?;
    loop {
        if cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("{operation}已取消"));
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("{operation}状态读取失败: {error}"))?
        {
            return status
                .success()
                .then_some(())
                .ok_or_else(|| format!("{operation}失败，请检查网络和 Python 版本"));
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

fn runtime_python(runtime_dir: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        runtime_dir.join("Scripts").join("python.exe")
    } else {
        runtime_dir.join("bin").join("python")
    }
}

#[tauri::command]
pub fn asr_runtime_status(python_path: String) -> AsrRuntimeStatus {
    match check_python(&python_path) {
        Ok(()) => AsrRuntimeStatus {
            ready: true,
            message: "Qwen3-ASR 本地环境可用".into(),
        },
        Err(message) => AsrRuntimeStatus {
            ready: false,
            message,
        },
    }
}

#[tauri::command]
pub fn asr_model_catalog(app: AppHandle) -> Result<Vec<AsrModelInfo>, String> {
    MODEL_SPECS
        .iter()
        .map(|spec| {
            let path = model_directory(&app, spec.repository)?;
            Ok(AsrModelInfo {
                repository: spec.repository.into(),
                name: spec.name.into(),
                kind: spec.kind.into(),
                recommended: spec.recommended,
                installed: model_installed(&path),
                installed_bytes: directory_size(&path),
                path: path.to_string_lossy().into_owned(),
            })
        })
        .collect()
}

#[tauri::command]
pub async fn download_asr_model(
    app: AppHandle,
    state: State<'_, AsrManagerState>,
    repository: String,
    job_id: String,
    on_event: Channel<AsrJobEvent>,
) -> Result<String, String> {
    model_spec(&repository)?;
    let cancelled = state.begin(&job_id)?;
    let result = download_model_files(&app, &repository, &job_id, &cancelled, &on_event)
        .await
        .map(|path| path.to_string_lossy().into_owned());
    state.finish(&job_id);
    result
}

#[tauri::command]
pub async fn install_asr_runtime(
    app: AppHandle,
    state: State<'_, AsrManagerState>,
    python_path: String,
    job_id: String,
    on_event: Channel<AsrJobEvent>,
) -> Result<String, String> {
    let cancelled = state.begin(&job_id)?;
    let runtime_dir = asr_root(&app)?.join("runtime");
    let managed_python = runtime_python(&runtime_dir);
    let result = async {
        fs::create_dir_all(asr_root(&app)?)
            .map_err(|error| format!("无法创建 ASR 运行时目录: {error}"))?;
        if !managed_python.is_file() {
            emit_job(
                &on_event,
                AsrJobEvent {
                    job_id: job_id.clone(),
                    phase: "runtime".into(),
                    message: "正在创建隔离的 Python 环境".into(),
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    files_completed: 0,
                    files_total: 3,
                    current_file: None,
                },
            )?;
            let mut command = Command::new(python_path.trim());
            command.args(["-m", "venv"]).arg(&runtime_dir);
            run_managed_child(&mut command, &cancelled, "创建 Python 环境").await?;
        }
        emit_job(
            &on_event,
            AsrJobEvent {
                job_id: job_id.clone(),
                phase: "runtime".into(),
                message: "正在更新 pip".into(),
                downloaded_bytes: 0,
                total_bytes: 0,
                files_completed: 1,
                files_total: 3,
                current_file: None,
            },
        )?;
        let mut pip = Command::new(&managed_python);
        pip.args([
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--progress-bar",
            "off",
            "--upgrade",
            "pip",
        ]);
        run_managed_child(&mut pip, &cancelled, "更新 pip").await?;
        emit_job(
            &on_event,
            AsrJobEvent {
                job_id: job_id.clone(),
                phase: "runtime".into(),
                message: "正在安装 qwen-asr 与 PyTorch".into(),
                downloaded_bytes: 0,
                total_bytes: 0,
                files_completed: 2,
                files_total: 3,
                current_file: None,
            },
        )?;
        let mut install = Command::new(&managed_python);
        install.args([
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--progress-bar",
            "off",
            "--upgrade",
            "qwen-asr>=0.0.6,<0.1",
            "torch",
        ]);
        run_managed_child(&mut install, &cancelled, "安装 ASR 依赖").await?;
        check_python(managed_python.to_string_lossy().as_ref())?;
        emit_job(
            &on_event,
            AsrJobEvent {
                job_id: job_id.clone(),
                phase: "ready".into(),
                message: "本地 ASR 运行时安装完成".into(),
                downloaded_bytes: 0,
                total_bytes: 0,
                files_completed: 3,
                files_total: 3,
                current_file: None,
            },
        )?;
        Ok(managed_python.to_string_lossy().into_owned())
    }
    .await;
    state.finish(&job_id);
    result
}

#[tauri::command]
pub fn cancel_asr_job(state: State<'_, AsrManagerState>, job_id: String) -> bool {
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

#[tauri::command]
pub fn remove_asr_model(app: AppHandle, repository: String) -> Result<(), String> {
    let path = model_directory(&app, &repository)?;
    if path.exists() {
        fs::remove_dir_all(path).map_err(|error| format!("无法删除模型: {error}"))?;
    }
    Ok(())
}

fn canonical_file(path: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(path).map_err(|error| format!("无法访问视频: {error}"))?;
    path.is_file()
        .then_some(path)
        .ok_or_else(|| "视频路径不是文件".into())
}

fn emit_transcription(
    channel: &Channel<AsrTranscriptionEvent>,
    job_id: &str,
    phase: &str,
    message: impl Into<String>,
    progress: f64,
) -> Result<(), String> {
    channel
        .send(AsrTranscriptionEvent {
            job_id: job_id.into(),
            phase: phase.into(),
            message: message.into(),
            progress: progress.clamp(0.0, 1.0),
        })
        .map_err(|error| format!("无法上报字幕识别进度: {error}"))
}

fn process_error(operation: &str, log_path: &Path) -> String {
    let contents = fs::read_to_string(log_path).unwrap_or_default();
    let details = contents
        .lines()
        .rev()
        .take(16)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");
    if details.trim().is_empty() {
        format!("{operation}失败")
    } else {
        format!("{operation}失败: {details}")
    }
}

async fn run_transcription_child(
    command: &mut Command,
    operation: &str,
    log_path: &Path,
    progress_path: Option<&Path>,
    job_id: &str,
    cancelled: &AtomicBool,
    channel: &Channel<AsrTranscriptionEvent>,
) -> Result<(), String> {
    let log = fs::File::create(log_path).map_err(|error| format!("无法创建 ASR 日志: {error}"))?;
    command.stdout(Stdio::null()).stderr(Stdio::from(log));
    let mut child = command
        .spawn()
        .map_err(|error| format!("{operation}启动失败: {error}"))?;
    let mut previous_progress = String::new();
    loop {
        if cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("本地字幕识别已取消".into());
        }
        if let Some(path) = progress_path {
            if let Ok(contents) = fs::read_to_string(path) {
                if contents != previous_progress {
                    if let Ok(progress) = serde_json::from_str::<WorkerProgress>(&contents) {
                        emit_transcription(
                            channel,
                            job_id,
                            &progress.phase,
                            progress.message,
                            progress.progress,
                        )?;
                        previous_progress = contents;
                    }
                }
            }
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("{operation}状态读取失败: {error}"))?
        {
            return status
                .success()
                .then_some(())
                .ok_or_else(|| process_error(operation, log_path));
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
}

#[tauri::command]
pub async fn transcribe_media(
    app: AppHandle,
    state: State<'_, AsrManagerState>,
    path: String,
    config: AsrConfig,
    job_id: String,
    on_event: Channel<AsrTranscriptionEvent>,
) -> Result<AsrTranscript, String> {
    if config.model_path.trim().is_empty() {
        return Err("请先配置 Qwen3-ASR 模型路径".into());
    }
    let source = canonical_file(&path)?;
    let ffmpeg = crate::media::require_command(&app, "ffmpeg")?;
    let worker = worker_path(&app)?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let job_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("asr")
        .join(format!("job-{stamp}"));
    fs::create_dir_all(&job_dir).map_err(|error| format!("无法创建 ASR 缓存: {error}"))?;
    let cancelled = state.begin(&job_id)?;
    let audio_path = job_dir.join("audio.wav");
    let transcript_path = job_dir.join("transcript.json");
    let progress_path = job_dir.join("progress.json");
    let extraction_log = job_dir.join("extract.log");
    let worker_log = job_dir.join("worker.log");
    let result = async {
        emit_transcription(
            &on_event,
            &job_id,
            "extracting",
            "正在从素材提取本地音频",
            0.04,
        )?;
        let mut extraction = Command::new(ffmpeg);
        extraction
            .args(["-y", "-i"])
            .arg(&source)
            .args(["-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"])
            .arg(&audio_path);
        run_transcription_child(
            &mut extraction,
            "音频提取",
            &extraction_log,
            None,
            &job_id,
            &cancelled,
            &on_event,
        )
        .await?;
        emit_transcription(&on_event, &job_id, "runtime", "正在启动本地 Qwen3-ASR", 0.2)?;
        let mut command = Command::new(&config.python_path);
        command.arg(&worker).args([
            "--audio",
            audio_path.to_string_lossy().as_ref(),
            "--model",
            config.model_path.trim(),
            "--output",
            transcript_path.to_string_lossy().as_ref(),
            "--progress",
            progress_path.to_string_lossy().as_ref(),
        ]);
        if let Some(aligner) = config
            .aligner_path
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            command.args(["--aligner", aligner.trim()]);
        }
        if let Some(language) = config
            .language
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            command.args(["--language", language.trim()]);
        }
        if let Some(device) = config
            .device
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            command.args(["--device", device.trim()]);
        }
        run_transcription_child(
            &mut command,
            "Qwen3-ASR 识别",
            &worker_log,
            Some(&progress_path),
            &job_id,
            &cancelled,
            &on_event,
        )
        .await?;
        let contents = fs::read_to_string(&transcript_path)
            .map_err(|error| format!("无法读取识别结果: {error}"))?;
        let transcript = serde_json::from_str(&contents)
            .map_err(|error| format!("识别结果格式无效: {error}"))?;
        emit_transcription(&on_event, &job_id, "ready", "本地字幕识别完成", 1.0)?;
        Ok(transcript)
    }
    .await;
    let _ = fs::remove_dir_all(job_dir);
    state.finish(&job_id);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_model_paths_and_hugging_face_urls() {
        assert!(safe_relative_path("tokenizer/config.json").is_ok());
        assert!(safe_relative_path("../outside").is_err());
        assert!(safe_relative_path("/absolute").is_err());
        assert!(model_spec("Qwen/Qwen3-ASR-0.6B").is_ok());
        assert!(model_spec("other/model").is_err());
        let url = repository_url("Qwen/Qwen3-ASR-0.6B", false, Some("model.safetensors")).unwrap();
        assert_eq!(
            url.path(),
            "/Qwen/Qwen3-ASR-0.6B/resolve/main/model.safetensors"
        );
        assert_eq!(url.query(), Some("download=true"));
    }

    #[test]
    fn parses_hugging_face_blob_sizes_and_tracks_cancellation() {
        let manifest: HfModelInfo = serde_json::from_str(r#"{"siblings":[{"rfilename":"config.json","size":12},{"rfilename":"model.safetensors","size":135,"lfs":{"size":1024,"sha256":"abc"}}]}"#).unwrap();
        assert_eq!(
            manifest
                .siblings
                .iter()
                .map(HfSibling::expected_size)
                .sum::<u64>(),
            1036
        );
        assert_eq!(manifest.siblings[1].expected_sha256(), Some("abc"));
        let manager = AsrManagerState::default();
        let cancelled = manager.begin("job").unwrap();
        assert!(manager.begin("job").is_err());
        cancelled.store(true, Ordering::Relaxed);
        assert!(cancelled.load(Ordering::Relaxed));
        manager.finish("job");
        assert!(manager.begin("job").is_ok());
    }

    #[test]
    fn parses_worker_progress_messages() {
        let progress: WorkerProgress =
            serde_json::from_str(r#"{"phase":"transcribing","message":"working","progress":0.64}"#)
                .unwrap();
        assert_eq!(progress.phase, "transcribing");
        assert_eq!(progress.message, "working");
        assert_eq!(progress.progress, 0.64);
    }
}
