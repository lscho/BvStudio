use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use semver::Version;
use std::{collections::HashSet, fs, path::{Path, PathBuf}};
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
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectAnimationData {
    duration_seconds: f64,
    easing: String,
    keyframes: Vec<EffectKeyframeData>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectKeyframeData {
    offset: f64,
    translate_x: f64,
    translate_y: f64,
    scale: f64,
    rotation: f64,
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
    effects: Vec<EffectDefinitionData>,
    signature: Option<PackageSignature>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectPackageInfo {
    schema_version: u32,
    manifest: EffectPackageManifest,
    effects: Vec<EffectDefinitionData>,
    verified: bool,
    signer_fingerprint: Option<String>,
    path: String,
}

fn safe_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 80 && value.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-' || byte == b'_')
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
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|character| character.is_ascii_hexdigit())
}

fn fingerprint(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().take(8).map(|byte| format!("{byte:02x}")).collect()
}

fn verify_signature(value: &Value, signature: Option<&PackageSignature>) -> Result<(bool, Option<String>), String> {
    let Some(signature) = signature else { return Ok((false, None)); };
    if signature.algorithm != "ed25519" { return Err("动效包签名算法不受支持".into()); }
    let public_bytes = BASE64.decode(&signature.public_key_base64).map_err(|_| "动效包公钥格式无效")?;
    let signature_bytes = BASE64.decode(&signature.signature_base64).map_err(|_| "动效包签名格式无效")?;
    let public_array: [u8; 32] = public_bytes.as_slice().try_into().map_err(|_| "动效包公钥长度无效")?;
    let signature_array: [u8; 64] = signature_bytes.as_slice().try_into().map_err(|_| "动效包签名长度无效")?;
    let mut payload = value.clone();
    payload.as_object_mut().ok_or("动效包结构无效")?.remove("signature");
    let canonical = serde_json::to_vec(&payload).map_err(|error| error.to_string())?;
    let key = VerifyingKey::from_bytes(&public_array).map_err(|_| "动效包公钥无效")?;
    key.verify_strict(&canonical, &Signature::from_bytes(&signature_array)).map_err(|_| "动效包签名校验失败")?;
    Ok((true, Some(fingerprint(&public_bytes))))
}

fn validate_effect(effect: &EffectDefinitionData) -> Result<(), String> {
    if !safe_id(&effect.id) { return Err("动效 ID 只能包含小写字母、数字、横线和下划线".into()); }
    if effect.name.trim().is_empty() || effect.name.chars().count() > 60 { return Err("动效名称无效".into()); }
    if !["标题", "强调", "卡片", "标注", "布局"].contains(&effect.category.as_str()) { return Err("动效分类无效".into()); }
    if !(100_000..=120_000_000).contains(&effect.default_duration_us) { return Err("动效默认时长无效".into()); }
    if !valid_color(&effect.default_color) || !valid_color(&effect.default_accent_color) { return Err("动效颜色无效".into()); }
    if !["highlight", "number", "panel", "underline", "frame"].contains(&effect.recipe.layout.as_str()) { return Err("动效布局类型无效".into()); }
    if !["slide-left", "fade-up", "pop", "none"].contains(&effect.recipe.entrance.as_str()) { return Err("动效入场类型无效".into()); }
    if !(0.0..=100.0).contains(&effect.recipe.padding_x) || !(0.0..=100.0).contains(&effect.recipe.padding_y)
        || !(0.0..=20.0).contains(&effect.recipe.border_width) || !(0.0..=40.0).contains(&effect.recipe.border_radius)
        || !(0.0..=1.0).contains(&effect.recipe.background_opacity) { return Err("动效样式参数超出范围".into()); }
    if let Some(animation) = &effect.recipe.animation {
        if !(0.05..=10.0).contains(&animation.duration_seconds) { return Err("关键帧动画时长无效".into()); }
        if !["linear", "ease-in", "ease-out", "ease-in-out"].contains(&animation.easing.as_str()) { return Err("关键帧缓动类型无效".into()); }
        if !(2..=16).contains(&animation.keyframes.len()) { return Err("关键帧数量必须在 2 到 16 之间".into()); }
        let mut previous = -1.0;
        for (index, keyframe) in animation.keyframes.iter().enumerate() {
            if !(0.0..=1.0).contains(&keyframe.offset) || keyframe.offset <= previous { return Err("关键帧 offset 必须在 0 到 1 之间严格递增".into()); }
            if !( -400.0..=400.0).contains(&keyframe.translate_x) || !(-400.0..=400.0).contains(&keyframe.translate_y)
                || !(0.05..=5.0).contains(&keyframe.scale) || !(-720.0..=720.0).contains(&keyframe.rotation) { return Err("关键帧变换参数超出范围".into()); }
            if index == 0 && keyframe.offset != 0.0 { return Err("第一个关键帧 offset 必须为 0".into()); }
            previous = keyframe.offset;
        }
        if animation.keyframes.last().map(|keyframe| keyframe.offset) != Some(1.0) { return Err("最后一个关键帧 offset 必须为 1".into()); }
    }
    Ok(())
}

fn inspect_contents(contents: &str, path: &Path) -> Result<EffectPackageInfo, String> {
    let value: Value = serde_json::from_str(contents).map_err(|error| format!("动效包 JSON 无效: {error}"))?;
    let package: EffectPackageFile = serde_json::from_value(value.clone()).map_err(|error| format!("动效包结构无效: {error}"))?;
    if !matches!(package.schema_version, 1 | 2) { return Err("不支持此动效包版本".into()); }
    if !safe_id(&package.manifest.id) { return Err("动效包 ID 无效".into()); }
    package_version(&package.manifest.version)?;
    if package.manifest.name.trim().is_empty() || package.manifest.name.chars().count() > 80 { return Err("动效包名称无效".into()); }
    if package.manifest.author.trim().is_empty() || package.manifest.author.chars().count() > 100 { return Err("动效包作者无效".into()); }
    if package.manifest.description.chars().count() > 500 { return Err("动效包描述过长".into()); }
    if package.effects.is_empty() || package.effects.len() > 100 { return Err("动效包必须包含 1 到 100 个动效".into()); }
    let mut effect_ids = HashSet::new();
    for effect in &package.effects {
        if package.schema_version == 1 && effect.recipe.animation.is_some() { return Err("关键帧动画需要使用动效包 schemaVersion 2".into()); }
        validate_effect(effect)?;
        if !effect_ids.insert(effect.id.as_str()) { return Err(format!("动效 ID 重复: {}", effect.id)); }
    }
    let (verified, signer_fingerprint) = verify_signature(&value, package.signature.as_ref())?;
    let mut effects = package.effects;
    for effect in &mut effects { effect.id = format!("{}:{}", package.manifest.id, effect.id); }
    Ok(EffectPackageInfo { schema_version: package.schema_version, manifest: package.manifest, effects, verified, signer_fingerprint, path: path.to_string_lossy().into_owned() })
}

fn effects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?.join("effects");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建动效库目录: {error}"))?;
    Ok(path)
}

fn inspect_path(path: &Path) -> Result<EffectPackageInfo, String> {
    if path.extension().and_then(|value| value.to_str()) != Some("bveffect") { return Err("请选择 .bveffect 动效包".into()); }
    if fs::metadata(path).map_err(|error| format!("无法读取动效包: {error}"))?.len() > 2 * 1024 * 1024 { return Err("动效包不能超过 2 MB".into()); }
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
    let mut packages = fs::read_dir(directory).map_err(|error| error.to_string())?.flatten()
        .filter_map(|entry| inspect_path(&entry.path()).ok()).collect::<Vec<_>>();
    packages.sort_by(|left, right| left.manifest.name.cmp(&right.manifest.name));
    Ok(packages)
}

#[tauri::command]
pub fn install_effect_package(app: AppHandle, path: String, allow_unsigned: bool) -> Result<EffectPackageInfo, String> {
    let source = PathBuf::from(&path);
    let info = inspect_path(&source)?;
    if !info.verified && !allow_unsigned { return Err("此动效包没有有效签名".into()); }
    let destination = effects_dir(&app)?.join(format!("{}.bveffect", info.manifest.id));
    if destination.is_file() {
        let installed = inspect_path(&destination)?;
        ensure_not_downgrade(&info.manifest.version, &installed.manifest.version)?;
        if source.canonicalize().ok() == destination.canonicalize().ok() { return Ok(installed); }
    }
    fs::copy(&source, &destination).map_err(|error| format!("安装动效包失败: {error}"))?;
    inspect_path(&destination)
}

#[tauri::command]
pub fn uninstall_effect_package(app: AppHandle, package_id: String) -> Result<(), String> {
    if !safe_id(&package_id) { return Err("动效包 ID 无效".into()); }
    let path = effects_dir(&app)?.join(format!("{package_id}.bveffect"));
    if path.is_file() { fs::remove_file(path).map_err(|error| format!("卸载动效包失败: {error}"))?; }
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
        assert!(inspect_contents(contents, Path::new("demo.bveffect")).err().unwrap().contains("重复"));
    }

    #[test]
    fn validates_the_example_package_and_install_version_policy() {
        let contents = include_str!("../../examples/effects/starter-pack.bveffect");
        let info = inspect_contents(contents, Path::new("starter-pack.bveffect")).unwrap();
        assert_eq!(info.schema_version, 2);
        assert_eq!(info.manifest.id, "bvideo-starter");
        assert_eq!(info.effects[0].id, "bvideo-starter:chapter-card");
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
        let invalid = contents.replacen("\"schemaVersion\": 2", "\"schemaVersion\": 1", 1);
        assert!(inspect_contents(&invalid, Path::new("invalid.bveffect")).err().unwrap().contains("schemaVersion 2"));
    }

    #[test]
    fn verifies_an_ed25519_package_signature() {
        let mut value: Value = serde_json::from_str(include_str!("../../examples/effects/starter-pack.bveffect")).unwrap();
        let canonical = serde_json::to_vec(&value).unwrap();
        let key = SigningKey::from_bytes(&[7_u8; 32]);
        let signature = key.sign(&canonical);
        value.as_object_mut().unwrap().insert("signature".into(), serde_json::json!({
            "algorithm": "ed25519",
            "publicKeyBase64": BASE64.encode(key.verifying_key().to_bytes()),
            "signatureBase64": BASE64.encode(signature.to_bytes())
        }));
        let contents = serde_json::to_string(&value).unwrap();
        let info = inspect_contents(&contents, Path::new("signed.bveffect")).unwrap();
        assert!(info.verified);
        assert!(info.signer_fingerprint.is_some());
    }
}
