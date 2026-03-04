use serde::{Deserialize, Serialize};
use sqlx::{mysql::MySqlPoolOptions, Column, MySql, Pool, Row};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;
use tauri::command;
use once_cell::sync::Lazy;

/// Public accessor for other command modules
pub fn get_pool_extern(connection_id: &str) -> Option<Pool<MySql>> {
    get_pool(connection_id)
}

use crate::crypto::keychain;
use crate::db::local;
use crate::models::connection::ConnectionMethod;
use crate::models::query::{ColumnMeta, QueryResult, QueryStatus, QueryType};
use crate::ssh::tunnel;

static POOLS: Lazy<Mutex<HashMap<String, Pool<MySql>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// In-memory SSH passphrases (cleared when app closes)
static SSH_PASSPHRASES: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectInput {
    pub connection_id: String,
    pub ssh_passphrase: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestConnectionInput {
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

fn get_pool(connection_id: &str) -> Option<Pool<MySql>> {
    POOLS.lock().ok()?.get(connection_id).cloned()
}

#[command]
pub async fn connect(input: ConnectInput) -> Result<(), String> {
    // Get the connection details
    let connections = crate::commands::connections::get_connections().await?;
    let conn = connections
        .into_iter()
        .find(|c| c.id == input.connection_id)
        .ok_or_else(|| "Connection not found".to_string())?;

    // Get password from keychain
    let password = keychain::get_secret(&keychain::mysql_password_key(&input.connection_id))
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let (host, port) = if conn.method == ConnectionMethod::TcpIpOverSsh {
        // Check if tunnel already exists
        let existing_port = tunnel::get_tunnel_port(&input.connection_id);
        let local_port = if let Some(p) = existing_port {
            p
        } else {
            let ssh = conn.ssh.as_ref().ok_or("SSH config missing")?;
            let ssh_password = keychain::get_secret(&keychain::ssh_password_key(&input.connection_id))
                .map_err(|e| e.to_string())?;

            let passphrase = input.ssh_passphrase.as_deref().or_else(|| {
                SSH_PASSPHRASES
                    .lock()
                    .ok()?
                    .get(&input.connection_id)
                    .map(|s| s.as_str())
                    .map(String::from)
                    .as_deref()
                    .map(|_| "")
                    .and(None)
            });

            // Store passphrase in memory if provided
            if let Some(ref ph) = input.ssh_passphrase {
                if let Ok(mut map) = SSH_PASSPHRASES.lock() {
                    map.insert(input.connection_id.clone(), ph.clone());
                }
            }

            let config = tunnel::TunnelConfig {
                connection_id: input.connection_id.clone(),
                ssh_hostname: ssh.hostname.clone(),
                ssh_port: ssh.port,
                ssh_username: ssh.username.clone(),
                ssh_password: ssh_password.clone(),
                ssh_key_file: ssh.key_file_path.clone(),
                ssh_key_passphrase: passphrase.map(String::from).or_else(|| {
                    SSH_PASSPHRASES.lock().ok()?.get(&input.connection_id).cloned()
                }),
                mysql_hostname: conn.mysql.hostname.clone(),
                mysql_port: conn.mysql.port,
            };

            tunnel::establish_tunnel(config).map_err(|e| e.to_string())?
        };

        ("127.0.0.1".to_string(), local_port)
    } else {
        (conn.mysql.hostname.clone(), conn.mysql.port)
    };

    let database = conn.mysql.default_schema.as_deref().unwrap_or("");
    let url = if database.is_empty() {
        format!(
            "mysql://{}:{}@{}:{}",
            conn.mysql.username,
            urlencoding_simple(&password),
            host,
            port
        )
    } else {
        format!(
            "mysql://{}:{}@{}:{}/{}",
            conn.mysql.username,
            urlencoding_simple(&password),
            host,
            port,
            database
        )
    };

    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .map_err(|e| format!("Failed to connect to MySQL: {}", e))?;

    // Test the connection
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| format!("Connection test failed: {}", e))?;

    // Update last_connected_at
    let _ = local::with_db(|db| {
        db.execute(
            "UPDATE connections SET last_connected_at=datetime('now') WHERE id=?1",
            rusqlite::params![input.connection_id],
        )?;
        Ok(())
    });

    // Log
    let _ = local::insert_log(&input.connection_id, "INFO", "Connection established");

    // Store pool
    if let Ok(mut pools) = POOLS.lock() {
        pools.insert(input.connection_id.clone(), pool);
    }

    Ok(())
}

fn urlencoding_simple(s: &str) -> String {
    s.replace('%', "%25")
        .replace('@', "%40")
        .replace(':', "%3A")
        .replace('/', "%2F")
        .replace(' ', "%20")
}

#[command]
pub async fn disconnect(connection_id: String) -> Result<(), String> {
    // Close SSH tunnel if exists
    let _ = tunnel::close_tunnel(&connection_id);

    // Remove passphrase from memory
    if let Ok(mut map) = SSH_PASSPHRASES.lock() {
        map.remove(&connection_id);
    }

    // Close pool — extract it from the lock before awaiting to avoid holding MutexGuard across await
    let pool_to_close = POOLS.lock().ok().and_then(|mut pools| pools.remove(&connection_id));
    if let Some(pool) = pool_to_close {
        pool.close().await;
    }

    let _ = local::insert_log(&connection_id, "INFO", "Connection closed");
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteQueryInput {
    pub connection_id: String,
    pub sql: String,
    pub limit: Option<u32>,
}

#[command]
pub async fn execute_query(input: ExecuteQueryInput) -> Result<QueryResult, String> {
    let pool = get_pool(&input.connection_id)
        .ok_or_else(|| "Not connected to database".to_string())?;

    let start = Instant::now();
    let sql = input.sql.trim().to_string();

    // Detect query type
    let sql_upper = sql.to_uppercase();
    let query_type = if sql_upper.starts_with("SELECT") || sql_upper.starts_with("SHOW") || sql_upper.starts_with("DESCRIBE") || sql_upper.starts_with("EXPLAIN") {
        QueryType::Select
    } else if sql_upper.starts_with("INSERT") {
        QueryType::Insert
    } else if sql_upper.starts_with("UPDATE") {
        QueryType::Update
    } else if sql_upper.starts_with("DELETE") {
        QueryType::Delete
    } else if sql_upper.starts_with("CREATE") || sql_upper.starts_with("ALTER") || sql_upper.starts_with("DROP") || sql_upper.starts_with("TRUNCATE") {
        QueryType::Ddl
    } else {
        QueryType::Other
    };

    let result = match query_type {
        QueryType::Select => {
            let rows = sqlx::query(&sql)
                .fetch_all(&pool)
                .await
                .map_err(|e| e.to_string())?;

            let elapsed = start.elapsed().as_millis() as u64;

            let columns: Vec<ColumnMeta> = if let Some(first_row) = rows.first() {
                first_row
                    .columns()
                    .iter()
                    .map(|col| ColumnMeta {
                        name: col.name().to_string(),
                        type_name: format!("{:?}", col.type_info()),
                        nullable: true,
                        is_primary_key: false,
                    })
                    .collect()
            } else {
                Vec::new()
            };

            let result_rows: Vec<Vec<Option<String>>> = rows
                .iter()
                .map(|row| {
                    (0..row.len())
                        .map(|i| {
                            row.try_get::<Option<String>, _>(i)
                                .ok()
                                .flatten()
                        })
                        .collect()
                })
                .collect();

            QueryResult {
                columns,
                rows: result_rows,
                rows_affected: 0,
                last_insert_id: 0,
                execution_time_ms: elapsed,
                query_type: QueryType::Select,
            }
        }
        _ => {
            let result = sqlx::query(&sql)
                .execute(&pool)
                .await
                .map_err(|e| e.to_string())?;

            let elapsed = start.elapsed().as_millis() as u64;

            QueryResult {
                columns: Vec::new(),
                rows: Vec::new(),
                rows_affected: result.rows_affected(),
                last_insert_id: result.last_insert_id(),
                execution_time_ms: elapsed,
                query_type,
            }
        }
    };

    // Log to history
    let history_id = uuid::Uuid::new_v4().to_string();
    let _ = local::with_db(|db| {
        db.execute(
            "INSERT INTO query_history (id, connection_id, sql, execution_time_ms, status, rows_affected) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                history_id,
                input.connection_id,
                sql,
                result.execution_time_ms,
                "success",
                result.rows_affected,
            ],
        )?;
        Ok(())
    });

    Ok(result)
}

#[command]
pub async fn test_connection(input: TestConnectionInput) -> Result<(), String> {
    let password = input.mysql_password.as_deref().unwrap_or("");

    let (host, port) = if input.method == "tcp_ip_over_ssh" {
        // Test SSH first
        let ssh_host = input.ssh_hostname.as_deref().ok_or("SSH hostname required")?;
        let ssh_port = input.ssh_port.unwrap_or(22);
        let ssh_user = input.ssh_username.as_deref().ok_or("SSH username required")?;

        tunnel::test_ssh_connection(
            ssh_host,
            ssh_port,
            ssh_user,
            input.ssh_password.as_deref(),
            input.ssh_key_file_path.as_deref(),
            input.ssh_key_passphrase.as_deref(),
        )
        .map_err(|e| e.to_string())?;

        (input.mysql_hostname.clone(), input.mysql_port)
    } else {
        (input.mysql_hostname.clone(), input.mysql_port)
    };

    let database = input.mysql_default_schema.as_deref().unwrap_or("");
    let url = if database.is_empty() {
        format!(
            "mysql://{}:{}@{}:{}",
            input.mysql_username,
            urlencoding_simple(password),
            host,
            port
        )
    } else {
        format!(
            "mysql://{}:{}@{}:{}/{}",
            input.mysql_username,
            urlencoding_simple(password),
            host,
            port,
            database
        )
    };

    let pool: Pool<MySql> = MySqlPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&url)
        .await
        .map_err(|e| format!("{}", e))?;

    sqlx::query::<MySql>("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| format!("{}", e))?;

    pool.close().await;
    Ok(())
}

#[command]
pub async fn get_databases(connection_id: String) -> Result<Vec<String>, String> {
    let pool = get_pool(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query("SHOW DATABASES")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .filter_map(|r| r.try_get::<String, _>(0).ok())
        .collect())
}

#[command]
pub async fn get_tables(connection_id: String, database: String) -> Result<Vec<String>, String> {
    let pool = get_pool(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query(&format!("SHOW FULL TABLES FROM `{}`", database))
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .filter_map(|r| {
            let table_type: String = r.try_get(1).ok()?;
            if table_type == "BASE TABLE" {
                r.try_get::<String, _>(0).ok()
            } else {
                None
            }
        })
        .collect())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub key_type: String,
    pub default_value: Option<String>,
    pub extra: String,
    pub comment: Option<String>,
}

#[command]
pub async fn get_table_columns(
    connection_id: String,
    database: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    let pool = get_pool(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query(&format!(
        "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = '{}' AND TABLE_NAME = '{}'
         ORDER BY ORDINAL_POSITION",
        database, table
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .filter_map(|r| {
            Some(ColumnInfo {
                name: r.try_get::<String, _>(0).ok()?,
                data_type: r.try_get::<String, _>(1).ok()?,
                is_nullable: r.try_get::<String, _>(2).ok()? == "YES",
                key_type: r.try_get::<String, _>(3).ok()?,
                default_value: r.try_get::<Option<String>, _>(4).ok().flatten(),
                extra: r.try_get::<String, _>(5).ok()?,
                comment: {
                    let c: String = r.try_get(6).ok()?;
                    if c.is_empty() { None } else { Some(c) }
                },
            })
        })
        .collect())
}

#[command]
pub async fn get_table_indexes(
    connection_id: String,
    database: String,
    table: String,
) -> Result<serde_json::Value, String> {
    let pool = get_pool(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query(&format!(
        "SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, COLLATION, INDEX_TYPE
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = '{}' AND TABLE_NAME = '{}'
         ORDER BY INDEX_NAME, SEQ_IN_INDEX",
        database, table
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut indexes: HashMap<String, serde_json::Value> = HashMap::new();
    for row in &rows {
        let name: String = row.try_get(0).map_err(|e| e.to_string())?;
        let non_unique: i32 = row.try_get(1).map_err(|e| e.to_string())?;
        let column: String = row.try_get(3).map_err(|e| e.to_string())?;
        let collation: Option<String> = row.try_get(4).map_err(|e| e.to_string())?;
        let index_type: String = row.try_get(5).map_err(|e| e.to_string())?;

        let entry = indexes.entry(name.clone()).or_insert_with(|| {
            serde_json::json!({
                "name": name,
                "is_unique": non_unique == 0,
                "index_type": index_type,
                "columns": []
            })
        });

        if let Some(cols) = entry.get_mut("columns").and_then(|v| v.as_array_mut()) {
            cols.push(serde_json::json!({
                "column_name": column,
                "sort_order": if collation.as_deref() == Some("D") { "DESC" } else { "ASC" }
            }));
        }
    }

    Ok(serde_json::Value::Array(indexes.into_values().collect()))
}

#[command]
pub async fn get_table_foreign_keys(
    connection_id: String,
    database: String,
    table: String,
) -> Result<serde_json::Value, String> {
    let pool = get_pool(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query(&format!(
        "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME,
                UPDATE_RULE, DELETE_RULE
         FROM information_schema.KEY_COLUMN_USAGE kcu
         JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
             ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
             AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
         WHERE kcu.TABLE_SCHEMA = '{}' AND kcu.TABLE_NAME = '{}'
         AND kcu.REFERENCED_TABLE_NAME IS NOT NULL",
        database, table
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let fks: Vec<serde_json::Value> = rows.iter().filter_map(|row| {
        Some(serde_json::json!({
            "name": row.try_get::<String, _>(0).ok()?,
            "column": row.try_get::<String, _>(1).ok()?,
            "referenced_table": row.try_get::<String, _>(2).ok()?,
            "referenced_column": row.try_get::<String, _>(3).ok()?,
            "on_update": row.try_get::<String, _>(4).ok()?,
            "on_delete": row.try_get::<String, _>(5).ok()?,
        }))
    }).collect();

    Ok(serde_json::Value::Array(fks))
}

#[command]
pub async fn get_table_triggers(
    connection_id: String,
    database: String,
    table: String,
) -> Result<serde_json::Value, String> {
    let pool = get_pool(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query(&format!(
        "SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, ACTION_STATEMENT, DEFINER
         FROM information_schema.TRIGGERS
         WHERE TRIGGER_SCHEMA = '{}' AND EVENT_OBJECT_TABLE = '{}'",
        database, table
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let triggers: Vec<serde_json::Value> = rows.iter().filter_map(|row| {
        Some(serde_json::json!({
            "name": row.try_get::<String, _>(0).ok()?,
            "timing": row.try_get::<String, _>(1).ok()?,
            "event": row.try_get::<String, _>(2).ok()?,
            "statement": row.try_get::<String, _>(3).ok()?,
            "definer": row.try_get::<Option<String>, _>(4).ok().flatten(),
        }))
    }).collect();

    Ok(serde_json::Value::Array(triggers))
}

#[command]
pub async fn get_views(connection_id: String, database: String) -> Result<Vec<String>, String> {
    let pool = get_pool(&connection_id).ok_or_else(|| "Not connected".to_string())?;
    let rows = sqlx::query(&format!(
        "SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = '{}'",
        database
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.iter().filter_map(|r| r.try_get::<String, _>(0).ok()).collect())
}

#[command]
pub async fn get_procedures(connection_id: String, database: String) -> Result<Vec<String>, String> {
    let pool = get_pool(&connection_id).ok_or_else(|| "Not connected".to_string())?;
    let rows = sqlx::query(&format!(
        "SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '{}' AND ROUTINE_TYPE = 'PROCEDURE'",
        database
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.iter().filter_map(|r| r.try_get::<String, _>(0).ok()).collect())
}

#[command]
pub async fn get_functions(connection_id: String, database: String) -> Result<Vec<String>, String> {
    let pool = get_pool(&connection_id).ok_or_else(|| "Not connected".to_string())?;
    let rows = sqlx::query(&format!(
        "SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '{}' AND ROUTINE_TYPE = 'FUNCTION'",
        database
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.iter().filter_map(|r| r.try_get::<String, _>(0).ok()).collect())
}

#[command]
pub async fn get_events(connection_id: String, database: String) -> Result<Vec<String>, String> {
    let pool = get_pool(&connection_id).ok_or_else(|| "Not connected".to_string())?;
    let rows = sqlx::query(&format!(
        "SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = '{}'",
        database
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.iter().filter_map(|r| r.try_get::<String, _>(0).ok()).collect())
}

#[command]
pub async fn get_create_statement(
    connection_id: String,
    database: String,
    object_type: String,
    name: String,
) -> Result<String, String> {
    let pool = get_pool(&connection_id).ok_or_else(|| "Not connected".to_string())?;

    let sql = match object_type.to_uppercase().as_str() {
        "TABLE" => format!("SHOW CREATE TABLE `{}`.`{}`", database, name),
        "VIEW" => format!("SHOW CREATE VIEW `{}`.`{}`", database, name),
        "PROCEDURE" => format!("SHOW CREATE PROCEDURE `{}`.`{}`", database, name),
        "FUNCTION" => format!("SHOW CREATE FUNCTION `{}`.`{}`", database, name),
        "TRIGGER" => format!("SHOW CREATE TRIGGER `{}`.`{}`", database, name),
        _ => return Err(format!("Unknown object type: {}", object_type)),
    };

    let row = sqlx::query(&sql)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    // Column index varies by type
    let col_idx = match object_type.to_uppercase().as_str() {
        "TABLE" => 1,
        _ => 2,
    };

    row.try_get::<String, _>(col_idx)
        .or_else(|_| row.try_get::<String, _>(1))
        .map_err(|e| e.to_string())
}
