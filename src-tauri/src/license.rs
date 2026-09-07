use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::AppHandle;

use crate::secrets::credentials_directory;

const DEVICE_ID_FILE: &str = "device-id";
const HASH_SALT: &[u8] = b"bvideo:device:v1:";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub device_id: String,
    pub platform: String,
}

/// 解析 macOS ioreg 命令输出中的 IOPlatformUUID。
#[allow(dead_code)]
pub fn parse_ioreg_output(output: &str) -> Option<String> {
    for line in output.lines() {
        if line.contains("IOPlatformUUID") {
            if let Some(pos) = line.find('=') {
                let value_part = &line[pos + 1..];
                let trimmed = value_part.trim().trim_matches('"').trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

/// 解析 Windows 注册表 query 命令输出中的 MachineGuid。
#[allow(dead_code)]
pub fn parse_reg_machine_guid(output: &str) -> Option<String> {
    for line in output.lines() {
        if line.contains("MachineGuid") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(last) = parts.last() {
                let trimmed = last.trim();
                if !trimmed.is_empty() && trimmed != "REG_SZ" && trimmed != "MachineGuid" {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

/// 解析 Windows wmic csproduct get uuid 输出。
#[allow(dead_code)]
pub fn parse_wmic_output(output: &str) -> Option<String> {
    for line in output.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() && !trimmed.eq_ignore_ascii_case("uuid") {
            return Some(trimmed.to_string());
        }
    }
    None
}

/// 从平台系统原生能力中提取硬件唯一原始特征标识。
fn query_platform_hardware_raw_id() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("/usr/sbin/ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
            .or_else(|_| {
                Command::new("ioreg")
                    .args(["-rd1", "-c", "IOPlatformExpertDevice"])
                    .output()
            })
            .ok()?;
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(uuid) = parse_ioreg_output(&stdout) {
                return Some(uuid);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // 1. 首选快速读取注册表 MachineGuid（无需管理员权限）
        if let Ok(output) = Command::new("reg")
            .args([
                "query",
                r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography",
                "/v",
                "MachineGuid",
            ])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(guid) = parse_reg_machine_guid(&stdout) {
                    return Some(guid);
                }
            }
        }

        // 2. 备选 wmic csproduct get uuid
        if let Ok(output) = Command::new("wmic")
            .args(["csproduct", "get", "uuid"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(uuid) = parse_wmic_output(&stdout) {
                    return Some(uuid);
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // 1. 首选 systemd machine-id
        if let Ok(content) = fs::read_to_string("/etc/machine-id") {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
        // 2. 备选 dbus machine-id
        if let Ok(content) = fs::read_to_string("/var/lib/dbus/machine-id") {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
        // 3. 备选 DMI product_uuid
        if let Ok(content) = fs::read_to_string("/sys/class/dmi/id/product_uuid") {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}

/// 将原始硬件特征标准化并通过加盐 SHA-256 格式化为统一的硬件唯一编码：
/// 格式：`BV-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX`（32 位十六进制，分 4 组，每组 8 位）
pub fn format_device_id(raw_id: &str) -> String {
    let normalized: String = raw_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_uppercase();

    let mut hasher = Sha256::new();
    hasher.update(HASH_SALT);
    hasher.update(normalized.as_bytes());
    let hash = hasher.finalize();

    let hex = hash
        .iter()
        .take(16)
        .map(|b| format!("{:02X}", b))
        .collect::<String>();

    format!(
        "BV-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..16],
        &hex[16..24],
        &hex[24..32]
    )
}

/// 定位凭证目录下的设备标识存储路径。
fn fallback_device_id_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(credentials_directory(app)?.join(DEVICE_ID_FILE))
}

/// 获取或创建当前机器的硬件唯一编码。
/// 优先通过操作系统底层原生获取；若系统接口受限，则读取或创建持久化的安装标识作为安全兜底。
pub fn get_or_create_device_id(app: &AppHandle) -> Result<String, String> {
    // 1. 尝试从操作系统获取物理硬件 UUID
    if let Some(raw_id) = query_platform_hardware_raw_id() {
        let trimmed = raw_id.trim();
        if !trimmed.is_empty() {
            let formatted = format_device_id(trimmed);
            // 缓存到本地凭证目录供离线使用
            if let Ok(path) = fallback_device_id_path(app) {
                let _ = fs::write(path, &formatted);
            }
            return Ok(formatted);
        }
    }

    // 2. 尝试从本地凭证目录读取已保存的设备标识
    if let Ok(path) = fallback_device_id_path(app) {
        if let Ok(saved) = fs::read_to_string(&path) {
            let trimmed = saved.trim().to_string();
            if trimmed.starts_with("BV-") && trimmed.len() >= 35 {
                return Ok(trimmed);
            }
        }
    }

    // 3. 兜底生成基于时间戳与环境因子的确定性设备标识并写入本地凭证目录
    let fallback_seed = format!(
        "fallback-{}-{}-{:?}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0),
        std::env::consts::ARCH
    );
    let fallback_id = format_device_id(&fallback_seed);
    if let Ok(path) = fallback_device_id_path(app) {
        let _ = fs::write(path, &fallback_id);
    }
    Ok(fallback_id)
}

/// Tauri 命令：获取当前设备的硬件唯一编码。
#[tauri::command]
pub fn get_device_id(app: AppHandle) -> Result<String, String> {
    get_or_create_device_id(&app)
}

/// Tauri 命令：获取当前设备硬件信息。
#[tauri::command]
pub fn get_device_info(app: AppHandle) -> Result<DeviceInfo, String> {
    let device_id = get_or_create_device_id(&app)?;
    let platform = std::env::consts::OS.to_string();
    Ok(DeviceInfo {
        device_id,
        platform,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_macos_ioreg_uuid() {
        let output = r#"
            | |   "IOPlatformSerialNumber" = "C02G1234MD6R"
            | |   "IOPlatformUUID" = "B164354C-677E-5065-8F77-108DCDE212FD"
            | |   "board-id" = <"Mac-AF89B6D8451C490B">
        "#;
        assert_eq!(
            parse_ioreg_output(output).as_deref(),
            Some("B164354C-677E-5065-8F77-108DCDE212FD")
        );
    }

    #[test]
    fn parses_windows_registry_machine_guid() {
        let output = r#"
HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography
    MachineGuid    REG_SZ    d1e4c29b-8d07-4f42-a721-998877665544
        "#;
        assert_eq!(
            parse_reg_machine_guid(output).as_deref(),
            Some("d1e4c29b-8d07-4f42-a721-998877665544")
        );
    }

    #[test]
    fn parses_windows_wmic_uuid() {
        let output = "UUID\r\n4C4C4544-004B-4E10-8057-C2C04F343832\r\n";
        assert_eq!(
            parse_wmic_output(output).as_deref(),
            Some("4C4C4544-004B-4E10-8057-C2C04F343832")
        );
    }

    #[test]
    fn formats_device_id_consistently() {
        let raw_a = "B164354C-677E-5065-8F77-108DCDE212FD";
        let raw_b = "b164354c677e50658f77108dcde212fd"; // lowercase without dashes
        let id_a = format_device_id(raw_a);
        let id_b = format_device_id(raw_b);

        assert_eq!(
            id_a, id_b,
            "Normalization should produce identical ID regardless of casing or dashes"
        );
        assert_eq!(id_a.len(), 38);
        let segments: Vec<&str> = id_a.split('-').collect();
        assert_eq!(segments.len(), 5);
        assert_eq!(segments[0], "BV");
        assert_eq!(segments[1].len(), 8);
        assert_eq!(segments[2].len(), 8);
        assert_eq!(segments[3].len(), 8);
        assert_eq!(segments[4].len(), 8);
    }

    #[test]
    fn different_raw_ids_produce_different_device_ids() {
        let id_1 = format_device_id("UUID-1111-2222-3333-4444");
        let id_2 = format_device_id("UUID-5555-6666-7777-8888");
        assert_ne!(id_1, id_2);
    }
}
