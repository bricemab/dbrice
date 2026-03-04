use anyhow::{Context, Result};
use keyring::Entry;

const SERVICE_NAME: &str = "DBrice";

/// Store a secret in the OS keychain
pub fn store_secret(key: &str, value: &str) -> Result<()> {
    let entry = Entry::new(SERVICE_NAME, key).context("Failed to create keychain entry")?;
    entry
        .set_password(value)
        .context("Failed to store secret in keychain")?;
    Ok(())
}

/// Retrieve a secret from the OS keychain
pub fn get_secret(key: &str) -> Result<Option<String>> {
    let entry = Entry::new(SERVICE_NAME, key).context("Failed to create keychain entry")?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(anyhow::anyhow!("Failed to get secret from keychain: {}", e)),
    }
}

/// Delete a secret from the OS keychain
pub fn delete_secret(key: &str) -> Result<()> {
    let entry = Entry::new(SERVICE_NAME, key).context("Failed to create keychain entry")?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(anyhow::anyhow!(
            "Failed to delete secret from keychain: {}",
            e
        )),
    }
}

// Keychain key conventions
pub fn master_password_hash_key() -> String {
    "master_password_hash".to_string()
}

pub fn mysql_password_key(connection_id: &str) -> String {
    format!("mysql_password_{}", connection_id)
}

pub fn ssh_password_key(connection_id: &str) -> String {
    format!("ssh_password_{}", connection_id)
}

/// Clears all DBrice keychain entries (used for reset)
pub fn clear_all_secrets(connection_ids: &[String]) -> Result<()> {
    delete_secret(&master_password_hash_key())?;
    for id in connection_ids {
        let _ = delete_secret(&mysql_password_key(id));
        let _ = delete_secret(&ssh_password_key(id));
    }
    Ok(())
}
