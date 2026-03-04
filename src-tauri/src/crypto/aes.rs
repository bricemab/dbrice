use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;
use anyhow::{Context, Result};
use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;

const PBKDF2_ITERATIONS: u32 = 200_000;
const SALT_SIZE: usize = 16;
const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;

/// Derives an AES-256 key from a master password and salt
pub fn derive_key(password: &str, salt: &[u8]) -> [u8; KEY_SIZE] {
    let mut key = [0u8; KEY_SIZE];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);
    key
}

/// Encrypts plaintext using AES-256-GCM with a derived key
/// Returns base64-encoded "salt:nonce:ciphertext"
pub fn encrypt(plaintext: &str, password: &str) -> Result<String> {
    let mut salt = [0u8; SALT_SIZE];
    OsRng.fill_bytes(&mut salt);

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);

    let key_bytes = derive_key(password, &salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption failed: {:?}", e))?;

    let result = format!(
        "{}:{}:{}",
        B64.encode(salt),
        B64.encode(nonce_bytes),
        B64.encode(ciphertext)
    );
    Ok(result)
}

/// Decrypts a base64-encoded "salt:nonce:ciphertext" string
pub fn decrypt(encoded: &str, password: &str) -> Result<String> {
    let parts: Vec<&str> = encoded.splitn(3, ':').collect();
    if parts.len() != 3 {
        return Err(anyhow::anyhow!("Invalid encrypted data format"));
    }

    let salt = B64.decode(parts[0]).context("Invalid salt encoding")?;
    let nonce_bytes = B64.decode(parts[1]).context("Invalid nonce encoding")?;
    let ciphertext = B64.decode(parts[2]).context("Invalid ciphertext encoding")?;

    let key_bytes = derive_key(password, &salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| anyhow::anyhow!("Decryption failed — wrong password or corrupted data"))?;

    String::from_utf8(plaintext).context("Decrypted data is not valid UTF-8")
}

/// Creates a password verifier hash (to verify the master password without decrypting data)
pub fn create_password_hash(password: &str) -> Result<String> {
    let mut salt = [0u8; SALT_SIZE];
    OsRng.fill_bytes(&mut salt);
    encrypt(&format!("dbrice_verify:{}", password), password)
}

/// Verifies a master password against a stored hash
pub fn verify_password_hash(password: &str, hash: &str) -> bool {
    match decrypt(hash, password) {
        Ok(plaintext) => plaintext.starts_with("dbrice_verify:"),
        Err(_) => false,
    }
}
