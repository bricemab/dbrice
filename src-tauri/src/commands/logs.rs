use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::command;

use crate::db::local::with_db;

#[derive(Debug, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub connection_id: String,
    pub level: String,
    pub message: String,
    pub created_at: String,
}

#[command]
pub async fn get_logs(connection_id: String, limit: Option<u32>) -> Result<Vec<LogEntry>, String> {
    let limit = limit.unwrap_or(500);
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, connection_id, level, message, created_at
             FROM connection_logs
             WHERE connection_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![connection_id, limit], |row| {
            Ok(LogEntry {
                id: row.get(0)?,
                connection_id: row.get(1)?,
                level: row.get(2)?,
                message: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| anyhow::anyhow!(e))
    })
    .map_err(|e| e.to_string())
}

#[command]
pub async fn clear_logs(connection_id: String) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "DELETE FROM connection_logs WHERE connection_id = ?1",
            params![connection_id],
        )?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

#[command]
pub async fn export_logs(connection_id: String, output_path: String) -> Result<(), String> {
    let logs = get_logs(connection_id, Some(10000)).await?;

    let mut content = String::new();
    for log in &logs {
        content.push_str(&format!(
            "[{}] [{}] {}\n",
            log.created_at, log.level, log.message
        ));
    }

    std::fs::write(&output_path, content).map_err(|e| e.to_string())?;
    Ok(())
}
