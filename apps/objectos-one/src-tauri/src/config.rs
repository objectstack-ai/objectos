//! User configuration for ObjectOS One.
//!
//! Model: a flat map of environment variables that get merged into the
//! sidecar process. This intentionally avoids hard-coding "known" config
//! fields — anything the Node server reads from env is configurable.
//!
//! Resolution order (later overrides earlier) for the values handed to the
//! sidecar:
//!   1. Inherited process env (parent shell)
//!   2. `one.config.json` `env` map (user-edited via Settings window)
//!   3. Explicit `OBJECTOS_*` env vars in the parent shell (always win,
//!      so a one-off `OBJECTOS_PORT=4001 open -a ObjectOS` overrides the
//!      saved config)

use std::{collections::BTreeMap, fs, path::PathBuf};

use serde::{Deserialize, Serialize};

pub const CONFIG_FILE: &str = "one.config.json";

/// Persisted user configuration. `env` is the only field on purpose —
/// keeping the schema flat means new server-side env vars don't require any
/// shell change.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StoredConfig {
    /// Environment variables to pass to the sidecar. BTreeMap so the file
    /// stays diff-friendly (sorted keys).
    #[serde(default)]
    pub env: BTreeMap<String, String>,
}

/// Defaults for the data dir when nothing is set.
pub fn default_data_dir() -> PathBuf {
    let mut p = dirs::home_dir().expect("home dir");
    p.push(".objectstack");
    p
}

/// Path to the JSON config file. Lives next to the user data dir so a clean
/// uninstall (rm of data dir) also clears the config.
pub fn config_file_path() -> PathBuf {
    let base = std::env::var("OBJECTOS_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(default_data_dir);
    base.join(CONFIG_FILE)
}

/// Read the config file. Missing → empty config. Malformed → empty config
/// (with a warning) so a typo never bricks the app.
pub fn load() -> StoredConfig {
    let path = config_file_path();
    let Ok(raw) = fs::read_to_string(&path) else {
        return StoredConfig::default();
    };
    match serde_json::from_str::<StoredConfig>(&raw) {
        Ok(cfg) => cfg,
        Err(e) => {
            eprintln!(
                "[one] config: ignoring malformed {} ({e}); using defaults",
                path.display()
            );
            StoredConfig::default()
        }
    }
}

/// Persist the StoredConfig to disk (pretty-printed for hand-edits).
pub fn save(cfg: &StoredConfig) -> std::io::Result<PathBuf> {
    let path = config_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(cfg)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    fs::write(&path, json + "\n")?;
    Ok(path)
}

/// Read an effective env var with the same resolution the sidecar will see.
/// Useful for Rust-side decisions (port binding, data dir creation) that
/// must agree with what the Node process gets.
pub fn effective(key: &str) -> Option<String> {
    // Parent-shell value wins so debug overrides always work.
    if let Ok(v) = std::env::var(key) {
        if !v.is_empty() {
            return Some(v);
        }
    }
    load().env.get(key).cloned()
}

/// Convenience: parse an env var as u16.
pub fn effective_u16(key: &str) -> Option<u16> {
    effective(key).and_then(|s| s.parse().ok())
}

/// Effective host the sidecar will bind to. Default: 127.0.0.1.
pub fn effective_host() -> String {
    effective("HOST").unwrap_or_else(|| "127.0.0.1".to_string())
}

/// Effective data dir. Default: ~/.objectstack.
pub fn effective_data_dir() -> PathBuf {
    effective("OBJECTOS_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(default_data_dir)
}

/// Snapshot returned to the Settings window. Includes the stored map plus
/// indicators for keys that are currently overridden by the parent shell
/// (so the UI can show "(set in shell — saved value ignored)").
#[derive(Debug, Clone, Serialize)]
pub struct ConfigSnapshot {
    pub env: BTreeMap<String, String>,
    pub shell_overrides: BTreeMap<String, String>,
    pub config_path: PathBuf,
}

pub fn snapshot() -> ConfigSnapshot {
    let stored = load();
    let mut shell_overrides = BTreeMap::new();
    for key in stored.env.keys() {
        if let Ok(v) = std::env::var(key) {
            if !v.is_empty() {
                shell_overrides.insert(key.clone(), v);
            }
        }
    }
    ConfigSnapshot {
        env: stored.env,
        shell_overrides,
        config_path: config_file_path(),
    }
}


