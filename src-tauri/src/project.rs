use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

/// Resolve pack scaffold directory.
///
/// Lookup order:
/// 1. Bundled resources (`content/packs/{pack_id}/scaffold`) via `tauri.conf.json` bundle.resources
/// 2. `VIBESTART_PACKS_DIR` env var (dev override)
/// 3. `../src/content/packs/{pack_id}/scaffold` relative to cwd (local dev from repo root)
pub fn resolve_pack_scaffold(app: &AppHandle, pack_id: &str) -> Result<PathBuf, String> {
    let resource_path = format!("content/packs/{pack_id}/scaffold");
    if let Ok(path) = app
        .path()
        .resolve(&resource_path, BaseDirectory::Resource)
    {
        if path.exists() {
            return Ok(path);
        }
    }

    if let Ok(dev_root) = std::env::var("VIBESTART_PACKS_DIR") {
        let path = PathBuf::from(dev_root)
            .join(pack_id)
            .join("scaffold");
        if path.exists() {
            return Ok(path);
        }
    }

    let dev_path = PathBuf::from("../src/content/packs")
        .join(pack_id)
        .join("scaffold");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!("Pack scaffold not found for pack_id: {pack_id}"))
}

pub fn init_project(app: &AppHandle, pack_id: &str, target_dir: &str) -> Result<(), String> {
    let scaffold = resolve_pack_scaffold(app, pack_id)?;
    let target = PathBuf::from(target_dir);

    if target.exists() {
        let entries = fs::read_dir(&target)
            .map_err(|e| e.to_string())?
            .count();
        if entries > 0 {
            return Err(format!(
                "Target directory is not empty: {}",
                target.display()
            ));
        }
    } else {
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    }

    copy_dir_recursive(&scaffold, &target)
}

pub fn default_project_dir() -> String {
    dirs::home_dir()
        .map(|home| home.join("Projects").join("my-first-vibe-project"))
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| "~/Projects/my-first-vibe-project".into())
}

pub fn open_in_cursor(project_dir: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if Command::new("open")
            .args(["-a", "Cursor", project_dir])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Ok(());
        }
    }

    Command::new("cursor")
        .arg(project_dir)
        .status()
        .map_err(|e| format!("无法打开 Cursor: {e}"))?
        .success()
        .then_some(())
        .ok_or_else(|| "无法打开 Cursor，请确认已安装 Cursor CLI 或应用".into())
}

pub fn open_local_preview(project_dir: &str) -> Result<(), String> {
    let index = PathBuf::from(project_dir).join("index.html");
    if !index.exists() {
        return Err("index.html 不存在，请先在 Cursor 中完成当前步骤".into());
    }

    let path = index
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .status()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .status()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(&path)
            .status()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn vercel_login() -> Result<String, String> {
    let output = Command::new("vercel")
        .arg("login")
        .output()
        .map_err(|e| format!("无法运行 vercel login: {e}"))?;

    let log = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    if output.status.success() {
        Ok(log)
    } else {
        Err(log)
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Err(format!("Scaffold path is not a directory: {}", src.display()));
    }

    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            fs::create_dir_all(&dst_path).map_err(|e| e.to_string())?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            if let Some(parent) = dst_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
