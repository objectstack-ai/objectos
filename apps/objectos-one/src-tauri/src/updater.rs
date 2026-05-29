//! Tauri updater integration.
//!
//! Two paths into this module:
//!   * Background `schedule_update_check` — runs 30s after launch. Stays
//!     silent on the no-news path; on the update-available path it emits
//!     an event the splash WebView listens for and falls back to an OS
//!     notification when the splash is already gone.
//!   * Menu / tray "Check for updates…" — `check_now` command. Always
//!     surfaces *some* visible feedback (info / confirm / error dialog)
//!     because the user explicitly asked for a result. We use the native
//!     dialog plugin instead of OS notifications: dialogs always render
//!     regardless of macOS notification permissions and regardless of
//!     which WebView is currently loaded in the main window.

use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
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
/// so we always show a native dialog with the outcome. The background check
/// (verbose=false) stays silent on the no-news path.
pub async fn check_for_update(app: &AppHandle, verbose: bool) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            log_line("WARN", &format!("updater unavailable: {e}"));
            if verbose {
                show_error(app, &e.to_string());
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
            if verbose {
                // User-initiated: the native confirm dialog below is the
                // single, authoritative prompt. Do NOT emit the in-app card
                // event here — if the splash WebView is still loaded it would
                // surface a second prompt alongside the dialog.
                prompt_install(app, &info).await;
            } else {
                // Background: surface the update silently via the in-app card
                // (the splash WebView listens for this) plus a best-effort OS
                // notification. If the user hasn't granted notification
                // permission the splash event is the only signal — acceptable
                // since the single background check fires 30s after launch
                // while the splash is still up.
                let _ = app.emit("objectos://update-available", &info);
                notify(
                    app,
                    &format!("ObjectOS {} available", info.version),
                    "Open the app and choose Install & Restart, or use the menu.",
                );
            }
        }
        Ok(None) => {
            log_line("INFO", "up to date");
            if verbose {
                show_info(
                    app,
                    "You're up to date",
                    &format!(
                        "ObjectOS {} is the latest version.",
                        app.package_info().version
                    ),
                );
            }
        }
        Err(e) => {
            log_line("WARN", &format!("update check failed: {e}"));
            if verbose {
                show_error(app, &e.to_string());
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

fn show_info(app: &AppHandle, title: &str, body: &str) {
    app.dialog()
        .message(body)
        .title(title)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::Ok)
        .show(|_| {});
}

fn show_error(app: &AppHandle, body: &str) {
    app.dialog()
        .message(format!("Update check failed:\n\n{body}"))
        .title("Update check failed")
        .kind(MessageDialogKind::Error)
        .buttons(MessageDialogButtons::Ok)
        .show(|_| {});
}

/// Confirm-to-install dialog. Triggered from the verbose path so the user
/// always sees *something* after clicking the menu item.
async fn prompt_install(app: &AppHandle, info: &UpdateInfo) {
    let body = match &info.notes {
        Some(notes) if !notes.is_empty() => format!(
            "A new version of ObjectOS is available.\n\n\
             Current: {}\nNew:     {}\n\n{}",
            info.current,
            info.version,
            notes.chars().take(400).collect::<String>(),
        ),
        _ => format!(
            "A new version of ObjectOS is available.\n\n\
             Current: {}\nNew:     {}",
            info.current, info.version,
        ),
    };

    let handle = app.clone();
    app.dialog()
        .message(body)
        .title(format!("ObjectOS {} available", info.version))
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Install & Restart".into(),
            "Later".into(),
        ))
        .show(move |confirmed| {
            if confirmed {
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = run_install(&handle).await {
                        log_line("WARN", &format!("install failed: {e}"));
                        show_error(&handle, &e);
                    }
                });
            }
        });
}

#[tauri::command]
pub async fn check_now(app: AppHandle) {
    check_for_update(&app, true).await;
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    run_install(&app).await
}

/// Shared install path used by both the IPC command (called from the
/// splash UI) and the verbose-check confirm dialog.
async fn run_install(app: &AppHandle) -> Result<(), String> {
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
    sidecar::kill_current(app);
    app.restart();
}
