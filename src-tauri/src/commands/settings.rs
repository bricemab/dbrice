use serde::{Deserialize, Serialize};
use tauri::command;

use crate::db::local::{get_setting, set_setting};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub default_limit: u32,
    pub app_version: String,
}

#[command]
pub async fn get_settings() -> Result<AppSettings, String> {
    let theme = get_setting("theme")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "\"system\"".to_string());
    let theme = serde_json::from_str::<String>(&theme).unwrap_or_else(|_| "system".to_string());

    let default_limit: u32 = get_setting("default_limit")
        .map_err(|e| e.to_string())?
        .and_then(|v| v.parse().ok())
        .unwrap_or(1000);

    let app_version = get_setting("app_version")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "\"1.0.0\"".to_string());
    let app_version =
        serde_json::from_str::<String>(&app_version).unwrap_or_else(|_| "1.0.0".to_string());

    Ok(AppSettings {
        theme,
        default_limit,
        app_version,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSettingsInput {
    pub theme: Option<String>,
    pub default_limit: Option<u32>,
}

#[command]
pub async fn update_settings(input: UpdateSettingsInput) -> Result<(), String> {
    if let Some(theme) = input.theme {
        let json = serde_json::to_string(&theme).map_err(|e| e.to_string())?;
        set_setting("theme", &json).map_err(|e| e.to_string())?;
    }
    if let Some(limit) = input.default_limit {
        set_setting("default_limit", &limit.to_string()).map_err(|e| e.to_string())?;
    }
    Ok(())
}
