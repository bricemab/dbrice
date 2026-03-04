-- DBrice local SQLite schema

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    color TEXT,
    method TEXT NOT NULL DEFAULT 'tcp_ip',
    sort_order INTEGER NOT NULL DEFAULT 0,
    -- MySQL config (stored encrypted)
    mysql_hostname_enc TEXT NOT NULL,
    mysql_port INTEGER NOT NULL DEFAULT 3306,
    mysql_username_enc TEXT NOT NULL,
    mysql_default_schema TEXT,
    -- SSH config (stored encrypted)
    ssh_hostname_enc TEXT,
    ssh_port INTEGER DEFAULT 22,
    ssh_username_enc TEXT,
    ssh_auth_method TEXT,
    ssh_key_file_path TEXT,
    -- Metadata
    last_connected_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_connections_folder ON connections(folder_id);
CREATE INDEX IF NOT EXISTS idx_connections_sort ON connections(sort_order);

CREATE TABLE IF NOT EXISTS query_history (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    sql TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    rows_affected INTEGER NOT NULL DEFAULT 0,
    executed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_history_connection ON query_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_history_executed_at ON query_history(executed_at DESC);

CREATE TABLE IF NOT EXISTS connection_logs (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_connection ON connection_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON connection_logs(created_at DESC);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', '"system"'),
    ('default_limit', '1000'),
    ('app_version', '"1.0.0"'),
    ('first_launch_completed', 'false');
