//! Filesystem locations used by the shell.

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::config;

/// Effective user data dir (honors `OBJECTOS_HOME`).
pub fn data_dir() -> PathBuf {
    config::effective_data_dir()
}

/// Log directory under the data dir.
pub fn log_dir() -> PathBuf {
    data_dir().join("logs")
}

/// Resolve the staged Node runtime directory.
///
/// Tries the bundled resource dir first (production), then `CARGO_MANIFEST_DIR/runtime`
/// for `cargo run` / `tauri dev`.
pub fn locate_runtime_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(res) = app.path().resource_dir() {
        let candidate = res.join("runtime");
        if candidate.join("app").join("one.mjs").exists() {
            return Ok(candidate);
        }
    }
    if let Some(manifest) = option_env!("CARGO_MANIFEST_DIR") {
        let candidate = PathBuf::from(manifest).join("runtime");
        if candidate.join("app").join("one.mjs").exists() {
            return Ok(candidate.canonicalize().unwrap_or(candidate));
        }
    }
    Err("runtime not staged — run `pnpm --filter @objectos/one stage`".into())
}

/// Platform-specific Node binary inside the staged runtime.
pub fn node_binary(runtime_dir: &PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        runtime_dir.join("node.exe")
    }
    #[cfg(not(windows))]
    {
        runtime_dir.join("node")
    }
}
