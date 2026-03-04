import { invoke } from "@tauri-apps/api/core";
import type { Connection, Folder, CreateConnectionInput } from "@/types/connection";
import type { QueryResult, ServerStatus, ProcessInfo, DatabaseSize } from "@/types/mysql";
import type { TableDef, RoutineDef, MySQLUser } from "@/types/schema";
import type { Settings, LogEntry } from "@/types/settings";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const tauriCheckFirstLaunch = () => invoke<boolean>("check_first_launch");
export const tauriSetupMasterPassword = (password: string) =>
  invoke<void>("setup_master_password", { password });
export const tauriVerifyMasterPassword = (password: string) =>
  invoke<boolean>("verify_master_password", { password });
export const tauriChangeMasterPassword = (currentPassword: string, newPassword: string) =>
  invoke<void>("change_master_password", { currentPassword, newPassword });
export const tauriResetDbrice = () => invoke<void>("reset_dbrice");

// ─── Connections ──────────────────────────────────────────────────────────────

export const tauriGetConnections = () => invoke<Connection[]>("get_connections");
export const tauriCreateConnection = (input: CreateConnectionInput) =>
  invoke<Connection>("create_connection", { input });
export const tauriUpdateConnection = (id: string, input: CreateConnectionInput) =>
  invoke<Connection>("update_connection", { id, input });
export const tauriDeleteConnection = (id: string) => invoke<void>("delete_connection", { id });
export const tauriDuplicateConnection = (id: string) =>
  invoke<Connection>("duplicate_connection", { id });
export const tauriGetFolders = () => invoke<Folder[]>("get_folders");
export const tauriCreateFolder = (name: string) => invoke<Folder>("create_folder", { name });
export const tauriUpdateFolder = (id: string, name: string) =>
  invoke<void>("update_folder", { id, name });
export const tauriDeleteFolder = (id: string) => invoke<void>("delete_folder", { id });
export const tauriMoveConnectionToFolder = (connectionId: string, folderId?: string) =>
  invoke<void>("move_connection_to_folder", { connectionId, folderId });
export const tauriReorderConnections = (orderedIds: string[]) =>
  invoke<void>("reorder_connections", { orderedIds });

// ─── MySQL Connection ──────────────────────────────────────────────────────────

export interface ConnectInput {
  connection_id: string;
  ssh_passphrase?: string;
}
export const tauriConnect = (input: ConnectInput) => invoke<void>("connect", { input });
export const tauriDisconnect = (connectionId: string) =>
  invoke<void>("disconnect", { connectionId });

// ─── Query Execution ──────────────────────────────────────────────────────────

export interface ExecuteQueryInput {
  connection_id: string;
  sql: string;
  limit?: number;
}
export const tauriExecuteQuery = (input: ExecuteQueryInput) =>
  invoke<QueryResult>("execute_query", { input });

export interface TestConnectionInput {
  method: string;
  mysql_hostname: string;
  mysql_port: number;
  mysql_username: string;
  mysql_password?: string;
  mysql_default_schema?: string;
  ssh_hostname?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  ssh_auth_method?: string;
  ssh_key_file_path?: string;
  ssh_key_passphrase?: string;
}
export const tauriTestConnection = (input: TestConnectionInput) =>
  invoke<void>("test_connection", { input });

// ─── Schema Introspection ─────────────────────────────────────────────────────

export interface GetDbInput { connection_id: string }
export interface GetTableInput { connection_id: string; database: string }
export interface GetColumnInput { connection_id: string; database: string; table: string }

export const tauriGetDatabases = (input: GetDbInput) =>
  invoke<string[]>("get_databases", { input });
export const tauriGetTables = (input: GetTableInput) =>
  invoke<TableDef[]>("get_tables", { input });
export const tauriGetTableColumns = (input: GetColumnInput) =>
  invoke("get_table_columns", { input });
export const tauriGetTableIndexes = (input: GetColumnInput) =>
  invoke("get_table_indexes", { input });
export const tauriGetTableForeignKeys = (input: GetColumnInput) =>
  invoke("get_table_foreign_keys", { input });
export const tauriGetTableTriggers = (input: GetColumnInput) =>
  invoke("get_table_triggers", { input });

export interface GetObjectInput { connection_id: string; database: string }
export const tauriGetViews = (input: GetObjectInput) =>
  invoke<string[]>("get_views", { input });
export const tauriGetProcedures = (input: GetObjectInput) =>
  invoke<string[]>("get_procedures", { input });
export const tauriGetFunctions = (input: GetObjectInput) =>
  invoke<string[]>("get_functions", { input });
export const tauriGetEvents = (input: GetObjectInput) =>
  invoke<string[]>("get_events", { input });

export interface GetCreateStmtInput {
  connection_id: string;
  database: string;
  object_type: string;
  name: string;
}
export const tauriGetCreateStatement = (input: GetCreateStmtInput) =>
  invoke<string>("get_create_statement", { input });

// ─── Schema Mutations ─────────────────────────────────────────────────────────

export interface CreateTableInput {
  connection_id: string;
  database: string;
  sql: string;
}
export interface AlterTableInput {
  connection_id: string;
  database: string;
  table_name: string;
  sql: string;
}
export interface DropTableInput {
  connection_id: string;
  database: string;
  table_name: string;
}
export interface CreateDatabaseInput {
  connection_id: string;
  name: string;
  charset?: string;
  collation?: string;
}

export const tauriCreateTable = (input: CreateTableInput) =>
  invoke<void>("create_table", { input });
export const tauriAlterTable = (input: AlterTableInput) =>
  invoke<void>("alter_table", { input });
export const tauriDropTable = (input: DropTableInput) =>
  invoke<void>("drop_table", { input });
export const tauriTruncateTable = (input: DropTableInput) =>
  invoke<void>("truncate_table", { input });
export const tauriCreateDatabase = (input: CreateDatabaseInput) =>
  invoke<void>("create_database", { input });
export const tauriDropDatabase = (input: { connection_id: string; name: string }) =>
  invoke<void>("drop_database", { input });

// ─── Routines ─────────────────────────────────────────────────────────────────

export interface GetRoutineInput {
  connection_id: string;
  database: string;
  routine_name: string;
  routine_type: string;
}
export interface SaveRoutineInput {
  connection_id: string;
  database: string;
  routine_type: string;
  sql: string;
}
export interface ExecuteRoutineInput {
  connection_id: string;
  database: string;
  routine_name: string;
  routine_type: string;
  params: Record<string, string>;
}

export const tauriGetRoutineDefinition = (input: GetRoutineInput) =>
  invoke<RoutineDef>("get_routine_definition", { input });
export const tauriSaveRoutine = (input: SaveRoutineInput) =>
  invoke<void>("save_routine", { input });
export const tauriDropRoutine = (input: GetRoutineInput) =>
  invoke<void>("drop_routine", { input });
export const tauriExecuteRoutine = (input: ExecuteRoutineInput) =>
  invoke<QueryResult>("execute_routine", { input });

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UserInput {
  connection_id: string;
  username: string;
  host: string;
  password?: string;
  auth_plugin?: string;
  require_ssl?: boolean;
  max_queries_per_hour?: number;
  max_updates_per_hour?: number;
  max_connections_per_hour?: number;
  max_user_connections?: number;
}
export interface UserIdInput {
  connection_id: string;
  username: string;
  host: string;
}
export interface PrivilegesInput {
  connection_id: string;
  username: string;
  host: string;
  database: string;
  privileges: string[];
}

export const tauriGetUsers = (input: { connection_id: string }) =>
  invoke<MySQLUser[]>("get_users", { input });
export const tauriCreateUser = (input: UserInput) =>
  invoke<void>("create_user", { input });
export const tauriUpdateUser = (input: UserInput) =>
  invoke<void>("update_user", { input });
export const tauriDeleteUser = (input: UserIdInput) =>
  invoke<void>("delete_user", { input });
export const tauriGetUserPrivileges = (input: UserIdInput) =>
  invoke("get_user_privileges", { input });
export const tauriGrantPrivileges = (input: PrivilegesInput) =>
  invoke<void>("grant_privileges", { input });
export const tauriRevokePrivileges = (input: PrivilegesInput) =>
  invoke<void>("revoke_privileges", { input });

// ─── Export / Import ──────────────────────────────────────────────────────────

export interface ExportDatabaseInput {
  connection_id: string;
  database: string;
  tables: string[];
  export_type: string;
  format: string;
  output_path: string;
  include_drop_table?: boolean;
  include_create_db?: boolean;
  use_transactions?: boolean;
  disable_fk_checks?: boolean;
}
export interface ImportSqlInput {
  connection_id: string;
  database: string;
  file_path: string;
  stop_on_error?: boolean;
  create_database?: boolean;
}

export const tauriExportDatabase = (input: ExportDatabaseInput) =>
  invoke<void>("export_database", { input });
export const tauriImportSql = (input: ImportSqlInput) =>
  invoke<void>("import_sql", { input });

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const tauriGetServerStatus = (input: { connection_id: string }) =>
  invoke<ServerStatus>("get_server_status", { input });
export const tauriGetProcessList = (input: { connection_id: string }) =>
  invoke<ProcessInfo[]>("get_process_list", { input });
export const tauriKillProcess = (input: { connection_id: string; process_id: number }) =>
  invoke<void>("kill_process", { input });
export const tauriGetSlowQueries = (input: { connection_id: string }) =>
  invoke("get_slow_queries", { input });
export const tauriGetDatabaseSizes = (input: { connection_id: string }) =>
  invoke<DatabaseSize[]>("get_database_sizes", { input });

// ─── Logs ─────────────────────────────────────────────────────────────────────

export const tauriGetLogs = (input: { connection_id: string; limit?: number }) =>
  invoke<LogEntry[]>("get_logs", { input });
export const tauriClearLogs = (input: { connection_id: string }) =>
  invoke<void>("clear_logs", { input });
export const tauriExportLogs = (input: { connection_id: string; file_path: string }) =>
  invoke<void>("export_logs", { input });

// ─── Settings ─────────────────────────────────────────────────────────────────

export const tauriGetSettings = () => invoke<Settings>("get_settings");
export const tauriUpdateSettings = (input: Partial<Settings>) =>
  invoke<void>("update_settings", { input });
