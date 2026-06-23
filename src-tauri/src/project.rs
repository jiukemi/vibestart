use std::fs;
use std::path::{Path, PathBuf};

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
