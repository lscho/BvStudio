use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, VerifyingKey};
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    f64::consts::PI,
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectPackageManifest {
    id: String,
    name: String,
    version: String,
    author: String,
    description: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectRecipeData {
    layout: String,
    entrance: String,
    padding_x: f64,
    padding_y: f64,
    border_width: f64,
    border_radius: f64,
    background_opacity: f64,
    animation: Option<EffectAnimationData>,
    #[serde(default)]
    chart: Option<ChartSpecData>,
    #[serde(default)]
    scene_background: Option<SceneBackgroundData>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneBackgroundData {
    preset: String,
    primary_color: String,
    secondary_color: String,
    border_color: String,
    intensity: f64,
}

/// Schema v4 declarative data-graphic payload rendered identically by preview
/// and export. Field values stay JSON-only to preserve the no-code guarantee.
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartSpecData {
    kind: String,
    #[serde(default)]
    start_value: Option<f64>,
    #[serde(default)]
    end_value: Option<f64>,
    #[serde(default)]
    prefix: Option<String>,
    #[serde(default)]
    suffix: Option<String>,
    #[serde(default)]
    decimals: Option<u32>,
    #[serde(default)]
    categories: Option<Vec<String>>,
    #[serde(default)]
    series: Option<Vec<f64>>,
    #[serde(default)]
    comparison: Option<Vec<f64>>,
    #[serde(default)]
    max_y: Option<f64>,
    #[serde(default)]
    unit: Option<String>,
    #[serde(default)]
    grid_lines: Option<u32>,
    #[serde(default)]
    duration_seconds: Option<f64>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectAnimationData {
    duration_seconds: f64,
    easing: String,
    keyframes: Vec<EffectKeyframeData>,
}

const BASE_EASINGS: [&str; 4] = ["linear", "ease-in", "ease-out", "ease-in-out"];
const EXTENDED_EASINGS: [&str; 14] = [
    "linear",
    "ease-in",
    "ease-out",
    "ease-in-out",
    "cubic-in",
    "cubic-out",
    "cubic-in-out",
    "quart-out",
    "back-in",
    "back-out",
    "back-in-out",
    "circ-out",
    "elastic-out",
    "bounce-out",
];

fn allowed_easings(schema_version: u32) -> &'static [&'static str] {
    if schema_version >= 4 {
        &EXTENDED_EASINGS
    } else {
        &BASE_EASINGS
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectKeyframeData {
    offset: f64,
    translate_x: f64,
    translate_y: f64,
    scale: f64,
    rotation: f64,
    #[serde(default)]
    easing: Option<String>,
    #[serde(default)]
    rotate_x: Option<f64>,
    #[serde(default)]
    rotate_y: Option<f64>,
    #[serde(default)]
    perspective: Option<f64>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneEffectTemplateLayerData {
    effect_id: String,
    text: Option<String>,
    x: f64,
    y: f64,
    scale: Option<f64>,
    rotation: Option<f64>,
    opacity: Option<f64>,
    font_size: Option<f64>,
    z_index: i32,
    start_ratio: Option<f64>,
    duration_ratio: Option<f64>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectDefinitionData {
    id: String,
    name: String,
    category: String,
    description: String,
    tags: Vec<String>,
    default_duration_us: u64,
    default_text: String,
    default_color: String,
    default_accent_color: String,
    recipe: EffectRecipeData,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    sound_cues: Vec<EffectSoundCueData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scene_layers: Option<Vec<SceneEffectTemplateLayerData>>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectSoundCueData {
    sound_id: String,
    offset_us: u64,
    volume: f64,
    #[serde(default, skip_deserializing, skip_serializing_if = "Option::is_none")]
    source_path: Option<String>,
    #[serde(default, skip_deserializing, skip_serializing_if = "is_zero")]
    duration_us: u64,
}

fn is_zero(value: &u64) -> bool {
    *value == 0
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SoundDefinitionData {
    id: String,
    name: String,
    duration_us: u64,
    layers: Vec<SoundLayerData>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SoundLayerData {
    waveform: String,
    start_offset_us: u64,
    duration_us: u64,
    start_frequency_hz: f64,
    end_frequency_hz: f64,
    volume: f64,
    attack_us: u64,
    release_us: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackageSignature {
    algorithm: String,
    public_key_base64: String,
    signature_base64: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EffectPackageFile {
    schema_version: u32,
    manifest: EffectPackageManifest,
    #[serde(default)]
    sounds: Vec<SoundDefinitionData>,
    effects: Vec<EffectDefinitionData>,
    signature: Option<PackageSignature>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectPackageInfo {
    schema_version: u32,
    manifest: EffectPackageManifest,
    effects: Vec<EffectDefinitionData>,
    sound_count: usize,
    verified: bool,
    signer_fingerprint: Option<String>,
    path: String,
    #[serde(skip)]
    sounds: Vec<SoundDefinitionData>,
}

fn safe_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-' || byte == b'_'
        })
}

fn package_version(value: &str) -> Result<Version, String> {
    Version::parse(value).map_err(|_| "动效包版本必须使用 SemVer".into())
}

fn ensure_not_downgrade(candidate: &str, installed: &str) -> Result<(), String> {
    if package_version(candidate)? < package_version(installed)? {
        Err("不能降级已安装的动效包；请先卸载现有版本".into())
    } else {
        Ok(())
    }
}

fn valid_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

fn fingerprint(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn verify_signature(
    value: &Value,
    signature: Option<&PackageSignature>,
) -> Result<(bool, Option<String>), String> {
    let Some(signature) = signature else {
        return Ok((false, None));
    };
    if signature.algorithm != "ed25519" {
        return Err("动效包签名算法不受支持".into());
    }
    let public_bytes = BASE64
        .decode(&signature.public_key_base64)
        .map_err(|_| "动效包公钥格式无效")?;
    let signature_bytes = BASE64
        .decode(&signature.signature_base64)
        .map_err(|_| "动效包签名格式无效")?;
    let public_array: [u8; 32] = public_bytes
        .as_slice()
        .try_into()
        .map_err(|_| "动效包公钥长度无效")?;
    let signature_array: [u8; 64] = signature_bytes
        .as_slice()
        .try_into()
        .map_err(|_| "动效包签名长度无效")?;
    let mut payload = value.clone();
    payload
        .as_object_mut()
        .ok_or("动效包结构无效")?
        .remove("signature");
    let canonical = serde_json::to_vec(&payload).map_err(|error| error.to_string())?;
    let key = VerifyingKey::from_bytes(&public_array).map_err(|_| "动效包公钥无效")?;
    key.verify_strict(&canonical, &Signature::from_bytes(&signature_array))
        .map_err(|_| "动效包签名校验失败")?;
    Ok((true, Some(fingerprint(&public_bytes))))
}

fn finite_range(value: f64, range: std::ops::RangeInclusive<f64>) -> bool {
    value.is_finite() && range.contains(&value)
}

fn validate_chart(chart: &ChartSpecData) -> Result<(), String> {
    if !["counter", "bar", "donut", "line"].contains(&chart.kind.as_str()) {
        return Err("图表类型无效".into());
    }
    let check_series = |values: &Option<Vec<f64>>| {
        values.as_ref().is_none_or(|series| {
            (0..=24).contains(&series.len())
                && series
                    .iter()
                    .all(|value| finite_range(*value, -1.0e9..=1.0e9))
        })
    };
    if !check_series(&chart.series) || !check_series(&chart.comparison) {
        return Err("图表数值超出范围".into());
    }
    if chart
        .categories
        .as_ref()
        .is_some_and(|items| items.len() > 24 || items.iter().any(|item| item.chars().count() > 20))
    {
        return Err("图表分类标签过长".into());
    }
    if let Some(start) = chart.start_value {
        if !finite_range(start, -1.0e9..=1.0e9) {
            return Err("图表起始值无效".into());
        }
    }
    if let Some(end) = chart.end_value {
        if !finite_range(end, -1.0e9..=1.0e9) {
            return Err("图表结束值无效".into());
        }
    }
    if let Some(max_y) = chart.max_y {
        if !finite_range(max_y, 1.0e-6..=1.0e9) {
            return Err("图表纵轴上限无效".into());
        }
    }
    if let Some(decimals) = chart.decimals {
        if decimals > 4 {
            return Err("图表小数位过多".into());
        }
    }
    if let Some(grid_lines) = chart.grid_lines {
        if grid_lines > 5 {
            return Err("图表网格线过多".into());
        }
    }
    for text in [&chart.prefix, &chart.suffix, &chart.unit] {
        if text.as_ref().is_some_and(|value| value.chars().count() > 8) {
            return Err("图表前后缀过长".into());
        }
    }
    if let Some(duration) = chart.duration_seconds {
        if !finite_range(duration, 0.05..=30.0) {
            return Err("图表动画时长无效".into());
        }
    }
    Ok(())
}

fn validate_sound(sound: &SoundDefinitionData) -> Result<(), String> {
    if !safe_id(&sound.id) {
        return Err("音效 ID 只能包含小写字母、数字、横线和下划线".into());
    }
    if sound.name.trim().is_empty() || sound.name.chars().count() > 60 {
        return Err("音效名称无效".into());
    }
    if !(50_000..=3_000_000).contains(&sound.duration_us) {
        return Err("音效时长必须介于 0.05 到 3 秒".into());
    }
    if sound.layers.is_empty() || sound.layers.len() > 8 {
        return Err("音效必须包含 1 到 8 个合成层".into());
    }
    for layer in &sound.layers {
        if !["sine", "triangle", "square", "noise"].contains(&layer.waveform.as_str()) {
            return Err("音效波形无效".into());
        }
        if layer.duration_us < 10_000
            || layer.start_offset_us.saturating_add(layer.duration_us) > sound.duration_us
        {
            return Err("音效图层时间范围无效".into());
        }
        if !finite_range(layer.start_frequency_hz, 20.0..=20_000.0)
            || !finite_range(layer.end_frequency_hz, 20.0..=20_000.0)
            || !finite_range(layer.volume, 0.0..=1.0)
        {
            return Err("音效图层频率或音量超出范围".into());
        }
        if layer.attack_us > layer.duration_us || layer.release_us > layer.duration_us {
            return Err("音效图层包络时长无效".into());
        }
    }
    Ok(())
}

fn envelope(layer: &SoundLayerData, elapsed_us: u64) -> f64 {
    let attack = if layer.attack_us == 0 {
        1.0
    } else {
        (elapsed_us as f64 / layer.attack_us as f64).min(1.0)
    };
    let remaining_us = layer.duration_us.saturating_sub(elapsed_us);
    let release = if layer.release_us == 0 {
        1.0
    } else {
        (remaining_us as f64 / layer.release_us as f64).min(1.0)
    };
    let gain = attack.min(release).clamp(0.0, 1.0);
    gain * gain * (3.0 - 2.0 * gain)
}

fn synthesize_wav(sound: &SoundDefinitionData) -> Vec<u8> {
    const SAMPLE_RATE: u32 = 48_000;
    let sample_count = ((sound.duration_us as u128 * SAMPLE_RATE as u128) / 1_000_000) as usize;
    let seed = Sha256::digest(serde_json::to_vec(sound).unwrap_or_default());
    let initial_seed = u32::from_le_bytes([seed[0], seed[1], seed[2], seed[3]]);
    let mut noise_states = sound
        .layers
        .iter()
        .enumerate()
        .map(|(index, _)| (initial_seed ^ (index as u32).wrapping_mul(0x9e37_79b9), 0.0))
        .collect::<Vec<_>>();
    let mut pcm = Vec::with_capacity(sample_count * 2);
    for sample_index in 0..sample_count {
        let sample_us = (sample_index as u128 * 1_000_000 / SAMPLE_RATE as u128) as u64;
        let mut mixed = 0.0;
        for (layer_index, layer) in sound.layers.iter().enumerate() {
            if sample_us < layer.start_offset_us
                || sample_us >= layer.start_offset_us + layer.duration_us
            {
                continue;
            }
            let elapsed_us = sample_us - layer.start_offset_us;
            let elapsed = elapsed_us as f64 / 1_000_000.0;
            let duration = layer.duration_us as f64 / 1_000_000.0;
            let progress = (elapsed / duration).clamp(0.0, 1.0);
            let frequency_delta = layer.end_frequency_hz - layer.start_frequency_hz;
            let phase = 2.0
                * PI
                * (layer.start_frequency_hz * elapsed
                    + 0.5 * frequency_delta * elapsed * elapsed / duration);
            let oscillator = match layer.waveform.as_str() {
                "triangle" => 2.0 / PI * phase.sin().asin(),
                "square" => {
                    if phase.sin() >= 0.0 {
                        1.0
                    } else {
                        -1.0
                    }
                }
                "noise" => {
                    let (state, filtered) = &mut noise_states[layer_index];
                    *state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                    let white = (*state as f64 / u32::MAX as f64) * 2.0 - 1.0;
                    let cutoff = layer.start_frequency_hz + frequency_delta * progress;
                    let alpha = (2.0 * PI * cutoff / SAMPLE_RATE as f64).clamp(0.001, 0.95);
                    *filtered += alpha * (white - *filtered);
                    *filtered
                }
                _ => phase.sin(),
            };
            mixed += oscillator * layer.volume * envelope(layer, elapsed_us);
        }
        let limited = mixed.tanh().clamp(-1.0, 1.0);
        pcm.extend_from_slice(&((limited * i16::MAX as f64) as i16).to_le_bytes());
    }
    let data_len = pcm.len() as u32;
    let mut wav = Vec::with_capacity(44 + pcm.len());
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16_u32.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    wav.extend_from_slice(&(SAMPLE_RATE * 2).to_le_bytes());
    wav.extend_from_slice(&2_u16.to_le_bytes());
    wav.extend_from_slice(&16_u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    wav.extend_from_slice(&pcm);
    wav
}

fn validate_effect(effect: &EffectDefinitionData, schema_version: u32) -> Result<(), String> {
    if !safe_id(&effect.id) {
        return Err("动效 ID 只能包含小写字母、数字、横线和下划线".into());
    }
    if effect.name.trim().is_empty() || effect.name.chars().count() > 60 {
        return Err("动效名称无效".into());
    }
    if !["标题", "强调", "卡片", "标注", "布局", "场景"].contains(&effect.category.as_str())
    {
        return Err("动效分类无效".into());
    }
    let is_scene = effect.kind.as_deref() == Some("scene");
    let is_background = effect.recipe.scene_background.is_some();
    if !matches!(
        effect.kind.as_deref(),
        None | Some("effect") | Some("scene")
    ) {
        return Err("动效 kind 无效".into());
    }
    if (effect.category == "场景") != (is_scene || is_background) {
        return Err("场景分类必须声明 sceneLayers 或 sceneBackground".into());
    }
    if is_scene && is_background {
        return Err("组合场景不能同时声明场景背景".into());
    }
    if is_scene {
        let layers = effect
            .scene_layers
            .as_ref()
            .ok_or("场景模板缺少 sceneLayers")?;
        if !(2..=8).contains(&layers.len()) {
            return Err("场景模板必须包含 2 到 8 个动效层".into());
        }
        for layer in layers {
            if !safe_id(&layer.effect_id) {
                return Err("场景图层引用的动效 ID 无效".into());
            }
            if !(0.0..=100.0).contains(&layer.x)
                || !(0.0..=100.0).contains(&layer.y)
                || !layer.scale.is_none_or(|value| (0.3..=3.0).contains(&value))
                || !layer
                    .rotation
                    .is_none_or(|value| (-180.0..=180.0).contains(&value))
                || !layer
                    .opacity
                    .is_none_or(|value| (0.0..=1.0).contains(&value))
                || !layer
                    .font_size
                    .is_none_or(|value| (8.0..=240.0).contains(&value))
                || !(0..=200).contains(&layer.z_index)
                || !layer
                    .start_ratio
                    .is_none_or(|value| (0.0..=0.95).contains(&value))
                || !layer
                    .duration_ratio
                    .is_none_or(|value| (0.01..=1.0).contains(&value))
            {
                return Err("场景图层参数超出范围".into());
            }
            if layer
                .text
                .as_ref()
                .is_some_and(|text| text.chars().count() > 500)
            {
                return Err("场景图层文字过长".into());
            }
        }
    } else if effect.scene_layers.is_some() {
        return Err("普通动效不能声明 sceneLayers".into());
    }
    if !(100_000..=120_000_000).contains(&effect.default_duration_us) {
        return Err("动效默认时长无效".into());
    }
    if !valid_color(&effect.default_color) || !valid_color(&effect.default_accent_color) {
        return Err("动效颜色无效".into());
    }
    if !["highlight", "number", "panel", "underline", "frame"]
        .contains(&effect.recipe.layout.as_str())
    {
        return Err("动效布局类型无效".into());
    }
    if !["slide-left", "fade-up", "pop", "none"].contains(&effect.recipe.entrance.as_str()) {
        return Err("动效入场类型无效".into());
    }
    if !(0.0..=100.0).contains(&effect.recipe.padding_x)
        || !(0.0..=100.0).contains(&effect.recipe.padding_y)
        || !(0.0..=20.0).contains(&effect.recipe.border_width)
        || !(0.0..=40.0).contains(&effect.recipe.border_radius)
        || !(0.0..=1.0).contains(&effect.recipe.background_opacity)
    {
        return Err("动效样式参数超出范围".into());
    }
    if let Some(animation) = &effect.recipe.animation {
        let uses_v4_features = effect.recipe.chart.is_some()
            || !BASE_EASINGS.contains(&animation.easing.as_str())
            || animation.keyframes.iter().any(|keyframe| {
                keyframe.easing.is_some()
                    || keyframe.rotate_x.unwrap_or(0.0) != 0.0
                    || keyframe.rotate_y.unwrap_or(0.0) != 0.0
                    || keyframe.perspective.unwrap_or(0.0) != 0.0
            });
        if schema_version < 4 && uses_v4_features {
            return Err("图表、扩展缓动与 3D 关键帧需要使用动效包 schemaVersion 4".into());
        }
        if !(0.05..=10.0).contains(&animation.duration_seconds) {
            return Err("关键帧动画时长无效".into());
        }
        if !allowed_easings(schema_version).contains(&animation.easing.as_str()) {
            return Err("关键帧缓动类型无效".into());
        }
        if !(2..=16).contains(&animation.keyframes.len()) {
            return Err("关键帧数量必须在 2 到 16 之间".into());
        }
        let mut previous = -1.0;
        for (index, keyframe) in animation.keyframes.iter().enumerate() {
            if !(0.0..=1.0).contains(&keyframe.offset) || keyframe.offset <= previous {
                return Err("关键帧 offset 必须在 0 到 1 之间严格递增".into());
            }
            if !(-400.0..=400.0).contains(&keyframe.translate_x)
                || !(-400.0..=400.0).contains(&keyframe.translate_y)
                || !(0.05..=5.0).contains(&keyframe.scale)
                || !(-720.0..=720.0).contains(&keyframe.rotation)
            {
                return Err("关键帧变换参数超出范围".into());
            }
            if let Some(name) = &keyframe.easing {
                if !allowed_easings(schema_version).contains(&name.as_str()) {
                    return Err("关键帧缓动类型无效".into());
                }
            }
            for tilt in [keyframe.rotate_x, keyframe.rotate_y] {
                if !(-80.0..=80.0).contains(&tilt.unwrap_or(0.0)) {
                    return Err("3D 倾斜角必须介于 -80 到 80 度".into());
                }
            }
            if let Some(perspective) = keyframe.perspective {
                if !(200.0..=4000.0).contains(&perspective) {
                    return Err("透视距离必须介于 200 到 4000".into());
                }
            }
            if index == 0 && keyframe.offset != 0.0 {
                return Err("第一个关键帧 offset 必须为 0".into());
            }
            previous = keyframe.offset;
        }
        if animation.keyframes.last().map(|keyframe| keyframe.offset) != Some(1.0) {
            return Err("最后一个关键帧 offset 必须为 1".into());
        }
    }
    if effect.recipe.animation.is_none() {
        if schema_version < 4 && effect.recipe.chart.is_some() {
            return Err("图表、扩展缓动与 3D 关键帧需要使用动效包 schemaVersion 4".into());
        }
    }
    if let Some(chart) = &effect.recipe.chart {
        validate_chart(chart)?;
    }
    if let Some(scene) = &effect.recipe.scene_background {
        if schema_version < 5 {
            return Err("场景背景需要使用动效包 schemaVersion 5".into());
        }
        if ![
            "black-stripes",
            "white-frame",
            "dark-grid",
            "clean-white",
            "spotlight",
            "blueprint",
            "paper-lines",
            "contrast-side",
        ]
        .contains(&scene.preset.as_str())
        {
            return Err("场景背景预设无效".into());
        }
        if !valid_color(&scene.primary_color)
            || !valid_color(&scene.secondary_color)
            || !valid_color(&scene.border_color)
            || !finite_range(scene.intensity, 0.1..=1.0)
        {
            return Err("场景背景参数无效".into());
        }
    }
    Ok(())
}

fn inspect_contents(contents: &str, path: &Path) -> Result<EffectPackageInfo, String> {
    let value: Value =
        serde_json::from_str(contents).map_err(|error| format!("动效包 JSON 无效: {error}"))?;
    let package: EffectPackageFile = serde_json::from_value(value.clone())
        .map_err(|error| format!("动效包结构无效: {error}"))?;
    if !matches!(package.schema_version, 1 | 2 | 3 | 4 | 5 | 6) {
        return Err("不支持此动效包版本".into());
    }
    if !safe_id(&package.manifest.id) {
        return Err("动效包 ID 无效".into());
    }
    package_version(&package.manifest.version)?;
    if package.manifest.name.trim().is_empty() || package.manifest.name.chars().count() > 80 {
        return Err("动效包名称无效".into());
    }
    if package.manifest.author.trim().is_empty() || package.manifest.author.chars().count() > 100 {
        return Err("动效包作者无效".into());
    }
    if package.manifest.description.chars().count() > 500 {
        return Err("动效包描述过长".into());
    }
    if package.effects.is_empty() || package.effects.len() > 100 {
        return Err("动效包必须包含 1 到 100 个动效".into());
    }
    if package.schema_version < 6
        && (!package.sounds.is_empty()
            || package
                .effects
                .iter()
                .any(|effect| !effect.sound_cues.is_empty()))
    {
        return Err("声明式音效需要使用动效包 schemaVersion 6".into());
    }
    if package.sounds.len() > 32 {
        return Err("动效包最多包含 32 个音效".into());
    }
    let mut sound_ids = HashSet::new();
    for sound in &package.sounds {
        validate_sound(sound)?;
        if !sound_ids.insert(sound.id.as_str()) {
            return Err(format!("音效 ID 重复: {}", sound.id));
        }
    }
    let mut effect_ids = HashSet::new();
    for effect in &package.effects {
        if package.schema_version == 1 && effect.recipe.animation.is_some() {
            return Err("关键帧动画需要使用动效包 schemaVersion 2".into());
        }
        if package.schema_version < 3
            && (effect.kind.is_some() || effect.scene_layers.is_some() || effect.category == "场景")
        {
            return Err("场景模板需要使用动效包 schemaVersion 3".into());
        }
        validate_effect(effect, package.schema_version)?;
        for cue in &effect.sound_cues {
            if !sound_ids.contains(cue.sound_id.as_str()) {
                return Err(format!("动效引用了包内不存在的音效: {}", cue.sound_id));
            }
            if cue.offset_us >= effect.default_duration_us || !finite_range(cue.volume, 0.0..=1.0) {
                return Err("动效音效触发参数无效".into());
            }
        }
        if !effect_ids.insert(effect.id.as_str()) {
            return Err(format!("动效 ID 重复: {}", effect.id));
        }
    }
    for effect in &package.effects {
        let Some(layers) = &effect.scene_layers else {
            continue;
        };
        for layer in layers {
            let referenced = package
                .effects
                .iter()
                .find(|candidate| candidate.id == layer.effect_id)
                .ok_or_else(|| format!("场景图层引用了包内不存在的动效: {}", layer.effect_id))?;
            if referenced.kind.as_deref() == Some("scene") {
                return Err("场景模板不能嵌套其他场景模板".into());
            }
        }
    }
    let (verified, signer_fingerprint) = verify_signature(&value, package.signature.as_ref())?;
    let sound_durations = package
        .sounds
        .iter()
        .map(|sound| (sound.id.clone(), sound.duration_us))
        .collect::<HashMap<_, _>>();
    let package_id = package.manifest.id.clone();
    let mut effects = package.effects;
    for effect in &mut effects {
        if let Some(layers) = &mut effect.scene_layers {
            for layer in layers.iter_mut() {
                layer.effect_id = format!("{}:{}", package.manifest.id, layer.effect_id);
            }
        }
        for cue in &mut effect.sound_cues {
            cue.duration_us = sound_durations
                .get(&cue.sound_id)
                .copied()
                .unwrap_or_default();
            cue.sound_id = format!("{}:{}", package_id, cue.sound_id);
        }
        effect.id = format!("{}:{}", package.manifest.id, effect.id);
    }
    Ok(EffectPackageInfo {
        schema_version: package.schema_version,
        manifest: package.manifest,
        effects,
        sound_count: package.sounds.len(),
        verified,
        signer_fingerprint,
        path: path.to_string_lossy().into_owned(),
        sounds: package.sounds,
    })
}

fn effects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("effects");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建动效库目录: {error}"))?;
    Ok(path)
}

fn sound_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("audio")
        .join("effect-sounds");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建动效音效缓存: {error}"))?;
    Ok(path)
}

fn materialize_sounds(app: &AppHandle, info: &mut EffectPackageInfo) -> Result<(), String> {
    if info.sounds.is_empty() {
        return Ok(());
    }
    let directory = sound_cache_dir(app)?;
    let mut paths = HashMap::new();
    for sound in &info.sounds {
        let digest = Sha256::digest(serde_json::to_vec(sound).map_err(|error| error.to_string())?);
        let suffix = digest
            .iter()
            .take(8)
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let path = directory.join(format!("{}-{}-{suffix}.wav", info.manifest.id, sound.id));
        let expected_size = 44 + ((sound.duration_us as u128 * 48_000 / 1_000_000) as u64 * 2);
        let cache_valid = fs::metadata(&path)
            .map(|metadata| metadata.is_file() && metadata.len() == expected_size)
            .unwrap_or(false);
        if !cache_valid {
            fs::write(&path, synthesize_wav(sound))
                .map_err(|error| format!("无法生成动效音效: {error}"))?;
        }
        paths.insert(
            format!("{}:{}", info.manifest.id, sound.id),
            path.to_string_lossy().into_owned(),
        );
    }
    for effect in &mut info.effects {
        for cue in &mut effect.sound_cues {
            cue.source_path = paths.get(&cue.sound_id).cloned();
        }
    }
    Ok(())
}

fn inspect_path(path: &Path) -> Result<EffectPackageInfo, String> {
    if path.extension().and_then(|value| value.to_str()) != Some("bveffect") {
        return Err("请选择 .bveffect 动效包".into());
    }
    if fs::metadata(path)
        .map_err(|error| format!("无法读取动效包: {error}"))?
        .len()
        > 2 * 1024 * 1024
    {
        return Err("动效包不能超过 2 MB".into());
    }
    let contents = fs::read_to_string(path).map_err(|error| format!("无法读取动效包: {error}"))?;
    inspect_contents(&contents, path)
}

#[tauri::command]
pub fn inspect_effect_package(path: String) -> Result<EffectPackageInfo, String> {
    inspect_path(Path::new(&path))
}

#[tauri::command]
pub fn list_effect_packages(app: AppHandle) -> Result<Vec<EffectPackageInfo>, String> {
    let directory = effects_dir(&app)?;
    let mut packages = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .flatten()
        .filter_map(|entry| {
            let mut info = inspect_path(&entry.path()).ok()?;
            materialize_sounds(&app, &mut info).ok()?;
            Some(info)
        })
        .collect::<Vec<_>>();
    packages.sort_by(|left, right| left.manifest.name.cmp(&right.manifest.name));
    Ok(packages)
}

#[tauri::command]
pub fn install_effect_package(
    app: AppHandle,
    path: String,
    allow_unsigned: bool,
) -> Result<EffectPackageInfo, String> {
    let source = PathBuf::from(&path);
    let info = inspect_path(&source)?;
    if !info.verified && !allow_unsigned {
        return Err("此动效包没有有效签名".into());
    }
    let destination = effects_dir(&app)?.join(format!("{}.bveffect", info.manifest.id));
    if destination.is_file() {
        let mut installed = inspect_path(&destination)?;
        ensure_not_downgrade(&info.manifest.version, &installed.manifest.version)?;
        if source.canonicalize().ok() == destination.canonicalize().ok() {
            materialize_sounds(&app, &mut installed)?;
            return Ok(installed);
        }
    }
    fs::copy(&source, &destination).map_err(|error| format!("安装动效包失败: {error}"))?;
    let mut installed = inspect_path(&destination)?;
    materialize_sounds(&app, &mut installed)?;
    Ok(installed)
}

#[tauri::command]
pub fn uninstall_effect_package(app: AppHandle, package_id: String) -> Result<(), String> {
    if !safe_id(&package_id) {
        return Err("动效包 ID 无效".into());
    }
    let path = effects_dir(&app)?.join(format!("{package_id}.bveffect"));
    if path.is_file() {
        fs::remove_file(path).map_err(|error| format!("卸载动效包失败: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    #[test]
    fn validates_an_unsigned_declarative_package() {
        let contents = r##"{"schemaVersion":1,"manifest":{"id":"demo-pack","name":"Demo","version":"1.2.0","author":"BVideo","description":"Test"},"effects":[{"id":"notice","name":"Notice","category":"卡片","description":"Test","tags":["test"],"defaultDurationUs":2000000,"defaultText":"Hello","defaultColor":"#ffffff","defaultAccentColor":"#47d7ac","recipe":{"layout":"panel","entrance":"fade-up","paddingX":20,"paddingY":12,"borderWidth":2,"borderRadius":4,"backgroundOpacity":0.8}}]}"##;
        let info = inspect_contents(contents, Path::new("demo.bveffect")).unwrap();
        assert!(!info.verified);
        assert_eq!(info.effects[0].id, "demo-pack:notice");
    }

    #[test]
    fn validates_semver_order_and_rejects_duplicate_effects() {
        assert!(package_version("1.2.0-beta.1").unwrap() < package_version("1.2.0").unwrap());
        assert!(package_version("01.2.3").is_err());
        let contents = r##"{"schemaVersion":1,"manifest":{"id":"demo","name":"Demo","version":"1.0.0","author":"BVideo","description":""},"effects":[{"id":"same","name":"One","category":"卡片","description":"","tags":[],"defaultDurationUs":2000000,"defaultText":"One","defaultColor":"#ffffff","defaultAccentColor":"#47d7ac","recipe":{"layout":"panel","entrance":"none","paddingX":1,"paddingY":1,"borderWidth":0,"borderRadius":0,"backgroundOpacity":0}},{"id":"same","name":"Two","category":"卡片","description":"","tags":[],"defaultDurationUs":2000000,"defaultText":"Two","defaultColor":"#ffffff","defaultAccentColor":"#47d7ac","recipe":{"layout":"panel","entrance":"none","paddingX":1,"paddingY":1,"borderWidth":0,"borderRadius":0,"backgroundOpacity":0}}]}"##;
        assert!(inspect_contents(contents, Path::new("demo.bveffect"))
            .err()
            .unwrap()
            .contains("重复"));
    }

    #[test]
    fn validates_the_example_package_and_install_version_policy() {
        let contents = include_str!("../../examples/effects/starter-pack.bveffect");
        let info = inspect_contents(contents, Path::new("starter-pack.bveffect")).unwrap();
        assert_eq!(info.schema_version, 6);
        assert_eq!(info.manifest.id, "bvideo-starter");
        assert_eq!(info.sound_count, 4);
        assert_eq!(info.effects.len(), 4);
        assert_eq!(info.effects[0].id, "bvideo-starter:chapter-card");
        assert_eq!(
            info.effects[0].sound_cues[0].sound_id,
            "bvideo-starter:whoosh-short"
        );
        assert_eq!(info.effects[0].sound_cues[0].duration_us, 700_000);
        let wav = synthesize_wav(&info.sounds[0]);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert!(wav.len() > 44);
        assert!(ensure_not_downgrade("1.1.0", "1.0.0").is_ok());
        assert!(ensure_not_downgrade("1.0.0", "1.0.0").is_ok());
        assert!(ensure_not_downgrade("0.9.0", "1.0.0").is_err());
    }

    #[test]
    fn validates_v2_keyframes_and_rejects_animation_in_v1() {
        let contents = include_str!("../../examples/effects/starter-pack.bveffect");
        let info = inspect_contents(contents, Path::new("starter-pack.bveffect")).unwrap();
        let animation = info.effects[0].recipe.animation.as_ref().unwrap();
        assert_eq!(animation.keyframes.len(), 3);
        let mut invalid_value: Value = serde_json::from_str(contents).unwrap();
        invalid_value["schemaVersion"] = serde_json::json!(1);
        invalid_value.as_object_mut().unwrap().remove("sounds");
        for effect in invalid_value["effects"].as_array_mut().unwrap() {
            effect.as_object_mut().unwrap().remove("soundCues");
        }
        let invalid = serde_json::to_string(&invalid_value).unwrap();
        assert!(inspect_contents(&invalid, Path::new("invalid.bveffect"))
            .err()
            .unwrap()
            .contains("schemaVersion 2"));
    }

    #[test]
    fn rejects_v6_sound_cues_that_reference_missing_sounds() {
        let contents = include_str!("../../examples/effects/starter-pack.bveffect")
            .replace("\"soundId\": \"whoosh-short\"", "\"soundId\": \"missing\"");
        assert!(inspect_contents(&contents, Path::new("invalid.bveffect"))
            .err()
            .unwrap()
            .contains("不存在的音效"));
    }

    #[test]
    fn validates_v3_scene_templates_and_namespaces_layer_references() {
        let contents = r##"{"schemaVersion":3,"manifest":{"id":"scene-pack","name":"Scenes","version":"1.0.0","author":"BVideo","description":"Scene templates"},"effects":[{"id":"title","name":"Title","category":"标题","description":"","tags":["title"],"defaultDurationUs":2000000,"defaultText":"Title","defaultColor":"#ffffff","defaultAccentColor":"#47d7ac","recipe":{"layout":"highlight","entrance":"fade-up","paddingX":10,"paddingY":10,"borderWidth":0,"borderRadius":0,"backgroundOpacity":0}},{"id":"intro","name":"Intro scene","category":"场景","kind":"scene","description":"","tags":["scene"],"defaultDurationUs":4000000,"defaultText":"Intro","defaultColor":"#ffffff","defaultAccentColor":"#47d7ac","recipe":{"layout":"frame","entrance":"none","paddingX":10,"paddingY":10,"borderWidth":1,"borderRadius":2,"backgroundOpacity":0.2},"sceneLayers":[{"effectId":"title","text":"Main","x":50,"y":35,"fontSize":60,"zIndex":30},{"effectId":"title","text":"Sub","x":50,"y":65,"scale":0.7,"zIndex":20,"startRatio":0.2}]}]}"##;
        let info = inspect_contents(contents, Path::new("scenes.bveffect")).unwrap();
        assert_eq!(info.schema_version, 3);
        assert_eq!(info.effects[1].id, "scene-pack:intro");
        assert_eq!(
            info.effects[1].scene_layers.as_ref().unwrap()[0].effect_id,
            "scene-pack:title"
        );

        let invalid = contents.replace("\"effectId\":\"title\"", "\"effectId\":\"missing\"");
        assert!(inspect_contents(&invalid, Path::new("invalid.bveffect"))
            .err()
            .unwrap()
            .contains("不存在"));
    }

    #[test]
    fn validates_v4_charts_and_extended_easings_but_rejects_them_below_v4() {
        let base = r##"{"schemaVersion":4,"manifest":{"id":"chart-pack","name":"Charts","version":"1.0.0","author":"BVideo","description":"v4"},"effects":[{"id":"bar","name":"Bars","category":"强调","description":"","tags":["data"],"defaultDurationUs":3000000,"defaultText":"增长","defaultColor":"#ffffff","defaultAccentColor":"#47d7ac","recipe":{"layout":"frame","entrance":"fade-up","paddingX":10,"paddingY":10,"borderWidth":1,"borderRadius":2,"backgroundOpacity":0.8,"chart":{"kind":"bar","series":[12,40,28],"categories":["一季度","二季度","三季度"]},"animation":{"durationSeconds":0.8,"easing":"bounce-out","keyframes":[{"offset":0,"translateX":0,"translateY":30,"scale":0.8,"rotation":-2},{"offset":0.6,"translateX":0,"translateY":-3,"scale":1.04,"rotation":1,"easing":"ease-out"},{"offset":1,"translateX":0,"translateY":0,"scale":1,"rotation":0}]}}}]}"##;
        let info = inspect_contents(base, Path::new("charts.bveffect")).unwrap();
        assert_eq!(info.schema_version, 4);
        assert_eq!(info.effects[0].recipe.chart.as_ref().unwrap().kind, "bar");
        assert_eq!(
            info.effects[0].recipe.animation.as_ref().unwrap().keyframes[1]
                .easing
                .as_deref(),
            Some("ease-out")
        );

        let downgraded = base.replace("\"schemaVersion\":4", "\"schemaVersion\":3");
        assert!(inspect_contents(&downgraded, Path::new("old.bveffect"))
            .err()
            .unwrap()
            .contains("schemaVersion 4"));

        let bad_kind = base.replace("\"kind\":\"bar\"", "\"kind\":\"hologram\"");
        assert!(inspect_contents(&bad_kind, Path::new("bad.bveffect"))
            .err()
            .unwrap()
            .contains("图表类型无效"));
    }

    #[test]
    fn validates_v5_scene_backgrounds_and_rejects_invalid_intensity() {
        let base = r##"{"schemaVersion":5,"manifest":{"id":"background-pack","name":"Backgrounds","version":"1.0.0","author":"BVideo","description":"v5"},"effects":[{"id":"stripes","name":"Stripes","category":"场景","description":"","tags":["scene"],"defaultDurationUs":8000000,"defaultText":"","defaultColor":"#111317","defaultAccentColor":"#5fa8ff","recipe":{"layout":"frame","entrance":"none","paddingX":0,"paddingY":0,"borderWidth":0,"borderRadius":0,"backgroundOpacity":0,"sceneBackground":{"preset":"black-stripes","primaryColor":"#111317","secondaryColor":"#252a31","borderColor":"#5fa8ff","intensity":0.72}}}]}"##;
        let info = inspect_contents(base, Path::new("backgrounds.bveffect")).unwrap();
        assert_eq!(info.schema_version, 5);
        assert_eq!(
            info.effects[0]
                .recipe
                .scene_background
                .as_ref()
                .unwrap()
                .preset,
            "black-stripes"
        );

        let downgraded = base.replace("\"schemaVersion\":5", "\"schemaVersion\":4");
        assert!(inspect_contents(&downgraded, Path::new("old.bveffect"))
            .err()
            .unwrap()
            .contains("schemaVersion 5"));
        let invalid = base.replace("\"intensity\":0.72", "\"intensity\":2");
        assert!(inspect_contents(&invalid, Path::new("invalid.bveffect"))
            .err()
            .unwrap()
            .contains("参数无效"));
    }

    #[test]
    fn verifies_an_ed25519_package_signature() {
        let mut value: Value =
            serde_json::from_str(include_str!("../../examples/effects/starter-pack.bveffect"))
                .unwrap();
        let canonical = serde_json::to_vec(&value).unwrap();
        let key = SigningKey::from_bytes(&[7_u8; 32]);
        let signature = key.sign(&canonical);
        value.as_object_mut().unwrap().insert(
            "signature".into(),
            serde_json::json!({
                "algorithm": "ed25519",
                "publicKeyBase64": BASE64.encode(key.verifying_key().to_bytes()),
                "signatureBase64": BASE64.encode(signature.to_bytes())
            }),
        );
        let contents = serde_json::to_string(&value).unwrap();
        let info = inspect_contents(&contents, Path::new("signed.bveffect")).unwrap();
        assert!(info.verified);
        assert!(info.signer_fingerprint.is_some());
    }
}
