// Integration test entry point
// Run with: cargo test --test integration_tests
// Requires: docker-compose up -d (from tests/integration/)

mod mysql_connection;
mod query_execution;
mod schema_operations;
mod ssh_tunnel;
mod user_management;
mod export_import;
