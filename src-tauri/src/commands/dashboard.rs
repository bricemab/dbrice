use serde::{Deserialize, Serialize};
use sqlx::{MySql, Row};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerStatus {
    pub version: String,
    pub uptime_seconds: u64,
    pub active_connections: u64,
    pub max_connections: u64,
    pub questions_per_sec: f64,
    pub slow_queries_count: u64,
    pub threads_connected: u64,
    pub threads_running: u64,
    pub innodb_reads_per_sec: f64,
    pub innodb_writes_per_sec: f64,
    pub bytes_received: u64,
    pub bytes_sent: u64,
}

#[command]
pub async fn get_server_status(connection_id: String) -> Result<ServerStatus, String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Get version
    let version_row = sqlx::query::<MySql>("SELECT VERSION()")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let version: String = version_row.try_get(0).map_err(|e| e.to_string())?;

    // Get status variables
    let status_rows = sqlx::query::<MySql>(
        "SHOW GLOBAL STATUS WHERE Variable_name IN (
            'Uptime', 'Threads_connected', 'Threads_running', 'Queries',
            'Slow_queries', 'Bytes_received', 'Bytes_sent',
            'Innodb_data_reads', 'Innodb_data_writes'
        )"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut vars = std::collections::HashMap::new();
    for row in &status_rows {
        let name: String = row.try_get(0).map_err(|e| e.to_string())?;
        let value: String = row.try_get(1).map_err(|e| e.to_string())?;
        vars.insert(name, value);
    }

    // Get max connections
    let max_conn_row = sqlx::query::<MySql>("SHOW GLOBAL VARIABLES LIKE 'max_connections'")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let max_connections: u64 = max_conn_row
        .try_get::<String, _>(1)
        .map_err(|e| e.to_string())?
        .parse()
        .unwrap_or(151);

    let uptime: u64 = vars.get("Uptime").and_then(|v| v.parse().ok()).unwrap_or(0);
    let threads_connected: u64 = vars.get("Threads_connected").and_then(|v| v.parse().ok()).unwrap_or(0);
    let threads_running: u64 = vars.get("Threads_running").and_then(|v| v.parse().ok()).unwrap_or(0);
    let slow_queries: u64 = vars.get("Slow_queries").and_then(|v| v.parse().ok()).unwrap_or(0);
    let bytes_received: u64 = vars.get("Bytes_received").and_then(|v| v.parse().ok()).unwrap_or(0);
    let bytes_sent: u64 = vars.get("Bytes_sent").and_then(|v| v.parse().ok()).unwrap_or(0);

    // Rough queries/sec estimate using uptime
    let queries: f64 = vars.get("Queries").and_then(|v| v.parse().ok()).unwrap_or(0.0);
    let qps = if uptime > 0 { queries / uptime as f64 } else { 0.0 };

    Ok(ServerStatus {
        version,
        uptime_seconds: uptime,
        active_connections: threads_connected,
        max_connections,
        questions_per_sec: qps,
        slow_queries_count: slow_queries,
        threads_connected,
        threads_running,
        innodb_reads_per_sec: 0.0,
        innodb_writes_per_sec: 0.0,
        bytes_received,
        bytes_sent,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub id: u64,
    pub user: String,
    pub host: String,
    pub db: Option<String>,
    pub command: String,
    pub time: u64,
    pub state: Option<String>,
    pub info: Option<String>,
}

#[command]
pub async fn get_process_list(connection_id: String) -> Result<Vec<ProcessInfo>, String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query::<MySql>("SHOW FULL PROCESSLIST")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .filter_map(|r| {
            Some(ProcessInfo {
                id: r.try_get::<u64, _>(0).ok()?,
                user: r.try_get::<String, _>(1).ok()?,
                host: r.try_get::<String, _>(2).ok()?,
                db: r.try_get::<Option<String>, _>(3).ok().flatten(),
                command: r.try_get::<String, _>(4).ok()?,
                time: r.try_get::<i64, _>(5).ok()? as u64,
                state: r.try_get::<Option<String>, _>(6).ok().flatten(),
                info: r.try_get::<Option<String>, _>(7).ok().flatten(),
            })
        })
        .collect())
}

#[command]
pub async fn kill_process(connection_id: String, process_id: u64) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;
    sqlx::query::<MySql>(&format!("KILL {}", process_id))
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SlowQueryInfo {
    pub sql: String,
    pub execution_count: u64,
    pub avg_time: f64,
}

#[command]
pub async fn get_slow_queries(connection_id: String) -> Result<Vec<SlowQueryInfo>, String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Try performance_schema first
    let result = sqlx::query::<MySql>(
        "SELECT DIGEST_TEXT, COUNT_STAR, AVG_TIMER_WAIT/1000000000000
         FROM performance_schema.events_statements_summary_by_digest
         WHERE AVG_TIMER_WAIT > 1000000000000
         ORDER BY AVG_TIMER_WAIT DESC
         LIMIT 20"
    )
    .fetch_all(&pool)
    .await;

    match result {
        Ok(rows) => {
            Ok(rows.iter().filter_map(|r| {
                Some(SlowQueryInfo {
                    sql: r.try_get::<Option<String>, _>(0).ok().flatten().unwrap_or_default(),
                    execution_count: r.try_get::<u64, _>(1).ok()?,
                    avg_time: r.try_get::<f64, _>(2).ok()?,
                })
            }).collect())
        }
        Err(_) => Ok(Vec::new()),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseSize {
    pub name: String,
    pub size_mb: f64,
    pub tables_count: u64,
}

#[command]
pub async fn get_database_sizes(connection_id: String) -> Result<Vec<DatabaseSize>, String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query::<MySql>(
        "SELECT table_schema,
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb,
                COUNT(*) AS tables_count
         FROM information_schema.tables
         WHERE table_schema NOT IN ('information_schema', 'performance_schema', 'sys')
         GROUP BY table_schema
         ORDER BY size_mb DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.iter().filter_map(|r| {
        Some(DatabaseSize {
            name: r.try_get::<String, _>(0).ok()?,
            size_mb: r.try_get::<f64, _>(1).ok().unwrap_or(0.0),
            tables_count: r.try_get::<i64, _>(2).ok()? as u64,
        })
    }).collect())
}
