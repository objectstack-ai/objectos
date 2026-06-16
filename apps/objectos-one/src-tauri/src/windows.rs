//! Window builders + lifecycle helpers.
//!
//! Main window is created in code (not tauri.conf.json) so we can attach an
//! initialization script that forwards update events to the user even after
//! the splash page is navigated away.

use tauri::{
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
use url::Url;

use crate::{logger::log_line, sidecar};

/// Bootstrap script injected into every page the main webview loads.
///
/// It listens for `objectos://update-available` / `objectos://update-installing`
/// and renders a non-intrusive bottom-right toast — so the user sees update
/// prompts even after navigating to the running runtime (which would
/// otherwise discard the splash page's listeners).
const UPDATE_BANNER_JS: &str = include_str!("../assets/update-banner.js");

/// Mirrors the Console's in-app inbox to native OS notifications when the
/// window is backgrounded (and keeps the dock badge in sync). Injected into
/// every page; it no-ops outside the Console and outside Tauri.
const NOTIFICATION_BRIDGE_JS: &str = include_str!("../assets/notification-bridge.js");

pub fn build_main(app: &AppHandle) -> tauri::Result<()> {
    let app_handle = app.clone();
    // Combine the injected bootstrap scripts into one so both reliably run on
    // every page the webview loads.
    let bootstrap = format!("{UPDATE_BANNER_JS}\n{NOTIFICATION_BRIDGE_JS}");
    let _win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("ObjectOS")
        .inner_size(1280.0, 820.0)
        .min_inner_size(960.0, 600.0)
        .resizable(true)
        .center()
        .initialization_script(bootstrap.as_str())
        .on_navigation(move |url| {
            if is_external_link(url) {
                use tauri_plugin_opener::OpenerExt;
                let _ = app_handle.opener().open_url(url.as_str(), None::<&str>);
                return false;
            }
            true
        })
        .build()?;
    Ok(())
}

fn is_external_link(url: &Url) -> bool {
    // Allow the splash (tauri://, asset:// etc.) and local runtime.
    let host = url.host_str().unwrap_or("");
    let scheme = url.scheme();
    if scheme == "http" || scheme == "https" {
        return !(host == "localhost" || host == "127.0.0.1");
    }
    // tauri:// / asset:// / data: all stay in-app.
    false
}

pub fn focus_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

pub fn reload_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.eval("window.location.reload()");
    }
}

pub fn open_settings(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return;
    }
    let builder = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("prefs.html".into()))
        .title("ObjectOS Settings")
        .inner_size(640.0, 560.0)
        .min_inner_size(520.0, 420.0)
        .resizable(true);
    if let Err(e) = builder.build() {
        log_line("WARN", &format!("settings window failed: {e}"));
        let _ = app.emit("objectos://log", format!("settings window failed: {e}"));
    }
}

/// Final shutdown — kill sidecar and exit.
pub fn shutdown(app: &AppHandle) {
    sidecar::SHUTTING_DOWN.store(true, std::sync::atomic::Ordering::SeqCst);
    sidecar::kill_current(app);
}
