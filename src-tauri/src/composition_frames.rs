use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::State;

static NEXT_ID: AtomicU64 = AtomicU64::new(0);
const MAX_FRAME_CHARACTERS: usize = 48 * 1024 * 1024;
const MAX_BATCH_CHARACTERS: usize = 96 * 1024 * 1024;
const MAX_BATCH_FRAMES: usize = 4;

struct FrameSequence {
    directory: PathBuf,
    count: usize,
    bytes: usize,
    dimensions: Option<(u32, u32)>,
}

impl Drop for FrameSequence {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

#[derive(Clone, Default)]
pub struct CompositionFrameState(Arc<Mutex<HashMap<String, FrameSequence>>>);

impl CompositionFrameState {
    pub fn resolve(&self, id: &str, expected: usize) -> Result<PathBuf, String> {
        let entries = self.0.lock().map_err(|_| "动效帧缓存不可用")?;
        let entry = entries.get(id).ok_or("动效帧缓存已失效，请重新导出")?;
        if entry.count != expected || expected == 0 {
            return Err("动效帧数量不完整，请重新导出".into());
        }
        Ok(entry.directory.join("%05d.png"))
    }
}

#[tauri::command]
pub async fn begin_composition_frames(
    state: State<'_, CompositionFrameState>,
) -> Result<String, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut entries = state.0.lock().map_err(|_| "动效帧缓存不可用")?;
        if entries.len() >= 128 {
            return Err("待导出动效过多，请分段导出".into());
        }
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| "系统时间无效")?
            .as_nanos();
        let id = format!(
            "{}-{stamp}-{}",
            std::process::id(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        );
        let directory = std::env::temp_dir().join(format!("bvideo-composition-{id}"));
        fs::create_dir(&directory).map_err(|_| "无法创建动效缓存，请检查临时磁盘空间")?;
        entries.insert(
            id.clone(),
            FrameSequence {
                directory,
                count: 0,
                bytes: 0,
                dimensions: None,
            },
        );
        Ok(id)
    })
    .await
    .map_err(|_| "动效缓存任务异常")?
}

fn png_dimensions(bytes: &[u8]) -> Result<(u32, u32), String> {
    if bytes.len() < 33 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" || &bytes[12..16] != b"IHDR" {
        return Err("动效帧必须是有效 PNG".into());
    }
    let width = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
    let height = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
    if width == 0 || height == 0 || width > 7680 || height > 7680 {
        return Err("动效帧尺寸超出范围".into());
    }
    Ok((width, height))
}

fn append_frames_blocking(
    state: &CompositionFrameState,
    sequence_id: &str,
    start_index: usize,
    data: Vec<String>,
) -> Result<(), String> {
    if data.is_empty() || data.len() > MAX_BATCH_FRAMES {
        return Err("动效帧批次数量无效".into());
    }
    let mut encoded_characters = 0usize;
    let mut images = Vec::with_capacity(data.len());
    for frame in data {
        if frame.len() > MAX_FRAME_CHARACTERS {
            return Err("单帧数据过大，请降低导出分辨率".into());
        }
        encoded_characters = encoded_characters.saturating_add(frame.len());
        if encoded_characters > MAX_BATCH_CHARACTERS {
            return Err("动效帧批次过大，请降低导出分辨率".into());
        }
        let image = BASE64.decode(frame).map_err(|_| "动效帧编码无效")?;
        let dimensions = png_dimensions(&image)?;
        images.push((image, dimensions));
    }

    let mut entries = state.0.lock().map_err(|_| "动效帧缓存不可用")?;
    let entry = entries.get_mut(sequence_id).ok_or("动效缓存已取消")?;
    let end_index = start_index
        .checked_add(images.len())
        .ok_or("动效帧顺序或数量无效")?;
    if start_index != entry.count || end_index > 216_000 {
        return Err("动效帧顺序或数量无效".into());
    }
    let dimensions = images[0].1;
    if entry
        .dimensions
        .is_some_and(|previous| previous != dimensions)
        || images
            .iter()
            .any(|(_, frame_dimensions)| *frame_dimensions != dimensions)
    {
        return Err("动效帧尺寸不一致".into());
    }
    let batch_bytes = images.iter().fold(0usize, |total, (image, _)| {
        total.saturating_add(image.len())
    });
    if entry.bytes.saturating_add(batch_bytes) > 8usize * 1024 * 1024 * 1024 {
        return Err("动效缓存超过 8 GB，请分段导出或降低分辨率".into());
    }
    for (offset, (image, _)) in images.iter().enumerate() {
        fs::write(
            entry
                .directory
                .join(format!("{:05}.png", start_index + offset)),
            image,
        )
        .map_err(|_| "写入动效帧失败，请检查磁盘空间")?;
    }
    entry.bytes += batch_bytes;
    entry.count = end_index;
    entry.dimensions = Some(dimensions);
    Ok(())
}

#[tauri::command]
pub async fn append_composition_frame(
    state: State<'_, CompositionFrameState>,
    sequence_id: String,
    index: usize,
    data: String,
) -> Result<(), String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        append_frames_blocking(&state, &sequence_id, index, vec![data])
    })
    .await
    .map_err(|_| "动效帧任务异常")?
}

#[tauri::command]
pub async fn append_composition_frames(
    state: State<'_, CompositionFrameState>,
    sequence_id: String,
    start_index: usize,
    data: Vec<String>,
) -> Result<(), String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        append_frames_blocking(&state, &sequence_id, start_index, data)
    })
    .await
    .map_err(|_| "动效帧批量写入任务异常")?
}

#[tauri::command]
pub async fn release_composition_frames(
    state: State<'_, CompositionFrameState>,
    sequence_id: String,
) -> Result<(), String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Only server-created, registered directories can be released.
        let entry = state
            .0
            .lock()
            .map_err(|_| "动效帧缓存不可用")?
            .remove(&sequence_id);
        drop(entry);
        Ok(())
    })
    .await
    .map_err(|_| "清理动效缓存失败")?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_png_and_unregistered_paths() {
        assert!(png_dimensions(b"invalid").is_err());
        assert!(CompositionFrameState::default()
            .resolve("../../escape", 1)
            .is_err());
    }

    #[test]
    fn appends_valid_png_frames_in_one_ordered_batch() {
        let directory = std::env::temp_dir().join(format!(
            "bvideo-composition-test-{}",
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&directory).unwrap();
        let state = CompositionFrameState::default();
        state.0.lock().unwrap().insert(
            "batch".into(),
            FrameSequence {
                directory: directory.clone(),
                count: 0,
                bytes: 0,
                dimensions: None,
            },
        );
        let mut png = vec![0; 33];
        png[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        png[12..16].copy_from_slice(b"IHDR");
        png[19] = 2;
        png[23] = 1;
        let encoded = BASE64.encode(png);

        append_frames_blocking(&state, "batch", 0, vec![encoded.clone(), encoded]).unwrap();

        assert_eq!(
            state.resolve("batch", 2).unwrap(),
            directory.join("%05d.png")
        );
        assert!(directory.join("00000.png").is_file());
        assert!(directory.join("00001.png").is_file());
        assert!(append_frames_blocking(&state, "batch", 1, vec!["invalid".into()]).is_err());
    }
}
