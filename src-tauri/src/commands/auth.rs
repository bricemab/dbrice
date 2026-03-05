use anyhow::Result;
use tauri::command;

use crate::crypto::{aes, keychain};
use crate::db::local;

#[command]
pub async fn check_first_launch() -> Result<bool, String> {
    local::is_first_launch().map_err(|e| e.to_string())
}

#[command]
pub async fn setup_master_password(password: String) -> Result<(), String> {
    if password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }
    if password.len() < 6 {
        return Err("Password must be at least 6 characters".to_string());
    }

    // Store password hash in keychain
    let hash = aes::create_password_hash(&password).map_err(|e| e.to_string())?;
    keychain::store_secret(&keychain::master_password_hash_key(), &hash)
        .map_err(|e| e.to_string())?;

    // Mark first launch complete
    local::mark_first_launch_complete().map_err(|e| e.to_string())?;

    // Store master password in session (via settings temporarily)
    local::set_setting("_session_key", &password).map_err(|e| e.to_string())?;

    // Derive and cache the session key (one-time cost)
    let app_salt = local::get_or_create_app_salt().map_err(|e| e.to_string())?;
    aes::init_session_key(&password, &app_salt);

    Ok(())
}

#[command]
pub async fn verify_master_password(password: String) -> Result<bool, String> {
    let hash =
        keychain::get_secret(&keychain::master_password_hash_key()).map_err(|e| e.to_string())?;

    match hash {
        Some(h) => {
            let valid = aes::verify_password_hash(&password, &h);
            if valid {
                local::set_setting("_session_key", &password).map_err(|e| e.to_string())?;
                // Derive and cache the session key (one-time cost per login)
                let app_salt = local::get_or_create_app_salt().map_err(|e| e.to_string())?;
                aes::init_session_key(&password, &app_salt);
            }
            Ok(valid)
        }
        None => Ok(false),
    }
}

#[command]
pub async fn change_master_password(
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    let is_valid = verify_master_password(current_password.clone()).await?;
    if !is_valid {
        return Err("Current password is incorrect".to_string());
    }

    if new_password.len() < 6 {
        return Err("New password must be at least 6 characters".to_string());
    }

    // Re-encrypt all connection data with the new session key.
    // At this point the old session key is still active (set by verify_master_password above).
    re_encrypt_connections(&current_password).map_err(|e| e.to_string())?;

    // Switch to the new session key
    let app_salt = local::get_or_create_app_salt().map_err(|e| e.to_string())?;
    aes::init_session_key(&new_password, &app_salt);

    // Re-encrypt again with the new key (data is now in legacy format relative to new key)
    re_encrypt_connections(&current_password).map_err(|e| e.to_string())?;

    // Update password hash and session record
    let hash = aes::create_password_hash(&new_password).map_err(|e| e.to_string())?;
    keychain::store_secret(&keychain::master_password_hash_key(), &hash)
        .map_err(|e| e.to_string())?;
    local::set_setting("_session_key", &new_password).map_err(|e| e.to_string())?;

    Ok(())
}

/// Re-encrypts all connection fields using the currently cached session key.
/// Reads with `decrypt_any` (handles both old and new format), writes with `encrypt_fast`.
fn re_encrypt_connections(old_password: &str) -> Result<()> {
    use crate::db::local::with_db;
    use rusqlite::params;

    let connections: Vec<(String, String, String, String, String)> = with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, mysql_hostname_enc, mysql_username_enc, ssh_hostname_enc, ssh_username_enc FROM connections",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            ))
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| anyhow::anyhow!(e))
    })?;

    for (id, hostname_enc, username_enc, ssh_hostname_enc, ssh_username_enc) in connections {
        let (hostname, _) = aes::decrypt_any(&hostname_enc, old_password)?;
        let (username, _) = aes::decrypt_any(&username_enc, old_password)?;

        let new_hostname_enc = aes::encrypt_fast(&hostname)?;
        let new_username_enc = aes::encrypt_fast(&username)?;

        let (new_ssh_hostname_enc, new_ssh_username_enc) = if !ssh_hostname_enc.is_empty() {
            let (ssh_hostname, _) = aes::decrypt_any(&ssh_hostname_enc, old_password)?;
            let (ssh_username, _) = aes::decrypt_any(&ssh_username_enc, old_password)?;
            (
                aes::encrypt_fast(&ssh_hostname)?,
                aes::encrypt_fast(&ssh_username)?,
            )
        } else {
            (String::new(), String::new())
        };

        with_db(|conn| {
            conn.execute(
                "UPDATE connections
                 SET mysql_hostname_enc=?1, mysql_username_enc=?2,
                     ssh_hostname_enc=?3, ssh_username_enc=?4
                 WHERE id=?5",
                params![
                    new_hostname_enc,
                    new_username_enc,
                    if new_ssh_hostname_enc.is_empty() {
                        None
                    } else {
                        Some(new_ssh_hostname_enc.clone())
                    },
                    if new_ssh_username_enc.is_empty() {
                        None
                    } else {
                        Some(new_ssh_username_enc.clone())
                    },
                    id
                ],
            )?;
            Ok(())
        })?;
    }

    Ok(())
}

#[command]
pub async fn reset_dbrice() -> Result<(), String> {
    let connection_ids: Vec<String> = crate::db::local::with_db(|conn| {
        let mut stmt = conn.prepare("SELECT id FROM connections")?;
        let ids = stmt.query_map([], |row| row.get::<_, String>(0))?;
        ids.collect::<Result<Vec<_>, _>>()
            .map_err(|e| anyhow::anyhow!(e))
    })
    .map_err(|e| e.to_string())?;

    keychain::clear_all_secrets(&connection_ids).map_err(|e| e.to_string())?;

    crate::db::local::with_db(|conn| {
        conn.execute_batch(
            "DELETE FROM connection_logs;
             DELETE FROM query_history;
             DELETE FROM connections;
             DELETE FROM folders;
             DELETE FROM settings;",
        )?;
        Ok(())
    })
    .map_err(|e| e.to_string())?;

    crate::db::local::with_db(|conn| {
        conn.execute_batch(
            "INSERT OR IGNORE INTO settings (key, value) VALUES
                ('theme', '\"system\"'),
                ('default_limit', '1000'),
                ('app_version', '\"1.0.0\"'),
                ('first_launch_completed', 'false');",
        )?;
        Ok(())
    })
    .map_err(|e| e.to_string())?;

    aes::clear_session_key();

    Ok(())
}
