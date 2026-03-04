use sqlx::{mysql::MySqlPoolOptions, Row};

const TEST_DB_URL: &str = "mysql://root:testroot@127.0.0.1:3307/testdb";
const WRONG_PASS_URL: &str = "mysql://root:wrongpass@127.0.0.1:3307/testdb";
const WRONG_HOST_URL: &str = "mysql://root:testroot@127.0.0.1:9999/testdb";
const WRONG_PORT_URL: &str = "mysql://root:testroot@127.0.0.1:9998/testdb";
const WRONG_USER_URL: &str = "mysql://nonexistent:testroot@127.0.0.1:3307/testdb";

#[tokio::test]
async fn test_valid_connection() {
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect(TEST_DB_URL)
        .await
        .expect("Should connect with valid credentials");

    let row = sqlx::query("SELECT 1 as val")
        .fetch_one(&pool)
        .await
        .expect("Should execute query");

    let val: i32 = row.try_get("val").expect("Should get value");
    assert_eq!(val, 1);
    pool.close().await;
}

#[tokio::test]
async fn test_wrong_password() {
    let result = MySqlPoolOptions::new()
        .max_connections(1)
        .connect_timeout(std::time::Duration::from_secs(5))
        .connect(WRONG_PASS_URL)
        .await;

    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("Access denied") || err.contains("denied"),
        "Expected 'Access denied', got: {}",
        err
    );
}

#[tokio::test]
async fn test_wrong_host() {
    let result = MySqlPoolOptions::new()
        .max_connections(1)
        .connect_timeout(std::time::Duration::from_secs(3))
        .connect(WRONG_HOST_URL)
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_wrong_port() {
    let result = MySqlPoolOptions::new()
        .max_connections(1)
        .connect_timeout(std::time::Duration::from_secs(3))
        .connect(WRONG_PORT_URL)
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_nonexistent_user() {
    let result = MySqlPoolOptions::new()
        .max_connections(1)
        .connect_timeout(std::time::Duration::from_secs(5))
        .connect(WRONG_USER_URL)
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_connection_persistence() {
    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(TEST_DB_URL)
        .await
        .expect("Should connect");

    // Execute multiple queries on the same pool
    for i in 0..5 {
        let row = sqlx::query(&format!("SELECT {} as n", i))
            .fetch_one(&pool)
            .await
            .expect("Query should succeed");
        let n: i32 = row.try_get("n").unwrap();
        assert_eq!(n, i);
    }

    pool.close().await;
}
