use sqlx::{mysql::MySqlPoolOptions, Row};
use std::path::PathBuf;

const TEST_DB_URL: &str = "mysql://root:testroot@127.0.0.1:3307/testdb";

async fn get_pool() -> sqlx::Pool<sqlx::MySql> {
    MySqlPoolOptions::new()
        .max_connections(1)
        .connect(TEST_DB_URL)
        .await
        .expect("Should connect to test database")
}

/// Sets up a clean test table and inserts sample data.
async fn setup_export_table(pool: &sqlx::Pool<sqlx::MySql>) {
    let _ = sqlx::query("DROP TABLE IF EXISTS export_test_table")
        .execute(pool)
        .await;

    sqlx::query(
        "CREATE TABLE export_test_table (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            value DECIMAL(10,2) DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    )
    .execute(pool)
    .await
    .expect("Should create export_test_table");

    sqlx::query(
        "INSERT INTO export_test_table (name, value) VALUES
            ('Product A', 10.50),
            ('Product B', 25.00),
            ('Product C', 5.75),
            ('Product D', 100.00)",
    )
    .execute(pool)
    .await
    .expect("Should insert test data");
}

async fn cleanup_export_table(pool: &sqlx::Pool<sqlx::MySql>) {
    let _ = sqlx::query("DROP TABLE IF EXISTS export_test_table")
        .execute(pool)
        .await;
}

#[tokio::test]
async fn test_generate_create_table_statement() {
    let pool = get_pool().await;
    setup_export_table(&pool).await;

    let row = sqlx::query("SHOW CREATE TABLE testdb.export_test_table")
        .fetch_one(&pool)
        .await
        .expect("Should get CREATE TABLE statement");

    let create_sql: String = row.try_get(1).expect("Should get create statement");

    assert!(
        create_sql.contains("CREATE TABLE"),
        "Should contain CREATE TABLE"
    );
    assert!(
        create_sql.contains("export_test_table"),
        "Should contain table name"
    );
    assert!(create_sql.contains("id"), "Should contain id column");
    assert!(create_sql.contains("name"), "Should contain name column");
    assert!(
        create_sql.contains("AUTO_INCREMENT"),
        "Should contain AUTO_INCREMENT"
    );

    cleanup_export_table(&pool).await;
    pool.close().await;
}

#[tokio::test]
async fn test_export_select_to_csv_format() {
    let pool = get_pool().await;
    setup_export_table(&pool).await;

    let rows = sqlx::query("SELECT id, name, value FROM testdb.export_test_table ORDER BY id")
        .fetch_all(&pool)
        .await
        .expect("Should fetch data for CSV export");

    assert_eq!(rows.len(), 4, "Should have 4 rows");

    // Build CSV content manually (as our export would do)
    let mut csv = String::from("id;name;value\n");
    for row in &rows {
        let id: i32 = row.try_get("id").unwrap();
        let name: String = row.try_get("name").unwrap();
        let value: f64 = row.try_get("value").unwrap();
        csv.push_str(&format!("{};{};{:.2}\n", id, name, value));
    }

    assert!(csv.contains("Product A"), "CSV should contain Product A");
    assert!(csv.contains("Product B"), "CSV should contain Product B");
    assert!(csv.contains("10.50"), "CSV should contain value 10.50");

    cleanup_export_table(&pool).await;
    pool.close().await;
}

#[tokio::test]
async fn test_import_sql_statements() {
    let pool = get_pool().await;

    // Clean up first
    let _ = sqlx::query("DROP TABLE IF EXISTS import_roundtrip_table")
        .execute(&pool)
        .await;

    // Simulate import by executing SQL statements
    let import_sql = "CREATE TABLE import_roundtrip_table (
        id INT NOT NULL AUTO_INCREMENT,
        label VARCHAR(200) NOT NULL,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    sqlx::query(import_sql)
        .execute(&pool)
        .await
        .expect("Should create table via import SQL");

    let insert_sql =
        "INSERT INTO import_roundtrip_table (label) VALUES ('First'), ('Second'), ('Third')";
    let result = sqlx::query(insert_sql)
        .execute(&pool)
        .await
        .expect("Should insert data via import SQL");

    assert_eq!(result.rows_affected(), 3, "Should insert 3 rows");

    // Verify data is present
    let rows = sqlx::query("SELECT COUNT(*) as cnt FROM import_roundtrip_table")
        .fetch_one(&pool)
        .await
        .expect("Should count rows");
    let count: i64 = rows.try_get("cnt").unwrap();
    assert_eq!(count, 3, "Should have 3 rows after import");

    // Cleanup
    sqlx::query("DROP TABLE IF EXISTS import_roundtrip_table")
        .execute(&pool)
        .await
        .expect("Should drop import test table");

    pool.close().await;
}

#[tokio::test]
async fn test_export_import_roundtrip() {
    let pool = get_pool().await;

    // Create source table with data
    let _ = sqlx::query("DROP TABLE IF EXISTS roundtrip_source")
        .execute(&pool)
        .await;
    let _ = sqlx::query("DROP TABLE IF EXISTS roundtrip_dest")
        .execute(&pool)
        .await;

    sqlx::query(
        "CREATE TABLE roundtrip_source (
            id INT NOT NULL AUTO_INCREMENT,
            content TEXT,
            score FLOAT,
            PRIMARY KEY (id)
        )",
    )
    .execute(&pool)
    .await
    .expect("Should create source table");

    sqlx::query(
        "INSERT INTO roundtrip_source (content, score) VALUES
            ('Hello World', 9.5),
            ('Test Data', 7.2),
            ('Round Trip', 8.8)",
    )
    .execute(&pool)
    .await
    .expect("Should insert source data");

    // "Export": get CREATE + INSERT statements
    let create_row = sqlx::query("SHOW CREATE TABLE roundtrip_source")
        .fetch_one(&pool)
        .await
        .expect("Should get CREATE TABLE");
    let create_sql: String = create_row.try_get(1).unwrap();

    let data_rows = sqlx::query("SELECT * FROM roundtrip_source")
        .fetch_all(&pool)
        .await
        .expect("Should fetch source data");

    // Build INSERT statements
    let mut inserts = Vec::new();
    for row in &data_rows {
        let id: i32 = row.try_get("id").unwrap();
        let content: Option<String> = row.try_get("content").unwrap();
        let score: Option<f32> = row.try_get("score").unwrap();
        let content_val = content
            .map(|s| format!("'{}'", s.replace('\'', "''")))
            .unwrap_or_else(|| "NULL".to_string());
        let score_val = score
            .map(|v| format!("{}", v))
            .unwrap_or_else(|| "NULL".to_string());
        inserts.push(format!(
            "INSERT INTO roundtrip_dest (id, content, score) VALUES ({}, {}, {})",
            id, content_val, score_val
        ));
    }

    // "Import": re-create as roundtrip_dest
    let dest_create = create_sql.replace("roundtrip_source", "roundtrip_dest");
    sqlx::query(&dest_create)
        .execute(&pool)
        .await
        .expect("Should create destination table from exported SQL");

    for insert_stmt in &inserts {
        sqlx::query(insert_stmt)
            .execute(&pool)
            .await
            .expect("Should insert into destination");
    }

    // Verify roundtrip: dest has same data as source
    let dest_rows = sqlx::query("SELECT COUNT(*) as cnt FROM roundtrip_dest")
        .fetch_one(&pool)
        .await
        .expect("Should count dest rows");
    let dest_count: i64 = dest_rows.try_get("cnt").unwrap();
    assert_eq!(
        dest_count, 3,
        "Destination should have same row count as source"
    );

    // Cleanup
    let _ = sqlx::query("DROP TABLE IF EXISTS roundtrip_source")
        .execute(&pool)
        .await;
    let _ = sqlx::query("DROP TABLE IF EXISTS roundtrip_dest")
        .execute(&pool)
        .await;

    pool.close().await;
}

#[tokio::test]
async fn test_import_with_syntax_error() {
    let pool = get_pool().await;

    // Simulate import of SQL with syntax error
    let bad_sql = "CREAT TABLE bad_syntax_table (id INT)"; // intentional typo

    let result = sqlx::query(bad_sql).execute(&pool).await;
    assert!(result.is_err(), "Should fail with syntax error");

    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("1064") || err.contains("syntax"),
        "Error should mention syntax issue, got: {}",
        err
    );

    pool.close().await;
}

#[tokio::test]
async fn test_import_with_disable_fk_checks() {
    let pool = get_pool().await;

    // Setup: child table references parent
    let _ = sqlx::query("DROP TABLE IF EXISTS fk_child_import")
        .execute(&pool)
        .await;
    let _ = sqlx::query("DROP TABLE IF EXISTS fk_parent_import")
        .execute(&pool)
        .await;

    sqlx::query("CREATE TABLE fk_parent_import (id INT PRIMARY KEY)")
        .execute(&pool)
        .await
        .expect("Should create parent table");

    sqlx::query(
        "CREATE TABLE fk_child_import (
            id INT PRIMARY KEY,
            parent_id INT,
            FOREIGN KEY (parent_id) REFERENCES fk_parent_import(id)
        )",
    )
    .execute(&pool)
    .await
    .expect("Should create child table with FK");

    // Without disabling FK checks, inserting orphan child record fails
    let result = sqlx::query("INSERT INTO fk_child_import (id, parent_id) VALUES (1, 999)")
        .execute(&pool)
        .await;
    assert!(result.is_err(), "Should fail with FK constraint");

    // With FK checks disabled, it succeeds
    sqlx::query("SET FOREIGN_KEY_CHECKS = 0")
        .execute(&pool)
        .await
        .expect("Should disable FK checks");

    sqlx::query("INSERT INTO fk_child_import (id, parent_id) VALUES (1, 999)")
        .execute(&pool)
        .await
        .expect("Should succeed with FK checks disabled");

    sqlx::query("SET FOREIGN_KEY_CHECKS = 1")
        .execute(&pool)
        .await
        .expect("Should re-enable FK checks");

    // Cleanup
    let _ = sqlx::query("DROP TABLE IF EXISTS fk_child_import")
        .execute(&pool)
        .await;
    let _ = sqlx::query("DROP TABLE IF EXISTS fk_parent_import")
        .execute(&pool)
        .await;

    pool.close().await;
}
