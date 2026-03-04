use serde::{Deserialize, Serialize};
use sqlx::MySql;
use tauri::command;

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct TableDefinition {
    pub name: String,
    pub database: String,
    pub create_statement: String,
    pub engine: Option<String>,
    pub charset: Option<String>,
    pub collation: Option<String>,
    pub comment: Option<String>,
    pub auto_increment: Option<u64>,
}

#[command]
pub async fn get_table_definition(
    connection_id: String,
    database: String,
    table: String,
) -> Result<String, String> {
    crate::commands::mysql::get_create_statement(
        connection_id,
        database,
        "TABLE".to_string(),
        table,
    )
    .await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApplyTableChangesInput {
    pub connection_id: String,
    pub sql: String,
}

#[command]
pub async fn apply_table_changes(input: ApplyTableChangesInput) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&input.connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Execute the SQL
    for statement in input.sql.split(';').filter(|s| !s.trim().is_empty()) {
        sqlx::query::<MySql>(statement.trim())
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[command]
pub async fn create_table(connection_id: String, sql: String) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;
    sqlx::query::<MySql>(&sql)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn alter_table(connection_id: String, sql: String) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;
    sqlx::query::<MySql>(&sql)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn drop_table(
    connection_id: String,
    database: String,
    table: String,
) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;
    sqlx::query::<MySql>(&format!("DROP TABLE `{}`.`{}`", database, table))
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn truncate_table(
    connection_id: String,
    database: String,
    table: String,
) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;
    sqlx::query::<MySql>(&format!("TRUNCATE TABLE `{}`.`{}`", database, table))
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn create_database(
    connection_id: String,
    name: String,
    charset: Option<String>,
    collation: Option<String>,
) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let mut sql = format!("CREATE DATABASE `{}`", name);
    if let Some(cs) = charset {
        sql.push_str(&format!(" CHARACTER SET {}", cs));
    }
    if let Some(co) = collation {
        sql.push_str(&format!(" COLLATE {}", co));
    }

    sqlx::query::<MySql>(&sql)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn drop_database(connection_id: String, name: String) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;
    sqlx::query::<MySql>(&format!("DROP DATABASE `{}`", name))
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
