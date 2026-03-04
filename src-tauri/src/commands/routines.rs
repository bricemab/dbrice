use serde::{Deserialize, Serialize};
use sqlx::{MySql, Row};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct RoutineInfo {
    pub name: String,
    pub routine_type: String,
    pub definition: String,
    pub parameters: Vec<RoutineParamInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoutineParamInfo {
    pub name: String,
    pub mode: String,
    pub data_type: String,
}

#[command]
pub async fn get_routine_definition(
    connection_id: String,
    database: String,
    name: String,
    routine_type: String,
) -> Result<RoutineInfo, String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let row = sqlx::query::<MySql>(&format!(
        "SELECT ROUTINE_NAME, ROUTINE_TYPE, ROUTINE_DEFINITION
         FROM information_schema.ROUTINES
         WHERE ROUTINE_SCHEMA = '{}' AND ROUTINE_NAME = '{}' AND ROUTINE_TYPE = '{}'",
        database,
        name,
        routine_type.to_uppercase()
    ))
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let params_rows = sqlx::query::<MySql>(&format!(
        "SELECT PARAMETER_NAME, PARAMETER_MODE, DATA_TYPE
         FROM information_schema.PARAMETERS
         WHERE SPECIFIC_SCHEMA = '{}' AND SPECIFIC_NAME = '{}'
         ORDER BY ORDINAL_POSITION",
        database, name
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let parameters = params_rows
        .iter()
        .filter_map(|r| {
            let param_name: String = r.try_get(0).ok()?;
            if param_name.is_empty() {
                return None; // Skip return type
            }
            Some(RoutineParamInfo {
                name: param_name,
                mode: r
                    .try_get::<Option<String>, _>(1)
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "IN".to_string()),
                data_type: r.try_get::<String, _>(2).ok()?,
            })
        })
        .collect();

    Ok(RoutineInfo {
        name: row.try_get(0).map_err(|e| e.to_string())?,
        routine_type: row.try_get(1).map_err(|e| e.to_string())?,
        definition: row
            .try_get::<Option<String>, _>(2)
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        parameters,
    })
}

#[command]
pub async fn save_routine(connection_id: String, sql: String) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    for statement in sql.split("$$").filter(|s| !s.trim().is_empty()) {
        sqlx::query::<MySql>(statement.trim())
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn drop_routine(
    connection_id: String,
    database: String,
    name: String,
    routine_type: String,
) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    sqlx::query::<MySql>(&format!(
        "DROP {} IF EXISTS `{}`.`{}`",
        routine_type.to_uppercase(),
        database,
        name
    ))
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteRoutineInput {
    pub connection_id: String,
    pub database: String,
    pub name: String,
    pub routine_type: String,
    pub params: Vec<String>,
}

#[command]
pub async fn execute_routine(
    input: ExecuteRoutineInput,
) -> Result<crate::models::query::QueryResult, String> {
    let params_str = input
        .params
        .iter()
        .map(|p| format!("'{}'", p.replace('\'', "\\'")))
        .collect::<Vec<_>>()
        .join(", ");

    let sql = if input.routine_type.to_uppercase() == "PROCEDURE" {
        format!("CALL `{}`.`{}`({})", input.database, input.name, params_str)
    } else {
        format!(
            "SELECT `{}`.`{}`({})",
            input.database, input.name, params_str
        )
    };

    crate::commands::mysql::execute_query(crate::commands::mysql::ExecuteQueryInput {
        connection_id: input.connection_id,
        sql,
        limit: None,
    })
    .await
}
