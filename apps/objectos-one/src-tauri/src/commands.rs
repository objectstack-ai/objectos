//! Tauri commands invoked from the settings window / injected scripts.

use std::collections::BTreeMap;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use crate::{config, logger, paths, sidecar};

/// Post a native OS notification (macOS Notification Center / Windows toast /
/// Linux libnotify). Invoked by the injected notification bridge when a new
/// inbox message arrives while the window is backgrounded.
#[tauri::command]
pub fn notify_native(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

/// Set (or clear, with `None`) the dock/taskbar unread badge.
#[tauri::command]
pub fn set_badge(app: AppHandle, count: Option<i64>) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.set_badge_count(count).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Ask the OS for notification authorization (no-op once the user has decided).
/// Called once when the Console loads, so the prompt appears in the foreground.
#[tauri::command]
pub fn notif_request_permission(app: AppHandle) -> Result<(), String> {
    app.notification()
        .request_permission()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_config_snapshot() -> config::ConfigSnapshot {
    config::snapshot()
}

#[tauri::command]
pub fn save_config(
    app: AppHandle,
    env: BTreeMap<String, String>,
) -> Result<config::ConfigSnapshot, String> {
    let cfg = config::StoredConfig { env };
    let path = config::save(&cfg).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "objectos://log",
        format!(
            "saved config to {} (restart runtime to apply)",
            path.display()
        ),
    );
    Ok(config::snapshot())
}

#[tauri::command]
pub fn restart_runtime(app: AppHandle) {
    sidecar::start_or_restart(&app);
}

#[tauri::command]
pub fn reveal_logs(app: AppHandle) -> Result<(), String> {
    let dir = logger::log_dir().unwrap_or_else(paths::log_dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_data_dir(app: AppHandle) -> Result<(), String> {
    app.opener()
        .open_path(paths::data_dir().to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn autostart_get(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn autostart_set(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let mgr = app.autolaunch();
    if enabled {
        mgr.enable().map_err(|e| e.to_string())?;
    } else {
        mgr.disable().map_err(|e| e.to_string())?;
    }
    mgr.is_enabled().map_err(|e| e.to_string())
}
