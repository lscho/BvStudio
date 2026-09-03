use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

use crate::media::{require_command, run};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemVoice {
    id: String,
    name: String,
    language: String,
}

fn audio_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("audio");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建音频目录: {error}"))?;
    Ok(path)
}

fn stamped_path(app: &AppHandle, prefix: &str, extension: &str) -> Result<PathBuf, String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    Ok(audio_dir(app)?.join(format!("{prefix}-{stamp}.{extension}")))
}

#[tauri::command]
pub fn save_recording(
    app: AppHandle,
    data_base64: String,
    extension: String,
) -> Result<String, String> {
    let extension = match extension.to_ascii_lowercase().as_str() {
        "webm" => "webm",
        "ogg" => "ogg",
        "mp4" | "m4a" => "m4a",
        "wav" => "wav",
        _ => return Err("不支持此录音格式".into()),
    };
    let bytes = BASE64
        .decode(data_base64)
        .map_err(|error| format!("录音数据无效: {error}"))?;
    if bytes.is_empty() || bytes.len() > 512 * 1024 * 1024 {
        return Err("录音数据大小无效".into());
    }
    let path = stamped_path(&app, "recording", extension)?;
    fs::write(&path, bytes).map_err(|error| format!("保存录音失败: {error}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(target_os = "macos")]
fn platform_voices() -> Result<Vec<SystemVoice>, String> {
    let output = run(
        {
            let mut command = Command::new("say");
            command.args(["-v", "?"]);
            command
        },
        "读取系统声音",
    )?;
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let parts = line.split_whitespace().collect::<Vec<_>>();
            let language_index = parts
                .iter()
                .position(|part| part.len() == 5 && part.as_bytes().get(2) == Some(&b'_'))?;
            let id = parts[..language_index].join(" ");
            Some(SystemVoice {
                name: id.clone(),
                id,
                language: parts[language_index].into(),
            })
        })
        .collect())
}

#[cfg(target_os = "windows")]
fn platform_voices() -> Result<Vec<SystemVoice>, String> {
    let script = "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name + '|' + $_.VoiceInfo.Culture.Name }";
    let output = run(
        {
            let mut command = Command::new("powershell");
            command.args(["-NoProfile", "-Command", script]);
            command
        },
        "读取系统声音",
    )?;
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let (name, language) = line.trim().split_once('|')?;
            Some(SystemVoice {
                id: name.into(),
                name: name.into(),
                language: language.into(),
            })
        })
        .collect())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn linux_speech_command() -> &'static str {
    if Command::new("espeak-ng")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
    {
        "espeak-ng"
    } else {
        "espeak"
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn platform_voices() -> Result<Vec<SystemVoice>, String> {
    let output = run(
        {
            let mut command = Command::new(linux_speech_command());
            command.arg("--voices");
            command
        },
        "读取系统声音",
    )?;
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .skip(1)
        .filter_map(|line| {
            let parts = line.split_whitespace().collect::<Vec<_>>();
            let language = parts.get(1)?.to_string();
            let name = parts.get(3).unwrap_or(&parts[1]).to_string();
            Some(SystemVoice {
                id: name.clone(),
                name,
                language,
            })
        })
        .collect())
}

#[tauri::command]
pub fn list_system_voices() -> Result<Vec<SystemVoice>, String> {
    platform_voices()
}

#[cfg(target_os = "macos")]
fn synthesize_platform(
    text: &str,
    voice: &str,
    rate: u32,
    output: &Path,
    ffmpeg_path: &Path,
) -> Result<(), String> {
    let aiff = output.with_extension("aiff");
    let mut command = Command::new("say");
    command
        .args(["-o"])
        .arg(&aiff)
        .args(["-r", &rate.to_string()]);
    if !voice.trim().is_empty() {
        command.args(["-v", voice.trim()]);
    }
    command.arg(text);
    run(command, "生成系统配音")?;
    let mut ffmpeg = Command::new(ffmpeg_path);
    ffmpeg
        .args(["-y", "-i"])
        .arg(&aiff)
        .args(["-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le"])
        .arg(output);
    let result = run(ffmpeg, "转换配音格式").map(|_| ());
    let _ = fs::remove_file(aiff);
    result
}

#[cfg(target_os = "windows")]
fn synthesize_platform(text: &str, voice: &str, rate: u32, output: &Path) -> Result<(), String> {
    let mapped_rate = (((rate as f64 - 180.0) / 18.0).round() as i32).clamp(-10, 10);
    let script = "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; if($args[1]){$s.SelectVoice($args[1])}; $s.Rate=[int]$args[2]; $s.SetOutputToWaveFile($args[3]); $s.Speak($args[0]); $s.Dispose()";
    let mut command = Command::new("powershell");
    command.args([
        "-NoProfile",
        "-Command",
        script,
        text,
        voice,
        &mapped_rate.to_string(),
        output.to_string_lossy().as_ref(),
    ]);
    run(command, "生成系统配音").map(|_| ())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn synthesize_platform(text: &str, voice: &str, rate: u32, output: &Path) -> Result<(), String> {
    let mut command = Command::new(linux_speech_command());
    command.args(["-s", &rate.to_string(), "-w"]).arg(output);
    if !voice.trim().is_empty() {
        command.args(["-v", voice.trim()]);
    }
    command.arg(text);
    run(command, "生成系统配音").map(|_| ())
}

#[tauri::command]
pub fn synthesize_speech(
    app: AppHandle,
    text: String,
    voice: String,
    rate: u32,
) -> Result<String, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("配音文字不能为空".into());
    }
    if text.chars().count() > 20_000 {
        return Err("单次配音文字不能超过 20000 字".into());
    }
    let rate = rate.clamp(80, 450);
    let output = stamped_path(&app, "speech", "wav")?;
    #[cfg(target_os = "macos")]
    synthesize_platform(
        text,
        &voice,
        rate,
        &output,
        &require_command(&app, "ffmpeg")?,
    )?;
    #[cfg(not(target_os = "macos"))]
    synthesize_platform(text, &voice, rate, &output)?;
    if fs::metadata(&output)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
        <= 1_000
    {
        let _ = fs::remove_file(&output);
        return Err("系统语音服务没有生成有效音频，请安装可用的系统声音后重试".into());
    }
    Ok(output.to_string_lossy().into_owned())
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn creates_local_system_speech() {
        let ffmpeg = [
            PathBuf::from("/opt/homebrew/bin/ffmpeg"),
            PathBuf::from("/usr/local/bin/ffmpeg"),
            PathBuf::from("ffmpeg"),
        ]
        .into_iter()
        .find(|candidate| {
            Command::new(candidate)
                .arg("-version")
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        });
        let Some(ffmpeg) = ffmpeg else { return };
        let output = std::env::temp_dir().join(format!(
            "bvideo-tts-test-{}.wav",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        synthesize_platform("BVideo Studio", "", 220, &output, &ffmpeg).unwrap();
        if fs::metadata(&output).unwrap().len() <= 1_000 {
            let _ = fs::remove_file(output);
            return;
        }
        let _ = fs::remove_file(output);
    }
}
