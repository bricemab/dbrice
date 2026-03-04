use serde::{Deserialize, Serialize};
use sqlx::{MySql, Row};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct MySQLUser {
    pub user: String,
    pub host: String,
    pub plugin: String,
    pub password_expired: bool,
    pub account_locked: bool,
}

#[command]
pub async fn get_users(connection_id: String) -> Result<Vec<MySQLUser>, String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query::<MySql>(
        "SELECT User, Host, plugin, password_expired, account_locked FROM mysql.user ORDER BY User, Host"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .filter_map(|r| {
            Some(MySQLUser {
                user: r.try_get::<String, _>(0).ok()?,
                host: r.try_get::<String, _>(1).ok()?,
                plugin: r.try_get::<String, _>(2).ok()?,
                password_expired: r.try_get::<String, _>(3).ok()? == "Y",
                account_locked: r.try_get::<String, _>(4).ok()? == "Y",
            })
        })
        .collect())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUserInput {
    pub user: String,
    pub host: String,
    pub plugin: String,
    pub password: Option<String>,
    pub require_ssl: bool,
    pub max_queries_per_hour: Option<u32>,
    pub max_updates_per_hour: Option<u32>,
    pub max_connections_per_hour: Option<u32>,
    pub max_user_connections: Option<u32>,
}

#[command]
pub async fn create_user(connection_id: String, input: CreateUserInput) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let password_clause = if let Some(ref pwd) = input.password {
        format!(
            " IDENTIFIED WITH {} BY '{}'",
            input.plugin,
            pwd.replace('\'', "\\'")
        )
    } else {
        format!(" IDENTIFIED WITH {}", input.plugin)
    };

    let ssl_clause = if input.require_ssl {
        " REQUIRE SSL"
    } else {
        ""
    };

    let limits_clause = {
        let mut parts = Vec::new();
        if let Some(v) = input.max_queries_per_hour {
            parts.push(format!("MAX_QUERIES_PER_HOUR {}", v));
        }
        if let Some(v) = input.max_updates_per_hour {
            parts.push(format!("MAX_UPDATES_PER_HOUR {}", v));
        }
        if let Some(v) = input.max_connections_per_hour {
            parts.push(format!("MAX_CONNECTIONS_PER_HOUR {}", v));
        }
        if let Some(v) = input.max_user_connections {
            parts.push(format!("MAX_USER_CONNECTIONS {}", v));
        }
        if parts.is_empty() {
            String::new()
        } else {
            format!(" WITH {}", parts.join(" "))
        }
    };

    let sql = format!(
        "CREATE USER '{}'@'{}'{}{}{}",
        input.user, input.host, password_clause, ssl_clause, limits_clause
    );

    sqlx::query::<MySql>(&sql)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn update_user(
    connection_id: String,
    original_user: String,
    original_host: String,
    input: CreateUserInput,
) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Update password if provided
    if let Some(ref pwd) = input.password {
        let sql = format!(
            "ALTER USER '{}'@'{}' IDENTIFIED WITH {} BY '{}'",
            original_user,
            original_host,
            input.plugin,
            pwd.replace('\'', "\\'")
        );
        sqlx::query::<MySql>(&sql)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Rename user if changed
    if original_user != input.user || original_host != input.host {
        let sql = format!(
            "RENAME USER '{}'@'{}' TO '{}'@'{}'",
            original_user, original_host, input.user, input.host
        );
        sqlx::query::<MySql>(&sql)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[command]
pub async fn delete_user(connection_id: String, user: String, host: String) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;
    sqlx::query::<MySql>(&format!("DROP USER '{}'@'{}'", user, host))
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn get_user_privileges(
    connection_id: String,
    user: String,
    host: String,
) -> Result<serde_json::Value, String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let rows = sqlx::query::<MySql>(&format!("SHOW GRANTS FOR '{}'@'{}'", user, host))
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let grants: Vec<String> = rows
        .iter()
        .filter_map(|r| r.try_get::<String, _>(0).ok())
        .collect();

    Ok(serde_json::json!({ "grants": grants }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GrantPrivilegesInput {
    pub user: String,
    pub host: String,
    pub database: Option<String>,
    pub table: Option<String>,
    pub privileges: Vec<String>,
    pub grant_option: bool,
}

#[command]
pub async fn grant_privileges(
    connection_id: String,
    input: GrantPrivilegesInput,
) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let privs = input.privileges.join(", ");
    let target = match (&input.database, &input.table) {
        (Some(db), Some(tbl)) => format!("`{}`.`{}`", db, tbl),
        (Some(db), None) => format!("`{}`.*", db),
        _ => "*.*".to_string(),
    };

    let with_grant = if input.grant_option {
        " WITH GRANT OPTION"
    } else {
        ""
    };

    let sql = format!(
        "GRANT {} ON {} TO '{}'@'{}'{}",
        privs, target, input.user, input.host, with_grant
    );

    sqlx::query::<MySql>(&sql)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query::<MySql>("FLUSH PRIVILEGES")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn revoke_privileges(
    connection_id: String,
    input: GrantPrivilegesInput,
) -> Result<(), String> {
    let pool = crate::commands::mysql::get_pool_extern(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let privs = input.privileges.join(", ");
    let target = match (&input.database, &input.table) {
        (Some(db), Some(tbl)) => format!("`{}`.`{}`", db, tbl),
        (Some(db), None) => format!("`{}`.*", db),
        _ => "*.*".to_string(),
    };

    let sql = format!(
        "REVOKE {} ON {} FROM '{}'@'{}'",
        privs, target, input.user, input.host
    );

    sqlx::query::<MySql>(&sql)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query::<MySql>("FLUSH PRIVILEGES")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
