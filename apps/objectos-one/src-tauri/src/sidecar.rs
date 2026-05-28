//! Sidecar (Node) process supervision.
//!
//! Responsibilities:
//!   * Pick a free port (honoring saved `PORT`).
//!   * Spawn `node one.mjs` with the merged env.
//!   * Stream stdout/stderr to both the file log and the splash WebView.
//!   * Watch `child.wait()` — if the process exits unexpectedly, re-spawn
//!     with exponential backoff. After too many failures we surface a fatal
//!     event so the UI can show a "copy logs" button instead of looping
//!     forever.
//!   * Probe `GET /` until the HTTP server actually answers (not just a TCP
//!     accept), then emit `objectos://ready` and navigate the main window.

use std::{
    io::{BufRead, BufReader, Read, Write},
    net::TcpStream,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU16, AtomicU32, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Emitter, Manager};

use crate::{config, logger::log_line, paths};

/// Process handle for the sidecar; held in Tauri state.
pub struct Sidecar(pub Mutex<Option<Child>>);

/// Port the sidecar is actually listening on (0 = unknown).
pub static PORT: AtomicU16 = AtomicU16::new(0);

/// Set to true when the user/app is shutting down. The supervisor checks
/// this before respawning so a clean Quit doesn't trigger restart.
pub static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

/// Monotonic counter of consecutive crash restarts; resets to 0 once the
/// sidecar stays alive longer than `STABLE_AFTER`.
static CRASH_COUNT: AtomicU32 = AtomicU32::new(0);

/// Restart attempts before we give up and ask the user to intervene.
const MAX_CRASH_RESTARTS: u32 = 5;

/// Sidecar considered "healthy" after this much uptime; resets crash count.
const STABLE_AFTER: Duration = Duration::from_secs(60);

pub fn kill_current(app: &AppHandle) {
    let state: tauri::State<Sidecar> = app.state();
    let taken = state.0.lock().unwrap().take();
    if let Some(mut child) = taken {
        let _ = child.kill();
        let _ = child.wait();
    }
}

/// Public entry: kill any running sidecar and start a fresh one with the
/// crash counter reset.
pub fn start_or_restart(app: &AppHandle) {
    SHUTTING_DOWN.store(false, Ordering::SeqCst);
    CRASH_COUNT.store(0, Ordering::SeqCst);
    kill_current(app);
    log_line("INFO", "(re)starting sidecar");
    spawn_supervised(app);
}

fn spawn_supervised(app: &AppHandle) {
    match spawn_sidecar(app) {
        Ok(child) => {
            let state: tauri::State<Sidecar> = app.state();
            *state.0.lock().unwrap() = Some(child);
        }
        Err(e) => {
            log_line("ERROR", &format!("sidecar spawn failed: {e}"));
            let _ = app.emit("objectos://sidecar-fatal", e);
        }
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

/// Probe `/` (or `/healthz` if present) until the server actually responds.
/// A TCP-only check races the HTTP server: the port can be listening before
/// any routes are registered. We do a real GET and look for a status line.
fn wait_until_http_ready(host: &str, port: u16, deadline: Instant) -> bool {
    let probe_host = if host == "0.0.0.0" { "127.0.0.1" } else { host };
    while Instant::now() < deadline {
        if http_get_ok(probe_host, port, "/healthz") || http_get_ok(probe_host, port, "/") {
            return true;
        }
        thread::sleep(Duration::from_millis(300));
    }
    false
}

fn http_get_ok(host: &str, port: u16, path: &str) -> bool {
    let Ok(mut s) = TcpStream::connect_timeout(
        &format!("{host}:{port}").parse().unwrap(),
        Duration::from_millis(500),
    ) else {
        return false;
    };
    let _ = s.set_read_timeout(Some(Duration::from_millis(800)));
    let req = format!(
        "GET {path} HTTP/1.0\r\nHost: {host}\r\nConnection: close\r\nUser-Agent: objectos-one-probe\r\n\r\n"
    );
    if s.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 16];
    let Ok(n) = s.read(&mut buf) else { return false };
    // Accept any HTTP response — even 404 means the server is up.
    buf[..n].starts_with(b"HTTP/")
}

fn spawn_sidecar(app: &AppHandle) -> Result<Child, String> {
    let runtime_dir = paths::locate_runtime_dir(app)?;
    let node = paths::node_binary(&runtime_dir);
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

    let port = match config::effective_u16("PORT") {
        Some(fixed) if std::net::TcpListener::bind((host.as_str(), fixed)).is_ok() => fixed,
        Some(fixed) => {
            log_line(
                "WARN",
                &format!("PORT {fixed} on {host} in use; auto-selecting"),
            );
            pick_free_port(&host, 3000)
        }
        None => pick_free_port(&host, 3000),
    };
    if port == 0 {
        return Err("no free port available".into());
    }
    PORT.store(port, Ordering::SeqCst);

    log_line("INFO", &format!("starting sidecar on {host}:{port}"));
    let _ = app.emit("objectos://log", format!("starting sidecar on {host}:{port}"));

    let mut cmd = Command::new(&node);
    cmd.arg(&entry).stdout(Stdio::piped()).stderr(Stdio::piped());
    for (k, v) in &stored.env {
        cmd.env(k, v);
    }
    cmd.env("OBJECTOS_HOME", &data_dir)
        .env("PORT", port.to_string())
        .env("HOST", &host)
        .env("OBJECTOS_NO_OPEN", "1");

    let mut child = cmd.spawn().map_err(|e| format!("spawn node: {e}"))?;

    if let Some(stdout) = child.stdout.take() {
        let app = app.clone();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                log_line("node", &line);
                let _ = app.emit("objectos://log", line);
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let app = app.clone();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                log_line("node!", &line);
                let _ = app.emit("objectos://log", line);
            }
        });
    }

    // Readiness probe — waits for actual HTTP response, not just TCP open.
    {
        let app = app.clone();
        let host = host.clone();
        thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(120);
            if wait_until_http_ready(&host, port, deadline) {
                let url = format!("http://localhost:{port}/_console/");
                let _ = app.emit("objectos://ready", &url);
                if let Some(win) = app.get_webview_window("main") {
                    match url.parse() {
                        Ok(parsed) => {
                            if let Err(e) = win.navigate(parsed) {
                                log_line("WARN", &format!("navigate failed: {e}"));
                                let _ = win.eval(&format!("window.location.replace('{url}')"));
                            }
                        }
                        Err(e) => log_line("ERROR", &format!("bad url: {e}")),
                    }
                }
            } else {
                log_line(
                    "ERROR",
                    &format!("timeout: server did not respond on port {port}"),
                );
                let _ = app.emit(
                    "objectos://log",
                    format!("timeout: server did not respond on port {port}"),
                );
            }
        });
    }

    Ok(child)
}

/// Spawn a thread that watches the child PID; respawns on unexpected exit.
///
/// Tracking the child is awkward because `Child::wait` consumes the handle
/// and `try_wait` requires `&mut`. We poll the Mutex every few hundred ms.
pub fn start_supervisor(app: AppHandle) {
    thread::spawn(move || {
        let mut last_spawn_at = Instant::now();
        loop {
            thread::sleep(Duration::from_millis(500));
            if SHUTTING_DOWN.load(Ordering::SeqCst) {
                return;
            }
            let exited = {
                let state: tauri::State<Sidecar> = app.state();
                let mut guard = state.0.lock().unwrap();
                match guard.as_mut() {
                    None => false,
                    Some(child) => matches!(child.try_wait(), Ok(Some(_))),
                }
            };
            if !exited {
                if last_spawn_at.elapsed() > STABLE_AFTER {
                    CRASH_COUNT.store(0, Ordering::SeqCst);
                }
                continue;
            }
            if SHUTTING_DOWN.load(Ordering::SeqCst) {
                return;
            }
            let n = CRASH_COUNT.fetch_add(1, Ordering::SeqCst) + 1;
            log_line(
                "WARN",
                &format!("sidecar exited unexpectedly (restart #{n})"),
            );
            let _ = app.emit(
                "objectos://log",
                format!("sidecar exited; restarting (attempt {n}/{MAX_CRASH_RESTARTS})"),
            );

            // Clear the dead handle.
            {
                let state: tauri::State<Sidecar> = app.state();
                *state.0.lock().unwrap() = None;
            }

            if n > MAX_CRASH_RESTARTS {
                log_line("FATAL", "too many crash restarts; giving up");
                let _ = app.emit(
                    "objectos://sidecar-fatal",
                    "Runtime kept crashing; check logs.".to_string(),
                );
                return;
            }

            // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped.
            let backoff = Duration::from_secs(1u64 << (n - 1).min(4));
            thread::sleep(backoff);
            spawn_supervised(&app);
            last_spawn_at = Instant::now();
        }
    });
}
