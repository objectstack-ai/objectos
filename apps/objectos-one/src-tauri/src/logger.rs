//! Tiny file logger for ObjectOS One.
//!
//! Why roll our own: pulling in `log` + `simplelog` + `chrono` bloats the
//! binary noticeably and we only need three things:
//!
//!   1. One line per event with a coarse timestamp.
//!   2. Daily file rotation (`one-YYYY-MM-DD.log`).
//!   3. A best-effort size cap per file (so a crash-loop can't fill the disk).
//!
//! The logger is process-global; callers go through `log_line()`.

use std::{
    fs::{File, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

/// Hard ceiling per log file. Past this we truncate-and-rotate within the
/// same day rather than chasing weeks of rollover edge cases.
const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;

struct Sink {
    dir: PathBuf,
    /// (date_yyyymmdd, handle).
    current: Option<(String, File)>,
}

static SINK: OnceLock<Mutex<Sink>> = OnceLock::new();

/// Initialize the logger. Safe to call once; subsequent calls are no-ops.
pub fn init(log_dir: PathBuf) {
    let _ = std::fs::create_dir_all(&log_dir);
    SINK.get_or_init(|| {
        Mutex::new(Sink {
            dir: log_dir,
            current: None,
        })
    });
}

/// Resolve the directory the logger is writing to (if initialized).
pub fn log_dir() -> Option<PathBuf> {
    SINK.get()
        .and_then(|m| m.lock().ok().map(|s| s.dir.clone()))
}

/// Append a single line to today's log file. Mirrors to stderr so `cargo run`
/// users still see output.
pub fn log_line(level: &str, msg: &str) {
    let stamp = format_utc_now();
    let line = format!("{stamp} [{level}] {msg}\n");
    eprint!("{line}");
    if let Some(mu) = SINK.get() {
        if let Ok(mut sink) = mu.lock() {
            let _ = sink.write_line(&line);
        }
    }
}

impl Sink {
    fn write_line(&mut self, line: &str) -> std::io::Result<()> {
        let today = today_yyyymmdd();
        let needs_open = match &self.current {
            None => true,
            Some((d, _)) if d != &today => true,
            Some((_, f)) => f.metadata().map(|m| m.len() > MAX_FILE_BYTES).unwrap_or(false),
        };
        if needs_open {
            let path = self.dir.join(format!("one-{today}.log"));
            // If the file already exceeds the cap (same-day rollover) we
            // truncate; otherwise append. Past days always append.
            let truncate = path
                .metadata()
                .map(|m| m.len() > MAX_FILE_BYTES)
                .unwrap_or(false);
            let mut opts = OpenOptions::new();
            opts.create(true).write(true);
            if truncate {
                opts.truncate(true);
            } else {
                opts.append(true);
            }
            let f = opts.open(&path)?;
            self.current = Some((today, f));
        }
        if let Some((_, f)) = self.current.as_mut() {
            f.write_all(line.as_bytes())?;
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Time helpers (no chrono dependency)
// ---------------------------------------------------------------------------

fn unix_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn today_yyyymmdd() -> String {
    let (y, m, d, _, _, _) = civil_from_unix(unix_seconds());
    format!("{y:04}-{m:02}-{d:02}")
}

fn format_utc_now() -> String {
    let (y, m, d, h, mi, s) = civil_from_unix(unix_seconds());
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

/// Howard Hinnant's days-from-civil algorithm. Returns (year, month, day,
/// hour, minute, second) in UTC. Pure arithmetic — no system locale.
fn civil_from_unix(secs: i64) -> (i32, u32, u32, u32, u32, u32) {
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let h = (rem / 3600) as u32;
    let mi = ((rem % 3600) / 60) as u32;
    let s = (rem % 60) as u32;

    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let year = (y + if m <= 2 { 1 } else { 0 }) as i32;
    (year, m, d, h, mi, s)
}
