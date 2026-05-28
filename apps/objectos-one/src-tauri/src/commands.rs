//! Tauri commands invoked from the settings window / injected scripts.

use std::collections::BTreeMap;

use tauri::{AppHandle, Emitter};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

use crate::{config, logger, paths, sidecar};

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
