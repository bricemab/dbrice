use sqlx::{mysql::MySqlPoolOptions, Row};

const TEST_DB_URL: &str = "mysql://root:testroot@127.0.0.1:3307/testdb";

async fn get_pool() -> sqlx::Pool<sqlx::MySql> {
    MySqlPoolOptions::new()
        .max_connections(1)
        .connect(TEST_DB_URL)
        .await
        .expect("Should connect to test database")
}

#[tokio::test]
async fn test_create_user() {
    let pool = get_pool().await;

    // Drop user if exists from previous test run
    let _ = sqlx::query("DROP USER IF EXISTS 'test_integration_user'@'%'")
        .execute(&pool)
        .await;

    // Create a new user
    sqlx::query("CREATE USER 'test_integration_user'@'%' IDENTIFIED BY 'testpass123'")
        .execute(&pool)
        .await
        .expect("Should create user");

    // Verify user exists
    let row = sqlx::query(
        "SELECT user, host FROM mysql.user WHERE user = 'test_integration_user' AND host = '%'",
    )
    .fetch_one(&pool)
    .await
    .expect("User should exist after creation");

    let user: String = row.try_get("user").unwrap();
    assert_eq!(user, "test_integration_user");

    // Cleanup
    sqlx::query("DROP USER IF EXISTS 'test_integration_user'@'%'")
        .execute(&pool)
        .await
        .expect("Should drop user");

    pool.close().await;
}

#[tokio::test]
async fn test_grant_and_revoke_privileges() {
    let pool = get_pool().await;

    // Setup: create user
    let _ = sqlx::query("DROP USER IF EXISTS 'priv_test_user'@'%'")
        .execute(&pool)
        .await;

    sqlx::query("CREATE USER 'priv_test_user'@'%' IDENTIFIED BY 'testpass123'")
        .execute(&pool)
        .await
        .expect("Should create user");

    // Grant SELECT on testdb
    sqlx::query("GRANT SELECT ON testdb.* TO 'priv_test_user'@'%'")
        .execute(&pool)
        .await
        .expect("Should grant SELECT privilege");

    sqlx::query("FLUSH PRIVILEGES")
        .execute(&pool)
        .await
        .expect("Should flush privileges");

    // Verify privilege was granted
    let rows = sqlx::query("SHOW GRANTS FOR 'priv_test_user'@'%'")
        .fetch_all(&pool)
        .await
        .expect("Should show grants");

    let has_select = rows.iter().any(|row| {
        let grant: String = row.try_get(0).unwrap_or_default();
        grant.contains("SELECT")
    });
    assert!(has_select, "User should have SELECT privilege");

    // Revoke privilege
    sqlx::query("REVOKE SELECT ON testdb.* FROM 'priv_test_user'@'%'")
        .execute(&pool)
        .await
        .expect("Should revoke SELECT privilege");

    sqlx::query("FLUSH PRIVILEGES")
        .execute(&pool)
        .await
        .expect("Should flush privileges");

    // Cleanup
    sqlx::query("DROP USER IF EXISTS 'priv_test_user'@'%'")
        .execute(&pool)
        .await
        .expect("Should drop user");

    pool.close().await;
}

#[tokio::test]
async fn test_list_users() {
    let pool = get_pool().await;

    let rows = sqlx::query("SELECT user, host FROM mysql.user WHERE user != ''")
        .fetch_all(&pool)
        .await
        .expect("Should list users");

    // There should be at least the root user
    assert!(rows.len() > 0, "Should have at least one user");

    let has_root = rows.iter().any(|row| {
        let user: String = row.try_get("user").unwrap_or_default();
        user == "root"
    });
    assert!(has_root, "Should have root user");

    pool.close().await;
}

#[tokio::test]
async fn test_drop_nonexistent_user() {
    let pool = get_pool().await;

    // DROP USER IF EXISTS should not fail even if user doesn't exist
    sqlx::query("DROP USER IF EXISTS 'nonexistent_ghost_user'@'%'")
        .execute(&pool)
        .await
        .expect("DROP USER IF EXISTS should succeed even if user doesn't exist");

    pool.close().await;
}

#[tokio::test]
async fn test_user_password_change() {
    let pool = get_pool().await;

    // Create test user
    let _ = sqlx::query("DROP USER IF EXISTS 'pwchange_user'@'%'")
        .execute(&pool)
        .await;

    sqlx::query("CREATE USER 'pwchange_user'@'%' IDENTIFIED BY 'oldpassword123'")
        .execute(&pool)
        .await
        .expect("Should create user");

    // Change password
    sqlx::query("ALTER USER 'pwchange_user'@'%' IDENTIFIED BY 'newpassword456'")
        .execute(&pool)
        .await
        .expect("Should change password");

    // Verify user can connect with new password
    let new_url = "mysql://pwchange_user:newpassword456@127.0.0.1:3307/testdb";
    let new_pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect_timeout(std::time::Duration::from_secs(5))
        .connect(new_url)
        .await;

    assert!(new_pool.is_ok(), "Should connect with new password");
    if let Ok(p) = new_pool {
        p.close().await;
    }

    // Verify old password no longer works
    let old_url = "mysql://pwchange_user:oldpassword123@127.0.0.1:3307/testdb";
    let old_pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect_timeout(std::time::Duration::from_secs(3))
        .connect(old_url)
        .await;
    assert!(old_pool.is_err(), "Old password should no longer work");

    // Cleanup
    sqlx::query("DROP USER IF EXISTS 'pwchange_user'@'%'")
        .execute(&pool)
        .await
        .expect("Should drop user");

    pool.close().await;
}

#[tokio::test]
async fn test_grant_all_privileges() {
    let pool = get_pool().await;

    let _ = sqlx::query("DROP USER IF EXISTS 'allpriv_user'@'%'")
        .execute(&pool)
        .await;

    sqlx::query("CREATE USER 'allpriv_user'@'%' IDENTIFIED BY 'testpass123'")
        .execute(&pool)
        .await
        .expect("Should create user");

    sqlx::query("GRANT ALL PRIVILEGES ON testdb.* TO 'allpriv_user'@'%'")
        .execute(&pool)
        .await
        .expect("Should grant all privileges");

    sqlx::query("FLUSH PRIVILEGES")
        .execute(&pool)
        .await
        .expect("Should flush privileges");

    // Connect as this user and verify access
    let user_url = "mysql://allpriv_user:testpass123@127.0.0.1:3307/testdb";
    let user_pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect_timeout(std::time::Duration::from_secs(5))
        .connect(user_url)
        .await
        .expect("Should connect with allpriv_user");

    // Create a table to verify CREATE privilege
    let _ = sqlx::query("DROP TABLE IF EXISTS priv_test_table")
        .execute(&user_pool)
        .await;

    sqlx::query("CREATE TABLE priv_test_table (id INT PRIMARY KEY)")
        .execute(&user_pool)
        .await
        .expect("Should create table with allpriv_user");

    sqlx::query("DROP TABLE IF EXISTS priv_test_table")
        .execute(&user_pool)
        .await
        .expect("Should drop table with allpriv_user");

    user_pool.close().await;

    // Cleanup
    sqlx::query("DROP USER IF EXISTS 'allpriv_user'@'%'")
        .execute(&pool)
        .await
        .expect("Should drop user");

    pool.close().await;
}
