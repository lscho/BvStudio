use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

fn credentials_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录: {error}"))?
        .join("credentials");
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建凭证目录: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("无法限制凭证目录权限: {error}"))?;
    }
    Ok(directory)
}

fn secret_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    if name.is_empty()
        || !name
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte == b'-')
    {
        return Err("凭证文件名无效".into());
    }
    Ok(credentials_directory(app)?.join(name))
}

fn write_secret_file(path: &Path, value: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("凭证路径无效")?;
    fs::create_dir_all(parent).map_err(|error| format!("无法创建凭证目录: {error}"))?;
    let target_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("凭证路径无效")?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("系统时间无效: {error}"))?
        .as_nanos();
    let temporary = parent.join(format!(".{target_name}-{}-{nonce}.tmp", std::process::id()));
    let mut options = OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let result = (|| {
        let mut file = options
            .open(&temporary)
            .map_err(|error| format!("无法写入凭证文件: {error}"))?;
        file.write_all(value.as_bytes())
            .and_then(|_| file.sync_all())
            .map_err(|error| format!("无法保存凭证文件: {error}"))?;
        #[cfg(windows)]
        if path.exists() {
            fs::remove_file(path).map_err(|error| format!("无法替换凭证文件: {error}"))?;
        }
        fs::rename(&temporary, path).map_err(|error| format!("无法替换凭证文件: {error}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(path, fs::Permissions::from_mode(0o600))
                .map_err(|error| format!("无法限制凭证文件权限: {error}"))?;
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}

pub fn write_secret(app: &AppHandle, name: &str, value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("API Key 不能为空".into());
    }
    write_secret_file(&secret_path(app, name)?, value)
}

pub fn read_secret(app: &AppHandle, name: &str) -> Result<String, String> {
    let value =
        fs::read_to_string(secret_path(app, name)?).map_err(|_| "尚未保存 API Key".to_string())?;
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err("API Key 为空".into());
    }
    Ok(value)
}

pub fn has_secret(app: &AppHandle, name: &str) -> bool {
    secret_path(app, name)
        .ok()
        .and_then(|path| fs::metadata(path).ok())
        .is_some_and(|metadata| metadata.is_file() && metadata.len() > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_replaces_a_private_secret_file() {
        let directory =
            std::env::temp_dir().join(format!("bvideo-secret-test-{}", std::process::id()));
        let path = directory.join("ai-api-key");
        write_secret_file(&path, "first").unwrap();
        write_secret_file(&path, "second").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "second");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        let _ = fs::remove_dir_all(directory);
    }
}
