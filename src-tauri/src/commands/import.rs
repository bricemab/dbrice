use serde::{Deserialize, Serialize};
use sqlx::MySql;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportOptions {
    pub connection_id: String,
    pub target_database: Option<String>,
    pub create_database: Option<String>,
    pub file_path: String,
    pub stop_on_error: bool,
}

#[command]
pub async fn import_sql(options: ImportOptions) -> Result<ImportResult, String> {
    let pool = crate::commands::mysql::get_pool_extern(&options.connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Read SQL file
    let sql_content = std::fs::read_to_string(&options.file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Create database if requested
    if let Some(ref db_name) = options.create_database {
        sqlx::query::<MySql>(&format!("CREATE DATABASE IF NOT EXISTS `{}`", db_name))
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Use target database
    let use_db = options
        .create_database
        .as_deref()
        .or(options.target_database.as_deref());

    if let Some(db) = use_db {
        sqlx::query::<MySql>(&format!("USE `{}`", db))
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut executed = 0u64;
    let mut errors = Vec::new();

    // Split by semicolons (simple approach — handles most SQL dumps)
    for statement in sql_content.split(';') {
        let stmt = statement.trim();
        if stmt.is_empty() || stmt.starts_with("--") || stmt.starts_with("/*") {
            continue;
        }

        match sqlx::query::<MySql>(stmt).execute(&pool).await {
            Ok(_) => executed += 1,
            Err(e) => {
                let error_msg = format!("Error at statement {}: {}", executed + 1, e);
                if options.stop_on_error {
                    return Err(error_msg);
                }
                errors.push(error_msg);
            }
        }
    }

    Ok(ImportResult {
        success: errors.is_empty() || !options.stop_on_error,
        statements_executed: executed,
        errors,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub statements_executed: u64,
    pub errors: Vec<String>,
    pub success: bool,
}
