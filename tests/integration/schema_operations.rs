use sqlx::{mysql::MySqlPoolOptions, Row};

async fn get_pool() -> sqlx::Pool<sqlx::MySql> {
    MySqlPoolOptions::new()
        .max_connections(2)
        .connect("mysql://root:testroot@127.0.0.1:3307/testdb")
        .await
        .expect("Failed to connect")
}

#[tokio::test]
async fn test_create_table_with_pk_and_nn() {
    let pool = get_pool().await;
    sqlx::query("DROP TABLE IF EXISTS test_schema_create").execute(&pool).await.unwrap();

    sqlx::query(
        "CREATE TABLE test_schema_create (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"
    )
    .execute(&pool)
    .await
    .expect("CREATE TABLE should succeed");

    // Verify it exists
    let row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA='testdb' AND TABLE_NAME='test_schema_create'"
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let cnt: i64 = row.try_get("cnt").unwrap();
    assert_eq!(cnt, 1);

    sqlx::query("DROP TABLE IF EXISTS test_schema_create").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_alter_table_add_column() {
    let pool = get_pool().await;
    sqlx::query("DROP TABLE IF EXISTS test_alter").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE test_alter (id INT PRIMARY KEY)").execute(&pool).await.unwrap();

    sqlx::query("ALTER TABLE test_alter ADD COLUMN new_col VARCHAR(100)")
        .execute(&pool)
        .await
        .expect("ALTER TABLE ADD COLUMN should succeed");

    let row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='testdb' AND TABLE_NAME='test_alter' AND COLUMN_NAME='new_col'"
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let cnt: i64 = row.try_get("cnt").unwrap();
    assert_eq!(cnt, 1);

    sqlx::query("DROP TABLE IF EXISTS test_alter").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_alter_table_drop_column() {
    let pool = get_pool().await;
    sqlx::query("DROP TABLE IF EXISTS test_drop_col").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE test_drop_col (id INT PRIMARY KEY, to_drop VARCHAR(50))")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("ALTER TABLE test_drop_col DROP COLUMN to_drop")
        .execute(&pool)
        .await
        .expect("ALTER TABLE DROP COLUMN should succeed");

    sqlx::query("DROP TABLE IF EXISTS test_drop_col").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_add_and_drop_index() {
    let pool = get_pool().await;
    sqlx::query("DROP TABLE IF EXISTS test_index").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE test_index (id INT PRIMARY KEY, email VARCHAR(255))")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("CREATE INDEX idx_email ON test_index(email)")
        .execute(&pool)
        .await
        .expect("CREATE INDEX should succeed");

    sqlx::query("DROP INDEX idx_email ON test_index")
        .execute(&pool)
        .await
        .expect("DROP INDEX should succeed");

    sqlx::query("DROP TABLE IF EXISTS test_index").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_foreign_key() {
    let pool = get_pool().await;
    sqlx::query("DROP TABLE IF EXISTS test_fk_child").execute(&pool).await.unwrap();
    sqlx::query("DROP TABLE IF EXISTS test_fk_parent").execute(&pool).await.unwrap();

    sqlx::query("CREATE TABLE test_fk_parent (id INT PRIMARY KEY)")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "CREATE TABLE test_fk_child (
            id INT PRIMARY KEY,
            parent_id INT,
            CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES test_fk_parent(id) ON DELETE CASCADE
        )"
    )
    .execute(&pool)
    .await
    .expect("CREATE TABLE with FK should succeed");

    sqlx::query("DROP TABLE IF EXISTS test_fk_child").execute(&pool).await.unwrap();
    sqlx::query("DROP TABLE IF EXISTS test_fk_parent").execute(&pool).await.unwrap();
    pool.close().await;
}

#[tokio::test]
async fn test_truncate_table() {
    let pool = get_pool().await;
    sqlx::query("DROP TABLE IF EXISTS test_truncate").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE test_truncate (id INT AUTO_INCREMENT PRIMARY KEY)")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO test_truncate VALUES (), (), ()").execute(&pool).await.unwrap();

    sqlx::query("TRUNCATE TABLE test_truncate")
        .execute(&pool)
        .await
        .expect("TRUNCATE should succeed");

    let row = sqlx::query("SELECT COUNT(*) as cnt FROM test_truncate")
        .fetch_one(&pool)
        .await
        .unwrap();
    let cnt: i64 = row.try_get("cnt").unwrap();
    assert_eq!(cnt, 0, "Table should be empty after TRUNCATE");

    sqlx::query("DROP TABLE IF EXISTS test_truncate").execute(&pool).await.unwrap();
    pool.close().await;
}
