use anyhow::{Context, Result};
use ssh2::Session;
use std::collections::HashMap;
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use once_cell::sync::Lazy;

static TUNNELS: Lazy<Mutex<HashMap<String, TunnelHandle>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub struct TunnelHandle {
    pub local_port: u16,
    pub stop_tx: std::sync::mpsc::Sender<()>,
}

pub struct TunnelConfig {
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

/// Establishes an SSH tunnel and returns the local port
pub fn establish_tunnel(config: TunnelConfig) -> Result<u16> {
    // Find a free local port
    let listener = TcpListener::bind("127.0.0.1:0").context("Failed to bind local port")?;
    let local_port = listener.local_addr()?.port();
    drop(listener);

    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    let config = Arc::new(config);

    // Establish SSH connection
    let tcp = TcpStream::connect(format!("{}:{}", config.ssh_hostname, config.ssh_port))
        .with_context(|| format!("Failed to connect to SSH host {}:{}", config.ssh_hostname, config.ssh_port))?;

    let mut session = Session::new().context("Failed to create SSH session")?;
    session.set_tcp_stream(tcp);
    session.handshake().context("SSH handshake failed")?;

    // Authenticate
    if let Some(ref key_file) = config.ssh_key_file {
        let passphrase = config.ssh_key_passphrase.as_deref();
        session
            .userauth_pubkey_file(
                &config.ssh_username,
                None,
                std::path::Path::new(key_file),
                passphrase,
            )
            .context("SSH key authentication failed")?;
    } else if let Some(ref password) = config.ssh_password {
        session
            .userauth_password(&config.ssh_username, password)
            .context("SSH password authentication failed")?;
    } else {
        return Err(anyhow::anyhow!("No SSH authentication method provided"));
    }

    if !session.authenticated() {
        return Err(anyhow::anyhow!("SSH authentication failed"));
    }

    let session = Arc::new(Mutex::new(session));
    let mysql_hostname = config.mysql_hostname.clone();
    let mysql_port = config.mysql_port;
    let connection_id = config.connection_id.clone();

    // Start tunnel thread
    thread::spawn(move || {
        let listener = match TcpListener::bind(format!("127.0.0.1:{}", local_port)) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Failed to bind tunnel listener: {}", e);
                return;
            }
        };
        listener.set_nonblocking(true).ok();

        loop {
            // Check stop signal
            if stop_rx.try_recv().is_ok() {
                break;
            }

            match listener.accept() {
                Ok((mut local_stream, _)) => {
                    let sess = Arc::clone(&session);
                    let host = mysql_hostname.clone();
                    let port = mysql_port;

                    thread::spawn(move || {
                        let sess_guard = match sess.lock() {
                            Ok(g) => g,
                            Err(_) => return,
                        };
                        match sess_guard.channel_direct_tcpip(&host, port, None) {
                            Ok(mut channel) => {
                                let _ = std::io::copy(&mut local_stream, &mut channel);
                            }
                            Err(e) => {
                                eprintln!("Tunnel channel error: {}", e);
                            }
                        }
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(std::time::Duration::from_millis(50));
                }
                Err(e) => {
                    eprintln!("Tunnel accept error: {}", e);
                    break;
                }
            }
        }
        eprintln!("SSH tunnel closed for connection {}", connection_id);
    });

    // Store handle
    let mut tunnels = TUNNELS.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
    tunnels.insert(
        config.connection_id.clone(),
        TunnelHandle { local_port, stop_tx },
    );

    Ok(local_port)
}

/// Close an SSH tunnel by connection ID
pub fn close_tunnel(connection_id: &str) -> Result<()> {
    let mut tunnels = TUNNELS.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
    if let Some(handle) = tunnels.remove(connection_id) {
        let _ = handle.stop_tx.send(());
    }
    Ok(())
}

/// Get the local port for an existing tunnel
pub fn get_tunnel_port(connection_id: &str) -> Option<u16> {
    TUNNELS
        .lock()
        .ok()?
        .get(connection_id)
        .map(|h| h.local_port)
}

/// Test SSH connection without establishing a tunnel
pub fn test_ssh_connection(
    hostname: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    key_file: Option<&str>,
    key_passphrase: Option<&str>,
) -> Result<()> {
    let tcp = TcpStream::connect(format!("{}:{}", hostname, port))
        .with_context(|| format!("Failed to connect to SSH host {}:{}", hostname, port))?;

    let mut session = Session::new().context("Failed to create SSH session")?;
    session.set_tcp_stream(tcp);
    session.handshake().context("SSH handshake failed")?;

    if let Some(key_file) = key_file {
        session
            .userauth_pubkey_file(
                username,
                None,
                std::path::Path::new(key_file),
                key_passphrase,
            )
            .context("SSH key authentication failed")?;
    } else if let Some(password) = password {
        session
            .userauth_password(username, password)
            .context("SSH password authentication failed")?;
    } else {
        return Err(anyhow::anyhow!("No SSH authentication method provided"));
    }

    if !session.authenticated() {
        return Err(anyhow::anyhow!("SSH authentication failed"));
    }

    Ok(())
}
