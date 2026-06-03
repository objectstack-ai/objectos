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
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

use crate::{logger::log_line, sidecar};

pub static UPDATE_PENDING: AtomicBool = AtomicBool::new(false);

/// True while an update check is running. Guards against a second click (or a
/// background check) starting an overlapping check — which is what let the
/// "Check for updates…" item fire repeatedly with no feedback.
static CHECKING: AtomicBool = AtomicBool::new(false);

/// True while a download+install is running. This is the guard that makes it
/// impossible to launch two installs at once (the cause of multiple installer
/// windows on a slow network).
static INSTALLING: AtomicBool = AtomicBool::new(false);

/// RAII guard over an atomic flag: acquires it via compare-exchange and clears
/// it on drop, so any early return / error path releases it for a later retry.
struct FlagGuard(&'static AtomicBool);

impl FlagGuard {
    /// `Some(guard)` only if we flipped the flag false→true; `None` if it was
    /// already held (i.e. an operation is already in flight).
    fn acquire(flag: &'static AtomicBool) -> Option<FlagGuard> {
        flag.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .ok()
            .map(|_| FlagGuard(flag))
    }
}

impl Drop for FlagGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

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
    // Only one check at a time. A second click (or a background check racing a
    // manual one) is ignored rather than stacking another network call + dialog.
    let Some(_check_guard) = FlagGuard::acquire(&CHECKING) else {
        log_line("INFO", "update check already running; ignoring duplicate request");
        return;
    };
    // Give the user immediate feedback that the click registered.
    if verbose {
        let _ = app.emit("objectos://update-checking", true);
    }

    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            log_line("WARN", &format!("updater unavailable: {e}"));
            if verbose {
                let _ = app.emit("objectos://update-checking", false);
                show_error(app, &e.to_string());
            }
            return;
        }
    };
    let outcome = updater.check().await;
    // Clear the "checking" indicator before surfacing the result.
    if verbose {
        let _ = app.emit("objectos://update-checking", false);
    }
    match outcome {
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
    // Single install ever. A second invocation (double-click, or both the
    // splash card and the injected banner firing) is a no-op while one runs —
    // this is what prevents two downloads / two installer windows.
    let Some(_install_guard) = FlagGuard::acquire(&INSTALLING) else {
        log_line("INFO", "install already in progress; ignoring duplicate request");
        return Ok(());
    };

    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no update available".to_string())?;
    let _ = app.emit("objectos://update-installing", &update.version);

    // Stream download progress to the UI so the user can see it's working and
    // doesn't click again.
    let app_progress = app.clone();
    let downloaded = Arc::new(AtomicU64::new(0));
    let counter = downloaded.clone();
    update
        .download_and_install(
            move |chunk, total| {
                let so_far = counter.fetch_add(chunk as u64, Ordering::SeqCst) + chunk as u64;
                let pct = total.map(|t| if t > 0 { ((so_far * 100) / t).min(100) } else { 0 });
                let _ = app_progress.emit(
                    "objectos://update-progress",
                    serde_json::json!({ "downloaded": so_far, "total": total, "pct": pct }),
                );
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    // Make sure the sidecar is gone before the relaunch swaps the binary.
    sidecar::SHUTTING_DOWN.store(true, Ordering::SeqCst);
    sidecar::kill_current(app);
    app.restart();
}
