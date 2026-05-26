//! ObjectOS One — Tauri shell.
//!
//! Responsibilities:
//!   * Resolve the bundled Node runtime + the `@objectos/server` tree (staged
//!     under `<resource_dir>/runtime/`).
//!   * Spawn the Node sidecar (`one.mjs`), inheriting environment +
//!     piping logs.
//!   * Probe `http://127.0.0.1:<port>/` until ready, then navigate the
//!     splash WebView to the live URL.
//!   * Kill the sidecar cleanly on window close / app exit.

use std::{
    io::{BufRead, BufReader},
    net::TcpStream,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicU16, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

mod config;

/// Process handle for the Node sidecar so we can kill it on shutdown.
struct Sidecar(Mutex<Option<Child>>);

/// Port the sidecar is actually listening on (0 until known).
static PORT: AtomicU16 = AtomicU16::new(0);

fn user_data_dir() -> PathBuf {
    config::effective_data_dir()
}

fn node_binary(runtime_dir: &PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        runtime_dir.join("node.exe")
    }
    #[cfg(not(windows))]
    {
        runtime_dir.join("node")
    }
}

fn pick_free_port(host: &str, start: u16) -> u16 {
    for port in start..start + 100 {
        if std::net::TcpListener::bind((host, port)).is_ok() {
            return port;
        }
    }
    0
}

fn wait_until_ready(host: &str, port: u16, deadline: Instant) -> bool {
    // Probe via loopback regardless of bind host (0.0.0.0 is reachable as 127.0.0.1).
    let probe_host = if host == "0.0.0.0" { "127.0.0.1" } else { host };
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(
            &format!("{probe_host}:{port}").parse().unwrap(),
            Duration::from_millis(300),
        )
        .is_ok()
        {
            return true;
        }
        thread::sleep(Duration::from_millis(250));
    }
    false
}

fn locate_runtime_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // 1. Production: bundled under <resource_dir>/runtime
    if let Ok(res) = app.path().resource_dir() {
        let candidate = res.join("runtime");
        if candidate.join("app").join("one.mjs").exists() {
            return Ok(candidate);
        }
    }
    // 2. Dev: <CARGO_MANIFEST_DIR>/runtime (stage-runtime.mjs output)
    if let Some(manifest) = option_env!("CARGO_MANIFEST_DIR") {
        let candidate = PathBuf::from(manifest).join("runtime");
        if candidate.join("app").join("one.mjs").exists() {
            return Ok(candidate.canonicalize().unwrap_or(candidate));
        }
    }
    Err("runtime not staged — run `pnpm --filter @objectos/one stage`".into())
}

fn spawn_sidecar(app: &AppHandle) -> Result<Child, String> {
    let runtime_dir = locate_runtime_dir(app)?;
    let node = node_binary(&runtime_dir);
    let entry = runtime_dir.join("app").join("one.mjs");

    if !node.exists() {
        return Err(format!("node binary not found at {}", node.display()));
    }
    if !entry.exists() {
        return Err(format!("one.mjs not found at {}", entry.display()));
    }

    let stored = config::load();
    let host = config::effective_host();
    let data_dir = config::effective_data_dir();
    std::fs::create_dir_all(&data_dir).ok();

    // Honor a fixed PORT (from saved env or shell), else auto-select.
    let port = match config::effective_u16("PORT") {
        Some(fixed) => {
            if std::net::TcpListener::bind((host.as_str(), fixed)).is_ok() {
                fixed
            } else {
                let _ = app.emit(
                    "objectos://log",
                    format!(
                        "configured PORT {fixed} on {host} is in use; falling back to auto-select"
                    ),
                );
                pick_free_port(&host, 3000)
            }
        }
        None => pick_free_port(&host, 3000),
    };
    if port == 0 {
        return Err("no free port available".into());
    }
    PORT.store(port, Ordering::SeqCst);

    let _ = app.emit(
        "objectos://log",
        format!("starting sidecar on {host}:{port}"),
    );

    let mut cmd = Command::new(&node);
    cmd.arg(&entry).stdout(Stdio::piped()).stderr(Stdio::piped());

    // 1) Apply user-configured env from one.config.json. Set first so the
    //    parent shell can still override anything (Command env order).
    for (k, v) in &stored.env {
        cmd.env(k, v);
    }
    // 2) Forced / derived values (always win over user config — these are
    //    operational, not user choices).
    cmd.env("OBJECTOS_HOME", &data_dir)
        .env("PORT", port.to_string())
        .env("HOST", &host)
        // The launcher itself will open a browser; suppress that since the
        // Tauri WebView is the UI.
        .env("OBJECTOS_NO_OPEN", "1");

    let mut child = cmd.spawn().map_err(|e| format!("spawn node: {e}"))?;

    // Forward logs to the Tauri event bus so the splash page can show them.
    if let Some(stdout) = child.stdout.take() {
        let app = app.clone();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                eprintln!("[node] {line}");
                let _ = app.emit("objectos://log", line);
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let app = app.clone();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                eprintln!("[node:err] {line}");
                let _ = app.emit("objectos://log", line);
            }
        });
    }

    // Wait for the HTTP server to bind, then navigate.
    {
        let app = app.clone();
        let host = host.clone();
        thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(120);
            if wait_until_ready(&host, port, deadline) {
                let url = format!("http://localhost:{port}/_console/");
                let _ = app.emit("objectos://ready", &url);
                if let Some(win) = app.get_webview_window("main") {
                    match url.parse() {
                        Ok(parsed) => {
                            if let Err(e) = win.navigate(parsed) {
                                let _ = app.emit("objectos://log", format!("navigate failed: {e}"));
                                // Fall back to JS — works for same-scheme transitions.
                                let _ = win.eval(&format!("window.location.replace('{url}')"));
                            }
                        }
                        Err(e) => {
                            let _ = app.emit("objectos://log", format!("bad url: {e}"));
                        }
                    }
                }
            } else {
                let _ = app.emit(
                    "objectos://log",
                    format!("timeout: server did not start on port {port}"),
                );
            }
        });
    }

    Ok(child)
}

fn kill_current(app: &AppHandle) {
    let state: tauri::State<Sidecar> = app.state();
    let taken = state.0.lock().unwrap().take();
    if let Some(mut child) = taken {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn start_or_restart(app: &AppHandle) {
    kill_current(app);
    let _ = app.emit("objectos://log", "(re)starting sidecar…".to_string());
    match spawn_sidecar(app) {
        Ok(child) => {
            let state: tauri::State<Sidecar> = app.state();
            *state.0.lock().unwrap() = Some(child);
        }
        Err(e) => {
            eprintln!("[one] sidecar failed: {e}");
            let _ = app.emit("objectos://log", format!("sidecar failed: {e}"));
        }
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Open ObjectOS", true, None::<&str>)?;
    let restart_item = MenuItem::with_id(app, "restart", "Restart runtime", true, None::<&str>)?;
    let data_item = MenuItem::with_id(app, "data", "Open data folder", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let update_item =
        MenuItem::with_id(app, "update", "Check for updates…", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open_item,
            &restart_item,
            &data_item,
            &settings_item,
            &update_item,
            &sep,
            &quit_item,
        ],
    )?;

    TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("ObjectOS")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => focus_main(app),
            "restart" => start_or_restart(app),
            "data" => {
                let _ = app
                    .opener()
                    .open_path(user_data_dir().to_string_lossy(), None::<&str>);
            }
            "settings" => {
                open_settings_window(app);
            }
            "update" => {
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    check_for_update(&handle).await;
                });
            }
            "quit" => {
                kill_current(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn focus_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

// ---------------------------------------------------------------------------
// Auto-update
// ---------------------------------------------------------------------------
//
// 30 seconds after launch we ask `latest.json` whether a newer version is
// out. If so we emit `objectos://update-available` so the splash WebView
// (and the tray menu) can offer an "install & restart" action — driven by
// the `install_update` command below.
//
// The whole thing is gated on `plugins.updater.active` in tauri.conf.json.

static UPDATE_PENDING: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[derive(serde::Serialize, Clone)]
struct UpdateInfo {
    version: String,
    current: String,
    notes: Option<String>,
}

fn schedule_update_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Give the sidecar room to come up first.
        tokio::time::sleep(Duration::from_secs(30)).await;
        check_for_update(&app).await;
    });
}

async fn check_for_update(app: &AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[one] updater unavailable: {e}");
            return;
        }
    };
    match updater.check().await {
        Ok(Some(update)) => {
            UPDATE_PENDING.store(true, std::sync::atomic::Ordering::SeqCst);
            let info = UpdateInfo {
                version: update.version.clone(),
                current: update.current_version.clone(),
                notes: update.body.clone(),
            };
            let _ = app.emit("objectos://update-available", &info);
            eprintln!(
                "[one] update available: {} → {}",
                info.current, info.version
            );
        }
        Ok(None) => {
            eprintln!("[one] up to date");
        }
        Err(e) => {
            eprintln!("[one] update check failed: {e}");
        }
    }
}

#[tauri::command]
async fn check_now(app: AppHandle) {
    check_for_update(&app).await;
}

#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
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
    // Kill our sidecar before Tauri's relaunch swaps the binary.
    kill_current(&app);
    app.restart();
}

// ---------------------------------------------------------------------------
// Settings window + commands
// ---------------------------------------------------------------------------

fn open_settings_window(app: &AppHandle) {
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
        let _ = app.emit("objectos://log", format!("settings window failed: {e}"));
    }
}

#[tauri::command]
fn get_config_snapshot() -> config::ConfigSnapshot {
    config::snapshot()
}

#[tauri::command]
fn save_config(
    app: AppHandle,
    env: std::collections::BTreeMap<String, String>,
) -> Result<config::ConfigSnapshot, String> {
    let cfg = config::StoredConfig { env };
    let path = config::save(&cfg).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "objectos://log",
        format!("saved config to {} (restart runtime to apply)", path.display()),
    );
    Ok(config::snapshot())
}

#[tauri::command]
fn restart_runtime(app: AppHandle) {
    start_or_restart(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Sidecar(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            install_update,
            check_now,
            get_config_snapshot,
            save_config,
            restart_runtime
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            start_or_restart(&handle);
            if let Err(e) = build_tray(&handle) {
                eprintln!("[one] tray setup failed: {e}");
            }
            schedule_update_check(handle.clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                kill_current(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                kill_current(app);
            }
        });
}
