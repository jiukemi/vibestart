use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct SshKeyInfo {
    pub exists: bool,
    pub public_key: Option<String>,
    pub key_path: String,
}

pub fn ensure_key() -> Result<SshKeyInfo, String> {
    let home = dirs::home_dir().ok_or("No home dir")?;
    let key_path = home.join(".ssh/id_ed25519");

    if !key_path.exists() {
        std::fs::create_dir_all(home.join(".ssh")).map_err(|e| e.to_string())?;
        let output = crate::tools_install::new_subprocess("ssh-keygen")
            .args(["-t", "ed25519", "-f"])
            .arg(&key_path)
            .args(["-N", ""])
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("ssh-keygen failed: {stderr}"));
        }
    }

    let pub_key = std::fs::read_to_string(key_path.with_extension("pub")).ok();

    Ok(SshKeyInfo {
        exists: key_path.exists(),
        public_key: pub_key,
        key_path: key_path.to_string_lossy().to_string(),
    })
}

pub fn test_gitee() -> Result<String, String> {
    let out = crate::tools_install::new_subprocess("ssh")
        .args(["-T", "-o", "StrictHostKeyChecking=accept-new", "git@gitee.com"])
        .output()
        .map_err(|e| e.to_string())?;

    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );

    Ok(combined)
}

pub fn test_github() -> Result<String, String> {
    let out = crate::tools_install::new_subprocess("ssh")
        .args(["-T", "-o", "StrictHostKeyChecking=accept-new", "git@github.com"])
        .output()
        .map_err(|e| e.to_string())?;

    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );

    Ok(combined)
}
