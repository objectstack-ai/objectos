//! ObjectOS Desktop — Tauri shell.
//!
//! Responsibilities:
//!   * Resolve the bundled Node runtime + the `@objectos/app` tree (staged
//!     under `<resource_dir>/runtime/`).
//!   * Spawn the Node sidecar (`desktop.mjs`), inheriting environment +
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

use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};

/// Process handle for the Node sidecar so we can kill it on shutdown.
struct Sidecar(Mutex<Option<Child>>);

/// Port the sidecar is actually listening on (0 until known).
static PORT: AtomicU16 = AtomicU16::new(0);

fn user_data_dir() -> PathBuf {
    if let Ok(p) = std::env::var("OBJECTOS_HOME") {
        return PathBuf::from(p);
    }
    #[cfg(target_os = "macos")]
    {
        let mut p = dirs::home_dir().expect("home dir");
        p.push("Library");
        p.push("Application Support");
        p.push("ObjectOS");
        return p;
    }
    #[cfg(target_os = "windows")]
    {
        let mut p = dirs::data_dir().expect("data dir");
        p.push("ObjectOS");
        return p;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let mut p = dirs::data_dir().expect("data dir");
        p.push("objectos");
        return p;
    }
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

fn pick_free_port(start: u16) -> u16 {
    for port in start..start + 100 {
        if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    0
}

fn wait_until_ready(port: u16, deadline: Instant) -> bool {
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(
            &format!("127.0.0.1:{port}").parse().unwrap(),
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
        if candidate.join("app").join("desktop.mjs").exists() {
            return Ok(candidate);
        }
    }
    // 2. Dev: <CARGO_MANIFEST_DIR>/../runtime (stage-runtime.mjs output)
    if let Some(manifest) = option_env!("CARGO_MANIFEST_DIR") {
        let candidate = PathBuf::from(manifest).join("..").join("runtime");
        if candidate.join("app").join("desktop.mjs").exists() {
            return Ok(candidate.canonicalize().unwrap_or(candidate));
        }
    }
    Err("runtime not staged — run `pnpm --filter @objectos/desktop stage`".into())
}

fn spawn_sidecar(app: &AppHandle) -> Result<Child, String> {
    let runtime_dir = locate_runtime_dir(app)?;
    let node = node_binary(&runtime_dir);
    let entry = runtime_dir.join("app").join("desktop.mjs");

    if !node.exists() {
        return Err(format!("node binary not found at {}", node.display()));
    }
    if !entry.exists() {
        return Err(format!("desktop.mjs not found at {}", entry.display()));
    }

    let data = user_data_dir();
    std::fs::create_dir_all(&data).ok();

    let port = pick_free_port(3000);
    if port == 0 {
        return Err("no free port available".into());
    }
    PORT.store(port, Ordering::SeqCst);

    let mut cmd = Command::new(&node);
    cmd.arg(&entry)
        .env("OBJECTOS_HOME", &data)
        .env("PORT", port.to_string())
        // The launcher itself will open a browser; suppress that since the
        // Tauri WebView is the UI.
        .env("OBJECTOS_NO_OPEN", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

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
        thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(120);
            if wait_until_ready(port, deadline) {
                let url = format!("http://localhost:{port}");
                let _ = app.emit("objectos://ready", &url);
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.eval(&format!("window.location.replace('{url}')"));
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Sidecar(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            match spawn_sidecar(&handle) {
                Ok(child) => {
                    let state: tauri::State<Sidecar> = app.state();
                    *state.0.lock().unwrap() = Some(child);
                }
                Err(e) => {
                    eprintln!("[desktop] sidecar failed: {e}");
                    let _ = handle.emit("objectos://log", format!("sidecar failed: {e}"));
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                let state: tauri::State<Sidecar> = app.state();
                let taken = state.0.lock().unwrap().take();
                if let Some(mut child) = taken {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let state: tauri::State<Sidecar> = app.state();
                let taken = state.0.lock().unwrap().take();
                if let Some(mut child) = taken {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}
