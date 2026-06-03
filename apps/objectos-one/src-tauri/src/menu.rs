//! Menu construction (tray context menu + app menu bar).
//!
//! Both surfaces share `handle_menu_id` so the menu IDs stay in sync. macOS
//! reads the first submenu as the "application menu", so that's where the
//! standard About / Settings / Quit items live.

use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

use tauri::{
    menu::{AboutMetadataBuilder, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Wry,
};
use tauri_plugin_opener::OpenerExt;

use crate::{logger, paths, sidecar, updater, windows};

/// A single menu click is delivered to BOTH the tray's own `on_menu_event` and
/// the global app `on_menu_event`, so every action would otherwise run twice —
/// popping two dialogs, opening two Finder windows, etc. Track the last event
/// and drop a repeat of the same id within a short window.
static LAST_MENU_EVENT: Mutex<Option<(String, Instant)>> = Mutex::new(None);
const MENU_DEDUP_WINDOW: Duration = Duration::from_millis(400);

fn is_duplicate_event(id: &str) -> bool {
    let now = Instant::now();
    let mut guard = LAST_MENU_EVENT.lock().unwrap();
    if let Some((last_id, last_at)) = guard.as_ref() {
        if last_id == id && now.duration_since(*last_at) < MENU_DEDUP_WINDOW {
            return true;
        }
    }
    *guard = Some((id.to_string(), now));
    false
}

/// Central dispatch for both menus.
pub fn handle_menu_id(app: &AppHandle, id: &str) {
    if is_duplicate_event(id) {
        return;
    }
    match id {
        "open" => windows::focus_main(app),
        "reload" => windows::reload_main(app),
        "restart" => sidecar::start_or_restart(app),
        "data" => {
            let _ = app
                .opener()
                .open_path(paths::data_dir().to_string_lossy(), None::<&str>);
        }
        "logs" => {
            if let Some(dir) = logger::log_dir() {
                let _ = app
                    .opener()
                    .open_path(dir.to_string_lossy().to_string(), None::<&str>);
            }
        }
        "settings" => windows::open_settings(app),
        "update" => {
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                updater::check_for_update(&handle, true).await;
            });
        }
        "quit" => {
            sidecar::SHUTTING_DOWN.store(true, std::sync::atomic::Ordering::SeqCst);
            sidecar::kill_current(app);
            app.exit(0);
        }
        _ => {}
    }
}

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Open ObjectOS", true, None::<&str>)?;
    let reload_item =
        MenuItem::with_id(app, "reload", "Reload page", true, Some("CmdOrCtrl+R"))?;
    let restart_item = MenuItem::with_id(app, "restart", "Restart runtime", true, None::<&str>)?;
    let data_item = MenuItem::with_id(app, "data", "Open data folder", true, None::<&str>)?;
    let logs_item = MenuItem::with_id(app, "logs", "Reveal logs", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let update_item =
        MenuItem::with_id(app, "update", "Check for updates…", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open_item,
            &reload_item,
            &restart_item,
            &data_item,
            &logs_item,
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
        .on_menu_event(|app, event| handle_menu_id(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                windows::focus_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

pub fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let pkg = app.package_info();

    let about_meta = AboutMetadataBuilder::new()
        .name(Some(pkg.name.clone()))
        .version(Some(pkg.version.to_string()))
        .website(Some("https://objectstack.ai".to_string()))
        .copyright(Some("Copyright © ObjectStack".to_string()))
        .build();
    let about_item =
        PredefinedMenuItem::about(app, Some(&format!("About {}", pkg.name)), Some(about_meta))?;
    let update_item =
        MenuItem::with_id(app, "update", "Check for updates…", true, None::<&str>)?;
    let settings_item =
        MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
    let services_item = PredefinedMenuItem::services(app, None)?;
    let hide_item = PredefinedMenuItem::hide(app, None)?;
    let hide_others_item = PredefinedMenuItem::hide_others(app, None)?;
    let quit_item = PredefinedMenuItem::quit(app, None)?;
    let sep = || PredefinedMenuItem::separator(app);

    let app_submenu = Submenu::with_items(
        app,
        &pkg.name,
        true,
        &[
            &about_item,
            &sep()?,
            &update_item,
            &sep()?,
            &settings_item,
            &sep()?,
            &services_item,
            &sep()?,
            &hide_item,
            &hide_others_item,
            &sep()?,
            &quit_item,
        ],
    )?;

    let reload_item = MenuItem::with_id(app, "reload", "Reload Page", true, Some("CmdOrCtrl+R"))?;
    let fullscreen_item = PredefinedMenuItem::fullscreen(app, None)?;
    let view_submenu =
        Submenu::with_items(app, "View", true, &[&reload_item, &fullscreen_item])?;

    // Standard Edit submenu — without this, ⌘C/⌘V/⌘X/⌘Z/⌘A stop working.
    let edit_submenu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &sep()?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    // Standard Window submenu — minimize / zoom / front.
    let window_submenu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &sep()?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let restart_item = MenuItem::with_id(app, "restart", "Restart Runtime", true, None::<&str>)?;
    let data_item = MenuItem::with_id(app, "data", "Open Data Folder", true, None::<&str>)?;
    let logs_item = MenuItem::with_id(app, "logs", "Reveal Logs", true, None::<&str>)?;
    let runtime_submenu = Submenu::with_items(
        app,
        "Runtime",
        true,
        &[&restart_item, &data_item, &logs_item],
    )?;

    Menu::with_items(
        app,
        &[
            &app_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
            &runtime_submenu,
        ],
    )
}
