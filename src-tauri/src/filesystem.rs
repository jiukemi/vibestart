use std::fs;
use std::path::PathBuf;

#[derive(Debug, serde::Serialize, Clone)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct DirectoryListing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<DirEntry>,
}

fn home_root() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "无法获取用户主目录".to_string())
}

fn resolve_within_home(path: &str) -> Result<PathBuf, String> {
    let home = home_root()?;
    let home_canon = home
        .canonicalize()
        .map_err(|e| format!("无法解析主目录: {e}"))?;

    let trimmed = path.trim();
    let target = if trimmed.is_empty() {
        home_canon.clone()
    } else {
        let p = PathBuf::from(trimmed);
        if p.is_absolute() {
            p
        } else {
            home_canon.join(p)
        }
    };

    let canonical = target
        .canonicalize()
        .map_err(|e| format!("无法读取目录: {e}"))?;

    if !canonical.starts_with(&home_canon) {
        return Err("只能浏览你的个人文件夹及其子目录".into());
    }

    Ok(canonical)
}

pub fn list_directory(path: &str) -> Result<DirectoryListing, String> {
    let home_canon = home_root()?.canonicalize().map_err(|e| e.to_string())?;
    let current = resolve_within_home(path)?;
    let parent = current
        .parent()
        .filter(|p| p.starts_with(&home_canon))
        .map(|p| p.to_string_lossy().into_owned());

    let mut entries = Vec::new();
    for entry in fs::read_dir(&current).map_err(|e| format!("无法列出目录: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let entry_path = entry
            .path()
            .canonicalize()
            .unwrap_or_else(|_| entry.path());
        entries.push(DirEntry {
            name,
            path: entry_path.to_string_lossy().into_owned(),
        });
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(DirectoryListing {
        path: current.to_string_lossy().into_owned(),
        parent,
        entries,
    })
}

pub fn create_subdirectory(parent_path: &str, folder_name: &str) -> Result<DirEntry, String> {
    let parent = resolve_within_home(parent_path)?;
    let name = folder_name.trim();
    if name.is_empty() {
        return Err("文件夹名称不能为空".into());
    }
    if name.contains(['/', '\\']) || name.contains("..") || name.starts_with('.') {
        return Err("文件夹名称不合法".into());
    }

    let target = parent.join(name);
    if target.exists() {
        if target.is_dir() {
            let path = target
                .canonicalize()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .into_owned();
            return Ok(DirEntry {
                name: name.to_string(),
                path,
            });
        }
        return Err(format!("「{name}」已存在且不是文件夹"));
    }

    fs::create_dir_all(&target).map_err(|e| format!("创建文件夹失败: {e}"))?;
    let path = target
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();

    Ok(DirEntry {
        name: name.to_string(),
        path,
    })
}
