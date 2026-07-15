//! ObjectOS One — Tauri shell entry point.
//!
//! See per-module docs for responsibilities. This file only wires the
//! plugins, builds the windows, and registers the cross-cutting handlers.

mod commands;
mod config;
mod logger;
mod menu;
mod paths;
mod sidecar;
mod updater;
mod windows;

use std::sync::Mutex;

use tauri::{RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

use crate::sidecar::Sidecar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Second instance: focus the existing window instead of starting again.
            windows::focus_main(app);
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(Sidecar(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            updater::install_update,
            updater::check_now,
            commands::get_config_snapshot,
            commands::save_config,
            commands::restart_runtime,
            commands::reveal_logs,
            commands::open_data_dir,
            commands::autostart_get,
            commands::autostart_set,
            commands::notify_native,
            commands::set_badge,
            commands::notif_request_permission,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Logger first so every later step can log to disk.
            logger::init(paths::log_dir());
            std::panic::set_hook(Box::new(|info| {
                logger::log_line("PANIC", &format!("{info}"));
            }));
            logger::log_line(
                "INFO",
                &format!("ObjectOS One v{} starting", handle.package_info().version),
            );

            // Build the main window in code so the init script is attached.
            if let Err(e) = windows::build_main(&handle) {
                logger::log_line("ERROR", &format!("main window failed: {e}"));
            }

            // Start sidecar + supervisor.
            sidecar::start_or_restart(&handle);
            sidecar::start_supervisor(handle.clone());

            // Tray + app menu.
            if let Err(e) = menu::build_tray(&handle) {
                logger::log_line("ERROR", &format!("tray setup failed: {e}"));
            }
            match menu::build_app_menu(&handle) {
                Ok(m) => {
                    if let Err(e) = handle.set_menu(m) {
                        logger::log_line("ERROR", &format!("set_menu failed: {e}"));
                    }
                    handle
                        .on_menu_event(|app, event| menu::handle_menu_id(app, event.id.as_ref()));
                }
                Err(e) => logger::log_line("ERROR", &format!("app menu setup failed: {e}")),
            }

            // First auto-update probe (delayed).
            updater::schedule_update_check(handle.clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            // Close-to-tray for the main window so the runtime keeps serving.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                windows::shutdown(app);
            }
        });
}
