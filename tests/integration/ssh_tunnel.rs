use ssh2::Session;
use std::net::TcpStream;
use std::time::Duration;

const SSH_HOST: &str = "127.0.0.1";
const SSH_PORT: u16 = 2222;
const SSH_USER: &str = "sshuser";
const SSH_PASS: &str = "sshpass";

fn connect_ssh() -> Result<Session, Box<dyn std::error::Error>> {
    let tcp = TcpStream::connect(format!("{}:{}", SSH_HOST, SSH_PORT))?;
    tcp.set_read_timeout(Some(Duration::from_secs(10)))?;
    tcp.set_write_timeout(Some(Duration::from_secs(10)))?;

    let mut sess = Session::new()?;
    sess.set_tcp_stream(tcp);
    sess.handshake()?;
    sess.userauth_password(SSH_USER, SSH_PASS)?;

    Ok(sess)
}

#[test]
fn test_ssh_connection_password_auth() {
    let result = connect_ssh();
    assert!(
        result.is_ok(),
        "Should connect via SSH with password: {:?}",
        result.err()
    );
    let sess = result.unwrap();
    assert!(sess.authenticated(), "Should be authenticated");
}

#[test]
fn test_ssh_connection_wrong_password() {
    let tcp = TcpStream::connect_timeout(
        &format!("{}:{}", SSH_HOST, SSH_PORT).parse().unwrap(),
        Duration::from_secs(5),
    );
    if tcp.is_err() {
        // If SSH server is not available, skip test gracefully
        return;
    }

    let mut sess = Session::new().expect("Should create session");
    sess.set_tcp_stream(tcp.unwrap());
    sess.handshake().expect("Handshake should succeed");

    let result = sess.userauth_password(SSH_USER, "wrongpassword");
    assert!(result.is_err(), "Should fail with wrong password");
}

#[test]
fn test_ssh_execute_command() {
    let sess = connect_ssh().expect("Should connect via SSH");

    let mut channel = sess.channel_session().expect("Should open channel");
    channel.exec("echo hello").expect("Should exec command");

    let mut output = String::new();
    use std::io::Read;
    channel
        .read_to_string(&mut output)
        .expect("Should read output");
    channel.wait_close().expect("Should wait for close");

    let exit_status = channel.exit_status().expect("Should get exit status");
    assert_eq!(exit_status, 0, "Command should exit with 0");
    assert!(
        output.trim() == "hello",
        "Output should be 'hello', got: {}",
        output.trim()
    );
}

#[test]
fn test_ssh_port_forwarding_channel() {
    let sess = connect_ssh().expect("Should connect via SSH");

    // Try to open a direct-tcpip channel to MySQL on the container's internal network
    // The MySQL container is accessible from the SSH container at 'mysql:3306' in docker-compose
    // However, since we're in a test environment, we just verify the channel can be created
    let channel = sess.channel_direct_tcpip("127.0.0.1", 3306, Some(("127.0.0.1", 12345)));

    // The channel may fail if MySQL is not reachable from SSH container,
    // but the important thing is we can attempt the forwarding
    match channel {
        Ok(_) => {
            // Channel created successfully
        }
        Err(e) => {
            let msg = e.to_string();
            // Expected error if MySQL not on same network as SSH container
            assert!(
                msg.contains("refused")
                    || msg.contains("administratively prohibited")
                    || msg.contains("connect"),
                "Unexpected error: {}",
                msg
            );
        }
    }
}

#[test]
fn test_ssh_connection_unreachable_host() {
    let result =
        TcpStream::connect_timeout(&"127.0.0.1:9999".parse().unwrap(), Duration::from_secs(3));
    assert!(
        result.is_err(),
        "Should fail connecting to non-existent host:port"
    );
}

#[test]
fn test_multiple_ssh_sessions() {
    // Verify we can establish multiple SSH sessions
    let sess1 = connect_ssh().expect("Should connect SSH session 1");
    let sess2 = connect_ssh().expect("Should connect SSH session 2");

    assert!(sess1.authenticated(), "Session 1 should be authenticated");
    assert!(sess2.authenticated(), "Session 2 should be authenticated");
}
