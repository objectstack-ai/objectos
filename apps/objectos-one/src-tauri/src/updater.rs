//! Tauri updater integration.
//!
//! Two paths into this module:
//!   * Background `schedule_update_check` — runs 30s after launch.
//!   * Menu / tray "Check for updates…" — `check_now` command.
//!
//! All UI affordances go through events on the AppHandle so they can fan
//! out to: the splash WebView, an injected listener in the main WebView
//! (once it's navigated to the running runtime), and a native system
//! notification.

use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

use crate::{logger::log_line, sidecar};

pub static UPDATE_PENDING: AtomicBool = AtomicBool::new(false);

#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub current: String,
    pub notes: Option<String>,
}

/// Kick off the first auto-check 30s after launch (gives the sidecar room).
pub fn schedule_update_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(30)).await;
        check_for_update(&app, false).await;
    });
}

/// Run an update check.
///
/// `verbose=true` means the user explicitly clicked "Check for updates…",
/// so we also surface "already up to date" / "check failed" via a system
/// notification. The background check stays silent on the no-news path.
pub async fn check_for_update(app: &AppHandle, verbose: bool) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            log_line("WARN", &format!("updater unavailable: {e}"));
            if verbose {
                notify(app, "Update check failed", &e.to_string());
            }
            return;
        }
    };
    match updater.check().await {
        Ok(Some(update)) => {
            UPDATE_PENDING.store(true, Ordering::SeqCst);
            let info = UpdateInfo {
                version: update.version.clone(),
                current: update.current_version.clone(),
                notes: update.body.clone(),
            };
            log_line(
                "INFO",
                &format!("update available: {} → {}", info.current, info.version),
            );
            let _ = app.emit("objectos://update-available", &info);
            // Always notify on this path — the splash listener may be gone.
            notify(
                app,
                &format!("ObjectOS {} available", info.version),
                "Open the app and choose Install & Restart, or use the menu.",
            );
        }
        Ok(None) => {
            log_line("INFO", "up to date");
            if verbose {
                notify(app, "ObjectOS is up to date", "You're on the latest version.");
            }
        }
        Err(e) => {
            log_line("WARN", &format!("update check failed: {e}"));
            if verbose {
                notify(app, "Update check failed", &e.to_string());
            }
        }
    }
}

fn notify(app: &AppHandle, title: &str, body: &str) {
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();
}

#[tauri::command]
pub async fn check_now(app: AppHandle) {
    check_for_update(&app, true).await;
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no update available".to_string())?;
    let _ = app.emit("objectos://update-installing", &update.version);
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
    // Make sure the sidecar is gone before the relaunch swaps the binary.
    sidecar::SHUTTING_DOWN.store(true, Ordering::SeqCst);
    sidecar::kill_current(&app);
    app.restart();
}
