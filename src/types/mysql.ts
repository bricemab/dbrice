export type QueryType = "select" | "insert" | "update" | "delete" | "ddl" | "other";

export interface ColumnMeta {
  name: string;
  type_name: string;
  nullable: boolean;
  is_primary_key: boolean;
}

export interface QueryResult {
  columns: ColumnMeta[];
  rows: (string | null)[][];
  rows_affected: number;
  last_insert_id: number;
  execution_time_ms: number;
  query_type: QueryType;
}

export interface QueryHistoryEntry {
  id: string;
  connection_id: string;
  sql: string;
  execution_time_ms: number;
  status: "success" | "error";
  error_message?: string;
  rows_affected: number;
  executed_at: string;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  key_type: string;
  default_value?: string;
  extra: string;
  comment?: string;
}

export interface ProcessInfo {
  id: number;
  user: string;
  host: string;
  db?: string;
  command: string;
  time: number;
  state?: string;
  info?: string;
}

export interface ServerStatus {
  version: string;
  uptime_seconds: number;
  active_connections: number;
  max_connections: number;
  questions_per_sec: number;
  slow_queries_count: number;
  threads_connected: number;
  threads_running: number;
  innodb_reads_per_sec: number;
  innodb_writes_per_sec: number;
  bytes_received: number;
  bytes_sent: number;
}

export interface DatabaseSize {
  name: string;
  size_mb: number;
  tables_count: number;
}
