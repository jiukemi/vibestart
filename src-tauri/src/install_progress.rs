use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgressPayload {
    pub phase: String,
    pub message: String,
    pub percent: Option<u8>,
    pub indeterminate: bool,
}

pub fn emit(
    app: Option<&AppHandle>,
    phase: &str,
    message: &str,
    percent: Option<u8>,
) {
    let Some(app) = app else { return };
    let _ = app.emit(
        "install-progress",
        InstallProgressPayload {
            phase: phase.to_string(),
            message: message.to_string(),
            percent,
            indeterminate: percent.is_none(),
        },
    );
}

pub fn begin(app: Option<&AppHandle>, tool: &str) {
    emit(app, "start", &format!("开始安装 {tool}…"), Some(0));
}

pub fn finish(app: Option<&AppHandle>, success: bool) {
    if success {
        emit(app, "done", "安装完成", Some(100));
    } else {
        emit(app, "error", "安装未完成", None);
    }
}

pub fn append_log(app: Option<&AppHandle>, line: &str) {
    let Some(app) = app else { return };
    let _ = app.emit("install-log", line.to_string());
}
