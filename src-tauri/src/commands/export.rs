use serde::{Deserialize, Serialize};
use sqlx::{Column, MySql, Row};
use std::io::Write;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportOptions {
    pub connection_id: String,
    pub database: String,
    pub tables: Vec<String>,
    pub export_type: String, // "structure", "data", "both"
    pub format: String,      // "sql", "csv", "json"
    pub output_path: String,
    pub include_drop_table: bool,
    pub include_create_database: bool,
    pub use_transactions: bool,
    pub disable_fk_checks: bool,
    pub csv_separator: Option<String>,
}

#[command]
pub async fn export_database(options: ExportOptions) -> Result<String, String> {
    let pool = crate::commands::mysql::get_pool_extern(&options.connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    match options.format.as_str() {
        "sql" => export_sql(&pool, &options).await,
        "csv" => export_csv(&pool, &options).await,
        "json" => export_json(&pool, &options).await,
        _ => Err(format!("Unknown export format: {}", options.format)),
    }
}

async fn export_sql(
    pool: &sqlx::Pool<sqlx::MySql>,
    options: &ExportOptions,
) -> Result<String, String> {
    let mut output = String::new();

    output.push_str("-- DBrice Export\n");
    output.push_str(&format!("-- Database: {}\n", options.database));
    output.push_str(&format!(
        "-- Date: {}\n\n",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S")
    ));

    if options.disable_fk_checks {
        output.push_str("SET FOREIGN_KEY_CHECKS=0;\n\n");
    }

    if options.include_create_database {
        output.push_str(&format!(
            "CREATE DATABASE IF NOT EXISTS `{}`;\n",
            options.database
        ));
        output.push_str(&format!("USE `{}`;\n\n", options.database));
    }

    if options.use_transactions {
        output.push_str("START TRANSACTION;\n\n");
    }

    for table in &options.tables {
        if options.export_type == "structure" || options.export_type == "both" {
            // Get CREATE TABLE statement
            let row = sqlx::query::<MySql>(&format!(
                "SHOW CREATE TABLE `{}`.`{}`",
                options.database, table
            ))
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;

            let create_stmt: String = row.try_get(1).map_err(|e| e.to_string())?;

            if options.include_drop_table {
                output.push_str(&format!("DROP TABLE IF EXISTS `{}`;\n", table));
            }
            output.push_str(&create_stmt);
            output.push_str(";\n\n");
        }

        if options.export_type == "data" || options.export_type == "both" {
            // Get all rows
            let rows =
                sqlx::query::<MySql>(&format!("SELECT * FROM `{}`.`{}`", options.database, table))
                    .fetch_all(pool)
                    .await
                    .map_err(|e| e.to_string())?;

            if !rows.is_empty() {
                output.push_str(&format!("-- Data for table `{}`\n", table));
                for row in &rows {
                    let values: Vec<String> = (0..row.len())
                        .map(|i| match row.try_get::<Option<String>, _>(i) {
                            Ok(Some(v)) => format!("'{}'", v.replace('\'', "\\'")),
                            Ok(None) => "NULL".to_string(),
                            Err(_) => "NULL".to_string(),
                        })
                        .collect();
                    output.push_str(&format!(
                        "INSERT INTO `{}` VALUES ({});\n",
                        table,
                        values.join(", ")
                    ));
                }
                output.push('\n');
            }
        }
    }

    if options.use_transactions {
        output.push_str("COMMIT;\n");
    }

    if options.disable_fk_checks {
        output.push_str("\nSET FOREIGN_KEY_CHECKS=1;\n");
    }

    // Write to file
    std::fs::write(&options.output_path, &output).map_err(|e| e.to_string())?;

    Ok(format!(
        "Export completed successfully: {}",
        options.output_path
    ))
}

async fn export_csv(
    pool: &sqlx::Pool<sqlx::MySql>,
    options: &ExportOptions,
) -> Result<String, String> {
    let separator = options.csv_separator.as_deref().unwrap_or(";");
    let output_dir = std::path::Path::new(&options.output_path);
    std::fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;

    for table in &options.tables {
        let rows =
            sqlx::query::<MySql>(&format!("SELECT * FROM `{}`.`{}`", options.database, table))
                .fetch_all(pool)
                .await
                .map_err(|e| e.to_string())?;

        let file_path = output_dir.join(format!("{}.csv", table));
        let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;

        if let Some(first_row) = rows.first() {
            let headers: Vec<String> = first_row
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect();
            writeln!(file, "{}", headers.join(separator)).map_err(|e| e.to_string())?;
        }

        for row in &rows {
            let values: Vec<String> = (0..row.len())
                .map(|i| {
                    row.try_get::<Option<String>, _>(i)
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| "NULL".to_string())
                })
                .collect();
            writeln!(file, "{}", values.join(separator)).map_err(|e| e.to_string())?;
        }
    }

    Ok(format!("CSV export completed: {}", options.output_path))
}

async fn export_json(
    pool: &sqlx::Pool<sqlx::MySql>,
    options: &ExportOptions,
) -> Result<String, String> {
    let output_dir = std::path::Path::new(&options.output_path);
    std::fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;

    for table in &options.tables {
        let rows =
            sqlx::query::<MySql>(&format!("SELECT * FROM `{}`.`{}`", options.database, table))
                .fetch_all(pool)
                .await
                .map_err(|e| e.to_string())?;

        let mut json_rows = Vec::new();
        for row in &rows {
            let mut obj = serde_json::Map::new();
            for (i, col) in row.columns().iter().enumerate() {
                let val: Option<String> = row.try_get(i).ok().flatten();
                obj.insert(
                    col.name().to_string(),
                    val.map(serde_json::Value::String)
                        .unwrap_or(serde_json::Value::Null),
                );
            }
            json_rows.push(serde_json::Value::Object(obj));
        }

        let json_str = serde_json::to_string_pretty(&json_rows).map_err(|e| e.to_string())?;
        let file_path = output_dir.join(format!("{}.json", table));
        std::fs::write(&file_path, json_str).map_err(|e| e.to_string())?;
    }

    Ok(format!("JSON export completed: {}", options.output_path))
}
