use sqlx::{mysql::MySqlPoolOptions, Row};

async fn get_pool() -> sqlx::Pool<sqlx::MySql> {
    MySqlPoolOptions::new()
        .max_connections(2)
        .connect("mysql://root:testroot@127.0.0.1:3307/testdb")
        .await
        .expect("Failed to connect")
}

#[tokio::test]
async fn test_simple_select() {
    let pool = get_pool().await;
    let rows = sqlx::query("SELECT 1 as a, 2 as b, 3 as c")
        .fetch_all(&pool)
        .await
        .expect("SELECT should succeed");

    assert_eq!(rows.len(), 1);
    let a: i32 = rows[0].try_get("a").unwrap();
    let b: i32 = rows[0].try_get("b").unwrap();
    let c: i32 = rows[0].try_get("c").unwrap();
    assert_eq!(a, 1);
    assert_eq!(b, 2);
    assert_eq!(c, 3);
    pool.close().await;
}

#[tokio::test]
async fn test_select_with_limit() {
    let pool = get_pool().await;

    // Create test table
    sqlx::query("CREATE TABLE IF NOT EXISTS test_limit (id INT AUTO_INCREMENT PRIMARY KEY, val INT)")
        .execute(&pool)
        .await
        .unwrap();

    // Insert 10 rows
    for i in 0..10 {
        sqlx::query(&format!("INSERT INTO test_limit (val) VALUES ({})", i))
            .execute(&pool)
            .await
            .unwrap();
    }

    let rows = sqlx::query("SELECT * FROM test_limit LIMIT 5")
        .fetch_all(&pool)
        .await
        .expect("SELECT with LIMIT should succeed");

    assert_eq!(rows.len(), 5);

    sqlx::query("DROP TABLE IF EXISTS test_limit").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_insert_rows_affected() {
    let pool = get_pool().await;

    sqlx::query("CREATE TABLE IF NOT EXISTS test_insert (id INT AUTO_INCREMENT PRIMARY KEY, val TEXT)")
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("INSERT INTO test_insert (val) VALUES ('hello')")
        .execute(&pool)
        .await
        .expect("INSERT should succeed");

    assert_eq!(result.rows_affected(), 1);

    sqlx::query("DROP TABLE IF EXISTS test_insert").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_update_rows_affected() {
    let pool = get_pool().await;

    sqlx::query("CREATE TABLE IF NOT EXISTS test_update (id INT AUTO_INCREMENT PRIMARY KEY, val INT)")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO test_update (val) VALUES (1), (2), (3)")
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("UPDATE test_update SET val = val + 10")
        .execute(&pool)
        .await
        .expect("UPDATE should succeed");

    assert_eq!(result.rows_affected(), 3);

    sqlx::query("DROP TABLE IF EXISTS test_update").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_delete_rows_affected() {
    let pool = get_pool().await;

    sqlx::query("CREATE TABLE IF NOT EXISTS test_delete (id INT AUTO_INCREMENT PRIMARY KEY)")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO test_delete VALUES (), (), ()")
        .execute(&pool)
        .await
        .unwrap();

    let result = sqlx::query("DELETE FROM test_delete WHERE id > 0")
        .execute(&pool)
        .await
        .expect("DELETE should succeed");

    assert_eq!(result.rows_affected(), 3);

    sqlx::query("DROP TABLE IF EXISTS test_delete").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_syntax_error() {
    let pool = get_pool().await;

    let result = sqlx::query("SELEC * FORM nonexistent")
        .execute(&pool)
        .await;

    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(err.contains("1064") || err.contains("syntax"), "Expected syntax error: {}", err);

    pool.close().await;
}

#[tokio::test]
async fn test_empty_table_select() {
    let pool = get_pool().await;

    sqlx::query("CREATE TABLE IF NOT EXISTS test_empty (id INT, name VARCHAR(50))")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("TRUNCATE TABLE test_empty")
        .execute(&pool)
        .await
        .unwrap();

    let rows = sqlx::query("SELECT * FROM test_empty")
        .fetch_all(&pool)
        .await
        .expect("SELECT on empty table should succeed");

    assert_eq!(rows.len(), 0);
    // Columns should still be accessible from column metadata
    // (This depends on how sqlx handles empty resultsets)

    sqlx::query("DROP TABLE IF EXISTS test_empty").execute(&pool).await.unwrap();
    pool.close().await;
}
