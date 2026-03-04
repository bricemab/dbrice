mod commands;
mod crypto;
mod db;
mod models;
mod ssh;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                db::local::init_db(&app_handle)
                    .await
                    .expect("Failed to initialize local database");
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::check_first_launch,
            commands::auth::setup_master_password,
            commands::auth::verify_master_password,
            commands::auth::change_master_password,
            commands::auth::reset_dbrice,
            // Connections
            commands::connections::get_connections,
            commands::connections::create_connection,
            commands::connections::update_connection,
            commands::connections::delete_connection,
            commands::connections::duplicate_connection,
            commands::connections::get_folders,
            commands::connections::create_folder,
            commands::connections::update_folder,
            commands::connections::delete_folder,
            commands::connections::move_connection_to_folder,
            commands::connections::reorder_connections,
            // MySQL
            commands::mysql::connect,
            commands::mysql::disconnect,
            commands::mysql::execute_query,
            commands::mysql::test_connection,
            commands::mysql::get_databases,
            commands::mysql::get_tables,
            commands::mysql::get_table_columns,
            commands::mysql::get_table_indexes,
            commands::mysql::get_table_foreign_keys,
            commands::mysql::get_table_triggers,
            commands::mysql::get_views,
            commands::mysql::get_procedures,
            commands::mysql::get_functions,
            commands::mysql::get_events,
            commands::mysql::get_create_statement,
            // SSH
            commands::ssh::establish_tunnel,
            commands::ssh::close_tunnel,
            commands::ssh::test_ssh_connection,
            // Schema
            commands::schema::create_table,
            commands::schema::alter_table,
            commands::schema::drop_table,
            commands::schema::truncate_table,
            commands::schema::create_database,
            commands::schema::drop_database,
            commands::schema::get_table_definition,
            commands::schema::apply_table_changes,
            // Routines
            commands::routines::get_routine_definition,
            commands::routines::save_routine,
            commands::routines::drop_routine,
            commands::routines::execute_routine,
            // Users
            commands::users::get_users,
            commands::users::create_user,
            commands::users::update_user,
            commands::users::delete_user,
            commands::users::get_user_privileges,
            commands::users::grant_privileges,
            commands::users::revoke_privileges,
            // Export / Import
            commands::export::export_database,
            commands::import::import_sql,
            // Dashboard
            commands::dashboard::get_server_status,
            commands::dashboard::get_process_list,
            commands::dashboard::kill_process,
            commands::dashboard::get_slow_queries,
            commands::dashboard::get_database_sizes,
            // Logs
            commands::logs::get_logs,
            commands::logs::clear_logs,
            commands::logs::export_logs,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to taskbar instead of closing
                window.hide().unwrap_or_default();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running DBrice");
}
