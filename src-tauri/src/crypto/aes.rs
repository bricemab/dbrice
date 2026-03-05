use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use once_cell::sync::OnceCell;
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use std::sync::Mutex;

const PBKDF2_ITERATIONS: u32 = 200_000;
const SALT_SIZE: usize = 16;
const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;

// ─── Session key cache ────────────────────────────────────────────────────────
// Derived once at login; all subsequent encrypt/decrypt calls use this.

static SESSION_KEY: OnceCell<Mutex<Option<[u8; KEY_SIZE]>>> = OnceCell::new();

fn session_cell() -> &'static Mutex<Option<[u8; KEY_SIZE]>> {
    SESSION_KEY.get_or_init(|| Mutex::new(None))
}

/// Call once at login/setup: derives the AES key from `password` + `app_salt`
/// and caches it for the lifetime of the process.
pub fn init_session_key(password: &str, app_salt: &[u8]) {
    let key = derive_key(password, app_salt);
    *session_cell().lock().unwrap() = Some(key);
}

pub fn clear_session_key() {
    *session_cell().lock().unwrap() = None;
}

fn get_cached_key() -> Result<[u8; KEY_SIZE]> {
    session_cell()
        .lock()
        .unwrap()
        .ok_or_else(|| anyhow::anyhow!("Session key not initialised — login first"))
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/// Derives an AES-256 key from a password and salt using PBKDF2.
pub fn derive_key(password: &str, salt: &[u8]) -> [u8; KEY_SIZE] {
    let mut key = [0u8; KEY_SIZE];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);
    key
}

// ─── Fast encrypt/decrypt (use cached session key, no per-call PBKDF2) ───────
// Format: "nonce:ciphertext" (2 parts, both base64)

pub fn encrypt_fast(plaintext: &str) -> Result<String> {
    let key_bytes = get_cached_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption failed: {:?}", e))?;

    Ok(format!(
        "{}:{}",
        B64.encode(nonce_bytes),
        B64.encode(ciphertext)
    ))
}

pub fn decrypt_fast(encoded: &str) -> Result<String> {
    let key_bytes = get_cached_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    // Expect exactly 2 parts: nonce:ciphertext
    let (nonce_b64, ct_b64) = encoded
        .split_once(':')
        .ok_or_else(|| anyhow::anyhow!("Invalid fast-encrypted data format"))?;

    let nonce_bytes = B64.decode(nonce_b64).context("Invalid nonce encoding")?;
    let ciphertext = B64.decode(ct_b64).context("Invalid ciphertext encoding")?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| anyhow::anyhow!("Decryption failed"))?;

    String::from_utf8(plaintext).context("Decrypted data is not valid UTF-8")
}

// ─── Slow encrypt/decrypt (legacy: per-call PBKDF2 with embedded salt) ───────
// Format: "salt:nonce:ciphertext" (3 parts)
// Used only for: password hash verification, and migrating old stored data.

fn encrypt_slow(plaintext: &str, password: &str) -> Result<String> {
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

    Ok(format!(
        "{}:{}:{}",
        B64.encode(salt),
        B64.encode(nonce_bytes),
        B64.encode(ciphertext)
    ))
}

fn decrypt_slow(encoded: &str, password: &str) -> Result<String> {
    let parts: Vec<&str> = encoded.splitn(3, ':').collect();
    if parts.len() != 3 {
        return Err(anyhow::anyhow!("Invalid encrypted data format"));
    }

    let salt = B64.decode(parts[0]).context("Invalid salt encoding")?;
    let nonce_bytes = B64.decode(parts[1]).context("Invalid nonce encoding")?;
    let ciphertext = B64
        .decode(parts[2])
        .context("Invalid ciphertext encoding")?;

    let key_bytes = derive_key(password, &salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| anyhow::anyhow!("Decryption failed — wrong password or corrupted data"))?;

    String::from_utf8(plaintext).context("Decrypted data is not valid UTF-8")
}

// ─── Migration helper ─────────────────────────────────────────────────────────

/// Decrypts a field that may be in old format (3 parts) or new format (2 parts).
/// Returns (plaintext, needs_migration).
pub fn decrypt_any(encoded: &str, password: &str) -> Result<(String, bool)> {
    let part_count = encoded.splitn(4, ':').count();
    if part_count == 2 {
        // New fast format
        Ok((decrypt_fast(encoded)?, false))
    } else {
        // Old slow format — decrypt and signal that re-encryption is needed
        Ok((decrypt_slow(encoded, password)?, true))
    }
}

// ─── Password hash (always slow — only called once at login/setup) ────────────

pub fn create_password_hash(password: &str) -> Result<String> {
    encrypt_slow(&format!("dbrice_verify:{}", password), password)
}

pub fn verify_password_hash(password: &str, hash: &str) -> bool {
    match decrypt_slow(hash, password) {
        Ok(plaintext) => plaintext.starts_with("dbrice_verify:"),
        Err(_) => false,
    }
}
