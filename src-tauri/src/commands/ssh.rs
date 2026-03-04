use serde::{Deserialize, Serialize};
use tauri::command;

use crate::ssh::tunnel;

#[derive(Debug, Serialize, Deserialize)]
pub struct EstablishTunnelInput {
    pub connection_id: String,
    pub ssh_hostname: String,
    pub ssh_port: u16,
    pub ssh_username: String,
    pub ssh_password: Option<String>,
    pub ssh_key_file: Option<String>,
    pub ssh_key_passphrase: Option<String>,
    pub mysql_hostname: String,
    pub mysql_port: u16,
}

#[command]
pub async fn establish_tunnel(input: EstablishTunnelInput) -> Result<u16, String> {
    let config = tunnel::TunnelConfig {
        connection_id: input.connection_id,
        ssh_hostname: input.ssh_hostname,
        ssh_port: input.ssh_port,
        ssh_username: input.ssh_username,
        ssh_password: input.ssh_password,
        ssh_key_file: input.ssh_key_file,
        ssh_key_passphrase: input.ssh_key_passphrase,
        mysql_hostname: input.mysql_hostname,
        mysql_port: input.mysql_port,
    };

    tunnel::establish_tunnel(config).map_err(|e| e.to_string())
}

#[command]
pub async fn close_tunnel(connection_id: String) -> Result<(), String> {
    tunnel::close_tunnel(&connection_id).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestSshInput {
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub key_file: Option<String>,
    pub key_passphrase: Option<String>,
}

#[command]
pub async fn test_ssh_connection(input: TestSshInput) -> Result<(), String> {
    tunnel::test_ssh_connection(
        &input.hostname,
        input.port,
        &input.username,
        input.password.as_deref(),
        input.key_file.as_deref(),
        input.key_passphrase.as_deref(),
    )
    .map_err(|e| e.to_string())
}
