export type IndexType = "PRIMARY" | "UNIQUE" | "INDEX" | "FULLTEXT" | "SPATIAL";
export type SortOrder = "ASC" | "DESC";
export type FKAction = "RESTRICT" | "CASCADE" | "SET NULL" | "NO ACTION" | "SET DEFAULT";
export type TriggerTiming = "BEFORE" | "AFTER";
export type TriggerEvent = "INSERT" | "UPDATE" | "DELETE";
export type ParamMode = "IN" | "OUT" | "INOUT";
export type RoutineType = "procedure" | "function";

export interface ColumnDef {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_unique: boolean;
  is_binary: boolean;
  is_unsigned: boolean;
  is_zero_fill: boolean;
  is_auto_increment: boolean;
  is_generated: boolean;
  default_value?: string;
  comment?: string;
  ordinal_position: number;
}

export interface IndexColumn {
  column_name: string;
  sort_order: SortOrder;
  sub_part?: number;
}

export interface IndexDef {
  name: string;
  index_type: IndexType;
  columns: IndexColumn[];
  is_unique: boolean;
}

export interface FKDef {
  name: string;
  column: string;
  referenced_table: string;
  referenced_column: string;
  on_delete: FKAction;
  on_update: FKAction;
}

export interface TriggerDef {
  name: string;
  timing: TriggerTiming;
  event: TriggerEvent;
  statement: string;
  definer?: string;
}

export interface TableOptions {
  engine: string;
  charset?: string;
  collation?: string;
  row_format?: string;
  auto_increment?: number;
  comment?: string;
}

export interface TableDef {
  name: string;
  database: string;
  columns: ColumnDef[];
  indexes: IndexDef[];
  foreign_keys: FKDef[];
  triggers: TriggerDef[];
  options: TableOptions;
}

export interface RoutineParam {
  name: string;
  mode: ParamMode;
  data_type: string;
}

export interface RoutineDef {
  name: string;
  database: string;
  routine_type: RoutineType;
  definition: string;
  parameters: RoutineParam[];
  return_type?: string;
  comment?: string;
}

export interface MySQLUser {
  user: string;
  host: string;
  plugin: string;
  password_expired: boolean;
  account_locked: boolean;
}
