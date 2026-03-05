use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::aead::OsRng;
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use once_cell::sync::OnceCell;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

fn get_db_path(app: &AppHandle) -> Result<PathBuf> {
    let app_dir = app
        .path()
        .app_data_dir()
        .context("Failed to get app data directory")?;
    std::fs::create_dir_all(&app_dir).context("Failed to create app data directory")?;
    Ok(app_dir.join("dbrice.db"))
}

pub async fn init_db(app: &AppHandle) -> Result<()> {
    let db_path = get_db_path(app)?;
    let conn = Connection::open(&db_path)
        .with_context(|| format!("Failed to open database at {:?}", db_path))?;

    // Enable WAL mode for better concurrent access
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // Run schema
    let schema = include_str!("schema.sql");
    conn.execute_batch(schema)
        .context("Failed to run database schema")?;

    DB.set(Mutex::new(conn))
        .map_err(|_| anyhow::anyhow!("Database already initialized"))?;

    Ok(())
}

pub fn with_db<F, T>(f: F) -> Result<T>
where
    F: FnOnce(&Connection) -> Result<T>,
{
    let db = DB.get().context("Database not initialized")?;
    let conn = db
        .lock()
        .map_err(|e| anyhow::anyhow!("DB lock error: {}", e))?;
    f(&conn)
}

// Settings
pub fn get_setting(key: &str) -> Result<Option<String>> {
    with_db(|conn| {
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    })
}

/// Returns the global app encryption salt, creating it on first call.
/// This salt is used to derive the session AES key from the master password.
pub fn get_or_create_app_salt() -> Result<Vec<u8>> {
    if let Some(b64) = get_setting("app_encryption_salt")? {
        return B64.decode(&b64).context("Invalid app salt encoding");
    }
    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);
    let b64 = B64.encode(salt);
    set_setting("app_encryption_salt", &b64)?;
    Ok(salt.to_vec())
}

pub fn set_setting(key: &str, value: &str) -> Result<()> {
    with_db(|conn| {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))",
            params![key, value],
        )?;
        Ok(())
    })
}

pub fn is_first_launch() -> Result<bool> {
    let val = get_setting("first_launch_completed")?;
    Ok(val.as_deref() != Some("true"))
}

pub fn mark_first_launch_complete() -> Result<()> {
    set_setting("first_launch_completed", "true")
}

// Log helpers
pub fn insert_log(connection_id: &str, level: &str, message: &str) -> Result<()> {
    let id = uuid::Uuid::new_v4().to_string();
    with_db(|conn| {
        conn.execute(
            "INSERT INTO connection_logs (id, connection_id, level, message) VALUES (?1, ?2, ?3, ?4)",
            params![id, connection_id, level, message],
        )?;
        Ok(())
    })
}
