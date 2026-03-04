#![allow(dead_code)]
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableDef {
    pub name: String,
    pub database: String,
    pub columns: Vec<ColumnDef>,
    pub indexes: Vec<IndexDef>,
    pub foreign_keys: Vec<FKDef>,
    pub triggers: Vec<TriggerDef>,
    pub options: TableOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnDef {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub is_unique: bool,
    pub is_binary: bool,
    pub is_unsigned: bool,
    pub is_zero_fill: bool,
    pub is_auto_increment: bool,
    pub is_generated: bool,
    pub default_value: Option<String>,
    pub comment: Option<String>,
    pub ordinal_position: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexDef {
    pub name: String,
    pub index_type: IndexType,
    pub columns: Vec<IndexColumn>,
    pub is_unique: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexColumn {
    pub column_name: String,
    pub sort_order: SortOrder,
    pub sub_part: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IndexType {
    Primary,
    Unique,
    Index,
    Fulltext,
    Spatial,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SortOrder {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FKDef {
    pub name: String,
    pub column: String,
    pub referenced_table: String,
    pub referenced_column: String,
    pub on_delete: FKAction,
    pub on_update: FKAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FKAction {
    Restrict,
    Cascade,
    SetNull,
    NoAction,
    SetDefault,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerDef {
    pub name: String,
    pub timing: TriggerTiming,
    pub event: TriggerEvent,
    pub statement: String,
    pub definer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TriggerTiming {
    Before,
    After,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TriggerEvent {
    Insert,
    Update,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableOptions {
    pub engine: String,
    pub charset: Option<String>,
    pub collation: Option<String>,
    pub row_format: Option<String>,
    pub auto_increment: Option<u64>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutineDef {
    pub name: String,
    pub database: String,
    pub routine_type: RoutineType,
    pub definition: String,
    pub parameters: Vec<RoutineParam>,
    pub return_type: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoutineType {
    Procedure,
    Function,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutineParam {
    pub name: String,
    pub mode: ParamMode,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ParamMode {
    In,
    Out,
    InOut,
}
