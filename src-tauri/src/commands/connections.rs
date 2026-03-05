use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::command;
use uuid::Uuid;

use crate::crypto::{aes, keychain};
use crate::db::local::{get_setting, with_db};
use crate::models::connection::{
    Connection, ConnectionMethod, Folder, MySQLConfig, SSHAuthMethod, SSHConfig,
};

type MigrateEntry = (String, String, String, Option<String>, Option<String>);

fn get_session_key() -> Result<String, String> {
    get_setting("_session_key")
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Not authenticated".to_string())
}

/// Decrypts a field using the cached fast key if possible, falling back to
/// the legacy per-field PBKDF2 path. Returns (plaintext, was_legacy_format).
fn decrypt_field(enc: &str, legacy_password: &str) -> anyhow::Result<(String, bool)> {
    aes::decrypt_any(enc, legacy_password)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateConnectionInput {
    pub name: String,
    pub folder_id: Option<String>,
    pub color: Option<String>,
    pub method: String,
    pub mysql_hostname: String,
    pub mysql_port: u16,
    pub mysql_username: String,
    pub mysql_password: Option<String>,
    pub mysql_default_schema: Option<String>,
    pub ssh_hostname: Option<String>,
    pub ssh_port: Option<u16>,
    pub ssh_username: Option<String>,
    pub ssh_password: Option<String>,
    pub ssh_auth_method: Option<String>,
    pub ssh_key_file_path: Option<String>,
    pub ssh_key_passphrase: Option<String>,
}

#[command]
pub async fn get_connections() -> Result<Vec<Connection>, String> {
    let key = get_session_key()?;

    // Collect raw rows first so we can re-encrypt legacy fields afterwards.
    let raw = with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, folder_id, color, method, mysql_hostname_enc, mysql_port,
                    mysql_username_enc, mysql_default_schema, ssh_hostname_enc, ssh_port,
                    ssh_username_enc, ssh_auth_method, ssh_key_file_path, sort_order,
                    last_connected_at, created_at, updated_at
             FROM connections ORDER BY sort_order ASC, name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, u16>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, Option<u16>>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, Option<String>>(12)?,
                row.get::<_, Option<String>>(13)?,
                row.get::<_, i32>(14)?,
                row.get::<_, Option<String>>(15)?,
                row.get::<_, String>(16)?,
                row.get::<_, String>(17)?,
            ))
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| anyhow::anyhow!(e))
    })
    .map_err(|e| e.to_string())?;

    let mut connections = Vec::new();
    // (id, new_host_enc, new_user_enc, new_ssh_host_enc, new_ssh_user_enc)
    let mut to_migrate: Vec<MigrateEntry> = Vec::new();

    for row in raw {
        let (
            id,
            name,
            folder_id,
            color,
            method,
            hostname_enc,
            port,
            username_enc,
            default_schema,
            ssh_hostname_enc,
            ssh_port,
            ssh_username_enc,
            ssh_auth_method,
            ssh_key_file_path,
            sort_order,
            last_connected_at,
            created_at,
            updated_at,
        ) = row;

        let (hostname, host_legacy) =
            decrypt_field(&hostname_enc, &key).map_err(|e| e.to_string())?;
        let (username, user_legacy) =
            decrypt_field(&username_enc, &key).map_err(|e| e.to_string())?;

        // SSH fields: decrypt + prepare re-encrypted versions if needed
        let (ssh_config, new_ssh_host_enc, new_ssh_user_enc) =
            if let Some(ref ssh_host_enc) = ssh_hostname_enc {
                let (ssh_host, _) = decrypt_field(ssh_host_enc, &key).map_err(|e| e.to_string())?;
                let (ssh_user, _) = match ssh_username_enc.as_deref() {
                    Some(enc) => decrypt_field(enc, &key).map_err(|e| e.to_string())?,
                    None => (String::new(), false),
                };

                let sh_enc = aes::encrypt_fast(&ssh_host).map_err(|e| e.to_string())?;
                let su_enc = if !ssh_user.is_empty() {
                    Some(aes::encrypt_fast(&ssh_user).map_err(|e| e.to_string())?)
                } else {
                    None
                };

                let cfg = Some(SSHConfig {
                    hostname: ssh_host,
                    port: ssh_port.unwrap_or(22),
                    username: ssh_user,
                    auth_method: match ssh_auth_method.as_deref() {
                        Some("key_file") => SSHAuthMethod::KeyFile,
                        Some("both") => SSHAuthMethod::Both,
                        _ => SSHAuthMethod::Password,
                    },
                    key_file_path: ssh_key_file_path,
                });
                (cfg, Some(sh_enc), su_enc)
            } else {
                (None, None, None)
            };

        if host_legacy || user_legacy {
            let new_host = aes::encrypt_fast(&hostname).map_err(|e| e.to_string())?;
            let new_user = aes::encrypt_fast(&username).map_err(|e| e.to_string())?;
            to_migrate.push((
                id.clone(),
                new_host,
                new_user,
                new_ssh_host_enc,
                new_ssh_user_enc,
            ));
        }

        let conn_method = if method == "tcp_ip_over_ssh" {
            ConnectionMethod::TcpIpOverSsh
        } else {
            ConnectionMethod::TcpIp
        };

        connections.push(Connection {
            id,
            name,
            folder_id,
            color,
            method: conn_method,
            mysql: MySQLConfig {
                hostname,
                port,
                username,
                default_schema,
            },
            ssh: ssh_config,
            sort_order,
            last_connected_at,
            created_at,
            updated_at,
        });
    }

    // Silently migrate legacy-encrypted fields to the fast format.
    if !to_migrate.is_empty() {
        let _ = with_db(|conn| {
            for (id, h_enc, u_enc, ssh_h, ssh_u) in &to_migrate {
                conn.execute(
                    "UPDATE connections
                     SET mysql_hostname_enc=?1, mysql_username_enc=?2,
                         ssh_hostname_enc=COALESCE(?3, ssh_hostname_enc),
                         ssh_username_enc=COALESCE(?4, ssh_username_enc)
                     WHERE id=?5",
                    params![h_enc, u_enc, ssh_h, ssh_u, id],
                )?;
            }
            Ok(())
        });
    }

    Ok(connections)
}

#[command]
pub async fn create_connection(input: CreateConnectionInput) -> Result<Connection, String> {
    let id = Uuid::new_v4().to_string();

    let hostname_enc = aes::encrypt_fast(&input.mysql_hostname).map_err(|e| e.to_string())?;
    let username_enc = aes::encrypt_fast(&input.mysql_username).map_err(|e| e.to_string())?;

    // Store MySQL password in keychain
    if let Some(ref password) = input.mysql_password {
        keychain::store_secret(&keychain::mysql_password_key(&id), password)
            .map_err(|e| e.to_string())?;
    }

    let (ssh_hostname_enc, ssh_username_enc) =
        if let (Some(host), Some(user)) = (&input.ssh_hostname, &input.ssh_username) {
            let h = aes::encrypt_fast(host).map_err(|e| e.to_string())?;
            let u = aes::encrypt_fast(user).map_err(|e| e.to_string())?;
            (Some(h), Some(u))
        } else {
            (None, None)
        };

    // Store SSH password in keychain
    if let Some(ref ssh_pass) = input.ssh_password {
        keychain::store_secret(&keychain::ssh_password_key(&id), ssh_pass)
            .map_err(|e| e.to_string())?;
    }

    let sort_order = with_db(|conn| {
        let count: i32 =
            conn.query_row("SELECT COUNT(*) FROM connections", [], |row| row.get(0))?;
        Ok(count)
    })
    .map_err(|e| e.to_string())?;

    with_db(|conn| {
        conn.execute(
            "INSERT INTO connections (id, name, folder_id, color, method, mysql_hostname_enc, mysql_port, mysql_username_enc, mysql_default_schema, ssh_hostname_enc, ssh_port, ssh_username_enc, ssh_auth_method, ssh_key_file_path, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                id, input.name, input.folder_id, input.color, input.method,
                hostname_enc, input.mysql_port, username_enc, input.mysql_default_schema,
                ssh_hostname_enc, input.ssh_port, ssh_username_enc,
                input.ssh_auth_method, input.ssh_key_file_path, sort_order,
            ],
        )?;
        Ok(())
    })
    .map_err(|e| e.to_string())?;

    let connections = get_connections().await?;
    connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Failed to retrieve created connection".to_string())
}

#[command]
pub async fn update_connection(
    id: String,
    input: CreateConnectionInput,
) -> Result<Connection, String> {
    let hostname_enc = aes::encrypt_fast(&input.mysql_hostname).map_err(|e| e.to_string())?;
    let username_enc = aes::encrypt_fast(&input.mysql_username).map_err(|e| e.to_string())?;

    if let Some(ref password) = input.mysql_password {
        keychain::store_secret(&keychain::mysql_password_key(&id), password)
            .map_err(|e| e.to_string())?;
    }

    let (ssh_hostname_enc, ssh_username_enc) =
        if let (Some(host), Some(user)) = (&input.ssh_hostname, &input.ssh_username) {
            let h = aes::encrypt_fast(host).map_err(|e| e.to_string())?;
            let u = aes::encrypt_fast(user).map_err(|e| e.to_string())?;
            (Some(h), Some(u))
        } else {
            (None, None)
        };

    if let Some(ref ssh_pass) = input.ssh_password {
        keychain::store_secret(&keychain::ssh_password_key(&id), ssh_pass)
            .map_err(|e| e.to_string())?;
    }

    with_db(|conn| {
        conn.execute(
            "UPDATE connections SET name=?1, folder_id=?2, color=?3, method=?4,
             mysql_hostname_enc=?5, mysql_port=?6, mysql_username_enc=?7,
             mysql_default_schema=?8, ssh_hostname_enc=?9, ssh_port=?10,
             ssh_username_enc=?11, ssh_auth_method=?12, ssh_key_file_path=?13,
             updated_at=datetime('now') WHERE id=?14",
            params![
                input.name,
                input.folder_id,
                input.color,
                input.method,
                hostname_enc,
                input.mysql_port,
                username_enc,
                input.mysql_default_schema,
                ssh_hostname_enc,
                input.ssh_port,
                ssh_username_enc,
                input.ssh_auth_method,
                input.ssh_key_file_path,
                id,
            ],
        )?;
        Ok(())
    })
    .map_err(|e| e.to_string())?;

    let connections = get_connections().await?;
    connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Connection not found".to_string())
}

#[command]
pub async fn delete_connection(id: String) -> Result<(), String> {
    let _ = keychain::delete_secret(&keychain::mysql_password_key(&id));
    let _ = keychain::delete_secret(&keychain::ssh_password_key(&id));

    with_db(|conn| {
        conn.execute("DELETE FROM connections WHERE id=?1", params![id])?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

#[command]
pub async fn duplicate_connection(id: String) -> Result<Connection, String> {
    let connections = get_connections().await?;
    let original = connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Connection not found".to_string())?;

    let new_id = Uuid::new_v4().to_string();

    let hostname_enc = aes::encrypt_fast(&original.mysql.hostname).map_err(|e| e.to_string())?;
    let username_enc = aes::encrypt_fast(&original.mysql.username).map_err(|e| e.to_string())?;

    if let Ok(Some(password)) = keychain::get_secret(&keychain::mysql_password_key(&id)) {
        let _ = keychain::store_secret(&keychain::mysql_password_key(&new_id), &password);
    }

    let (ssh_hostname_enc, ssh_username_enc, ssh_port, ssh_auth_method, ssh_key_file_path) =
        if let Some(ref ssh) = original.ssh {
            let h = aes::encrypt_fast(&ssh.hostname).map_err(|e| e.to_string())?;
            let u = aes::encrypt_fast(&ssh.username).map_err(|e| e.to_string())?;
            let method = match ssh.auth_method {
                SSHAuthMethod::KeyFile => "key_file",
                SSHAuthMethod::Both => "both",
                SSHAuthMethod::Password => "password",
            };
            if let Ok(Some(ssh_pass)) = keychain::get_secret(&keychain::ssh_password_key(&id)) {
                let _ = keychain::store_secret(&keychain::ssh_password_key(&new_id), &ssh_pass);
            }
            (
                Some(h),
                Some(u),
                Some(ssh.port),
                Some(method.to_string()),
                ssh.key_file_path.clone(),
            )
        } else {
            (None, None, None, None, None)
        };

    let method_str = match original.method {
        ConnectionMethod::TcpIpOverSsh => "tcp_ip_over_ssh",
        ConnectionMethod::TcpIp => "tcp_ip",
    };

    let sort_order = with_db(|conn| {
        let count: i32 =
            conn.query_row("SELECT COUNT(*) FROM connections", [], |row| row.get(0))?;
        Ok(count)
    })
    .map_err(|e| e.to_string())?;

    let new_name = format!("{} (copy)", original.name);

    with_db(|conn| {
        conn.execute(
            "INSERT INTO connections (id, name, folder_id, color, method, mysql_hostname_enc, mysql_port, mysql_username_enc, mysql_default_schema, ssh_hostname_enc, ssh_port, ssh_username_enc, ssh_auth_method, ssh_key_file_path, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                new_id, new_name, original.folder_id, original.color, method_str,
                hostname_enc, original.mysql.port, username_enc, original.mysql.default_schema,
                ssh_hostname_enc, ssh_port, ssh_username_enc, ssh_auth_method, ssh_key_file_path, sort_order,
            ],
        )?;
        Ok(())
    })
    .map_err(|e| e.to_string())?;

    let connections = get_connections().await?;
    connections
        .into_iter()
        .find(|c| c.id == new_id)
        .ok_or_else(|| "Failed to retrieve duplicated connection".to_string())
}

#[command]
pub async fn get_folders() -> Result<Vec<Folder>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, sort_order, created_at FROM folders ORDER BY sort_order ASC, name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| anyhow::anyhow!(e))
    })
    .map_err(|e| e.to_string())
}

#[command]
pub async fn create_folder(name: String) -> Result<Folder, String> {
    let id = Uuid::new_v4().to_string();
    let sort_order = with_db(|conn| {
        let count: i32 = conn.query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))?;
        Ok(count)
    })
    .map_err(|e| e.to_string())?;

    with_db(|conn| {
        conn.execute(
            "INSERT INTO folders (id, name, sort_order) VALUES (?1, ?2, ?3)",
            params![id, name, sort_order],
        )?;
        Ok(())
    })
    .map_err(|e| e.to_string())?;

    with_db(|conn| {
        conn.query_row(
            "SELECT id, name, sort_order, created_at FROM folders WHERE id=?1",
            params![id],
            |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sort_order: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        )
        .map_err(|e| anyhow::anyhow!(e))
    })
    .map_err(|e| e.to_string())
}

#[command]
pub async fn update_folder(id: String, name: String) -> Result<(), String> {
    with_db(|conn| {
        conn.execute("UPDATE folders SET name=?1 WHERE id=?2", params![name, id])?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

#[command]
pub async fn delete_folder(id: String) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "UPDATE connections SET folder_id=NULL WHERE folder_id=?1",
            params![id],
        )?;
        conn.execute("DELETE FROM folders WHERE id=?1", params![id])?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

#[command]
pub async fn move_connection_to_folder(
    connection_id: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "UPDATE connections SET folder_id=?1 WHERE id=?2",
            params![folder_id, connection_id],
        )?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

#[command]
pub async fn reorder_connections(ordered_ids: Vec<String>) -> Result<(), String> {
    with_db(|conn| {
        for (i, id) in ordered_ids.iter().enumerate() {
            conn.execute(
                "UPDATE connections SET sort_order=?1 WHERE id=?2",
                params![i as i32, id],
            )?;
        }
        Ok(())
    })
    .map_err(|e| e.to_string())
}
