import { useEffect, useState, useCallback } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import { useTabStore } from "@/stores/useTabStore";
import {
  tauriGetDatabases,
  tauriGetTables,
  tauriGetTableColumns,
  tauriGetViews,
  tauriGetProcedures,
  tauriGetFunctions,
  tauriGetEvents,
  tauriGetCreateStatement,
  tauriDropTable,
  tauriTruncateTable,
  tauriDropDatabase,
} from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { cn } from "@/lib/utils";
import type { ColumnInfo } from "@/types/mysql";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faFolder,
  faFolderOpen,
  faChevronRight,
  faTable,
  faTableColumns,
  faEye,
  faCode,
  faCalculator,
  faCalendar,
  faCopy,
  faFileCode,
  faPlus,
  faFileExport,
  faTrash,
  faPen,
} from "@fortawesome/free-solid-svg-icons";

interface SidebarTreeProps {
  connectionId: string;
  refreshKey?: number;
}

interface TableNode {
  name: string;
  columns?: ColumnInfo[];
  columnsLoaded: boolean;
}

interface DbNode {
  name: string;
  tables?: TableNode[];
  views?: string[];
  procedures?: string[];
  functions?: string[];
  events?: string[];
  loaded: boolean;
  expanded: boolean;
}

export function SidebarTree({ connectionId, refreshKey }: SidebarTreeProps) {
  const { getSession, setActiveDatabase } = useSessionStore();
  const { openWorkspaceTab } = useTabStore();
  const session = getSession(connectionId);

  const [databases, setDatabases] = useState<DbNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "table" | "db";
    db: string;
    name?: string;
  } | null>(null);

  // Confirm modal states
  const [dropTableTarget, setDropTableTarget] = useState<{ db: string; table: string } | null>(
    null,
  );
  const [truncateTarget, setTruncateTarget] = useState<{ db: string; table: string } | null>(null);
  const [dropDbTarget, setDropDbTarget] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadDatabases = useCallback(async () => {
    try {
      const dbs = await tauriGetDatabases({ connection_id: connectionId });
      setDatabases(dbs.map((name) => ({ name, loaded: false, expanded: false })));
    } catch (err) {
      toast.error("Failed to load databases", String(err));
    }
  }, [connectionId]);

  useEffect(() => {
    if (session?.isConnected) loadDatabases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.isConnected, connectionId, refreshKey]);

  const toggleDb = async (db: DbNode) => {
    const nodeId = `db:${db.name}`;
    const isExpanded = expandedNodes.has(nodeId);

    if (!isExpanded && !db.loaded) {
      try {
        const [tables, views, procedures, functions, events] = await Promise.all([
          tauriGetTables({ connection_id: connectionId, database: db.name }),
          tauriGetViews({ connection_id: connectionId, database: db.name }),
          tauriGetProcedures({ connection_id: connectionId, database: db.name }),
          tauriGetFunctions({ connection_id: connectionId, database: db.name }),
          tauriGetEvents({ connection_id: connectionId, database: db.name }),
        ]);

        setDatabases((prev) =>
          prev.map((d) =>
            d.name === db.name
              ? {
                  ...d,
                  tables: tables.map((t) => ({ name: t.name, columnsLoaded: false })),
                  views,
                  procedures,
                  functions,
                  events,
                  loaded: true,
                }
              : d,
          ),
        );
      } catch (err) {
        toast.error(`Failed to load ${db.name}`, String(err));
      }
    }

    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (isExpanded) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleSection = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleTable = async (db: string, table: TableNode) => {
    const nodeId = `table:${db}:${table.name}`;
    const isExpanded = expandedNodes.has(nodeId);

    if (!isExpanded && !table.columnsLoaded) {
      try {
        const cols = (await tauriGetTableColumns({
          connection_id: connectionId,
          database: db,
          table: table.name,
        })) as ColumnInfo[];
        setDatabases((prev) =>
          prev.map((d) =>
            d.name === db
              ? {
                  ...d,
                  tables: d.tables?.map((t) =>
                    t.name === table.name ? { ...t, columns: cols, columnsLoaded: true } : t,
                  ),
                }
              : d,
          ),
        );
      } catch {
        // ignore
      }
    }

    setSelectedTable(nodeId);
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (isExpanded) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });

    setActiveDatabase(connectionId, db);
  };

  // ── Context menu handlers ──────────────────────────────────────────────────

  const handleTableContextMenu = (e: React.MouseEvent, db: string, table: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "table", db, name: table });
  };

  const handleDbContextMenu = (e: React.MouseEvent, db: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "db", db });
  };

  const handleCopyCreateStatement = async (db: string, table: string) => {
    try {
      const sql = await tauriGetCreateStatement({
        connection_id: connectionId,
        database: db,
        object_type: "TABLE",
        name: table,
      });
      await navigator.clipboard.writeText(sql);
      toast.success("CREATE statement copied");
    } catch (err) {
      toast.error("Failed to copy", String(err));
    }
    setContextMenu(null);
  };

  const handleSelectRows = (db: string, table: string) => {
    openWorkspaceTab(connectionId, {
      type: "sql-sheet",
      title: table,
      metadata: {
        initialSql: `SELECT * FROM \`${db}\`.\`${table}\` LIMIT 1000;`,
        autoExecute: true,
      },
    });
    setContextMenu(null);
  };

  const handleAlterTable = (db: string, table: string) => {
    openWorkspaceTab(connectionId, {
      type: "table-designer",
      title: `${table} — Table Designer`,
      metadata: { database: db, tableName: table },
    });
    setContextMenu(null);
  };

  const handleNewSqlSheet = (db: string) => {
    setActiveDatabase(connectionId, db);
    openWorkspaceTab(connectionId, {
      type: "sql-sheet",
      title: "",
      metadata: { initialSql: `USE \`${db}\`;\n` },
    });
    setContextMenu(null);
  };

  const handleCreateTable = (db: string) => {
    openWorkspaceTab(connectionId, {
      type: "table-designer",
      title: "New Table — Table Designer",
      metadata: { database: db },
    });
    setContextMenu(null);
  };

  const handleExportDatabase = (db: string) => {
    openWorkspaceTab(connectionId, {
      type: "export",
      title: `Export — ${db}`,
      metadata: { database: db },
    });
    setContextMenu(null);
  };

  const handleDropTable = async () => {
    if (!dropTableTarget) return;
    setIsProcessing(true);
    try {
      await tauriDropTable({
        connection_id: connectionId,
        database: dropTableTarget.db,
        table_name: dropTableTarget.table,
      });
      toast.success(`Table '${dropTableTarget.table}' dropped`);
      // Reload the database node
      setDatabases((prev) =>
        prev.map((d) =>
          d.name === dropTableTarget.db
            ? {
                ...d,
                tables: d.tables?.filter((t) => t.name !== dropTableTarget.table),
              }
            : d,
        ),
      );
    } catch (err) {
      toast.error("Failed to drop table", String(err));
    } finally {
      setIsProcessing(false);
      setDropTableTarget(null);
    }
  };

  const handleTruncateTable = async () => {
    if (!truncateTarget) return;
    setIsProcessing(true);
    try {
      await tauriTruncateTable({
        connection_id: connectionId,
        database: truncateTarget.db,
        table_name: truncateTarget.table,
      });
      toast.success(`Table '${truncateTarget.table}' truncated`);
    } catch (err) {
      toast.error("Failed to truncate table", String(err));
    } finally {
      setIsProcessing(false);
      setTruncateTarget(null);
    }
  };

  const handleDropDatabase = async () => {
    if (!dropDbTarget) return;
    setIsProcessing(true);
    try {
      await tauriDropDatabase({ connection_id: connectionId, name: dropDbTarget });
      toast.success(`Database '${dropDbTarget}' dropped`);
      setDatabases((prev) => prev.filter((d) => d.name !== dropDbTarget));
    } catch (err) {
      toast.error("Failed to drop database", String(err));
    } finally {
      setIsProcessing(false);
      setDropDbTarget(null);
    }
  };

  const getColumnBadges = (col: ColumnInfo): string[] => {
    const badges: string[] = [];
    if (col.key_type === "PRI") badges.push("PK");
    if (col.is_nullable === false) badges.push("NN");
    if (col.key_type === "UNI") badges.push("UQ");
    if (col.extra.includes("auto_increment")) badges.push("AI");
    if (col.extra.includes("DEFAULT_GENERATED")) badges.push("G");
    return badges;
  };

  return (
    <>
      <div className="h-full overflow-auto py-1" onClick={() => setContextMenu(null)}>
        {databases.map((db) => {
          const dbExpanded = expandedNodes.has(`db:${db.name}`);
          return (
            <div key={db.name}>
              {/* Database node */}
              <div
                className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-sm text-sm group"
                onClick={() => toggleDb(db)}
                onContextMenu={(e) => handleDbContextMenu(e, db.name)}
              >
                <FontAwesomeIcon
                  icon={dbExpanded ? faFolderOpen : faFolder}
                  className="text-yellow-500 text-base shrink-0"
                />
                <span className="font-medium truncate flex-1">{db.name}</span>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className={cn(
                    "text-muted-foreground text-xs transition-transform",
                    dbExpanded && "rotate-90",
                  )}
                />
              </div>

              {/* DB content */}
              {dbExpanded && db.loaded && (
                <div className="pl-3">
                  {/* Tables */}
                  <SectionNode
                    label="Tables"
                    icon={faTable}
                    nodeId={`section:${db.name}:tables`}
                    expanded={expandedNodes.has(`section:${db.name}:tables`)}
                    onToggle={toggleSection}
                    count={db.tables?.length ?? 0}
                  >
                    {db.tables?.map((table) => {
                      const tableNodeId = `table:${db.name}:${table.name}`;
                      const tableExpanded = expandedNodes.has(tableNodeId);
                      const isSelected = selectedTable === tableNodeId;

                      return (
                        <div key={table.name}>
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-0.5 cursor-pointer rounded-sm text-xs group",
                              isSelected ? "bg-primary/15 text-primary" : "hover:bg-accent/50",
                            )}
                            onClick={() => toggleTable(db.name, table)}
                            onDoubleClick={() => handleSelectRows(db.name, table.name)}
                            onContextMenu={(e) => handleTableContextMenu(e, db.name, table.name)}
                          >
                            <FontAwesomeIcon
                              icon={faTable}
                              className="text-blue-500 text-sm shrink-0"
                            />
                            <span className="truncate flex-1">{table.name}</span>
                            <FontAwesomeIcon
                              icon={faChevronRight}
                              className={cn(
                                "text-muted-foreground text-[10px] transition-transform opacity-0 group-hover:opacity-100",
                                tableExpanded && "rotate-90 opacity-100",
                              )}
                            />
                          </div>

                          {/* Columns */}
                          {tableExpanded && table.columnsLoaded && (
                            <div className="pl-4">
                              {table.columns?.map((col) => {
                                const badges = getColumnBadges(col);
                                return (
                                  <div
                                    key={col.name}
                                    className="flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded-sm cursor-default"
                                  >
                                    <FontAwesomeIcon
                                      icon={faTableColumns}
                                      className="text-[10px] shrink-0"
                                    />
                                    <span className="truncate">{col.name}</span>
                                    <div className="flex gap-0.5 ml-auto shrink-0">
                                      {badges.map((b) => (
                                        <span
                                          key={b}
                                          className="rounded px-0.5 py-px text-[9px] font-semibold bg-muted text-muted-foreground leading-none"
                                        >
                                          {b}
                                        </span>
                                      ))}
                                      {col.default_value && (
                                        <span className="text-[9px] text-muted-foreground/60 truncate max-w-[60px]">
                                          ={col.default_value}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </SectionNode>

                  {/* Views */}
                  {(db.views?.length ?? 0) > 0 && (
                    <SectionNode
                      label="Views"
                      icon={faEye}
                      nodeId={`section:${db.name}:views`}
                      expanded={expandedNodes.has(`section:${db.name}:views`)}
                      onToggle={toggleSection}
                      count={db.views?.length ?? 0}
                    >
                      {db.views?.map((v) => (
                        <RoutineItem key={v} icon={faEye} name={v} color="text-purple-500" />
                      ))}
                    </SectionNode>
                  )}

                  {/* Procedures */}
                  {(db.procedures?.length ?? 0) > 0 && (
                    <SectionNode
                      label="Stored Procedures"
                      icon={faCode}
                      nodeId={`section:${db.name}:procedures`}
                      expanded={expandedNodes.has(`section:${db.name}:procedures`)}
                      onToggle={toggleSection}
                      count={db.procedures?.length ?? 0}
                    >
                      {db.procedures?.map((p) => (
                        <RoutineItem key={p} icon={faCode} name={p} color="text-orange-500" />
                      ))}
                    </SectionNode>
                  )}

                  {/* Functions */}
                  {(db.functions?.length ?? 0) > 0 && (
                    <SectionNode
                      label="Functions"
                      icon={faCalculator}
                      nodeId={`section:${db.name}:functions`}
                      expanded={expandedNodes.has(`section:${db.name}:functions`)}
                      onToggle={toggleSection}
                      count={db.functions?.length ?? 0}
                    >
                      {db.functions?.map((f) => (
                        <RoutineItem
                          key={f}
                          icon={faCalculator}
                          name={f}
                          color="text-green-500"
                        />
                      ))}
                    </SectionNode>
                  )}

                  {/* Events */}
                  {(db.events?.length ?? 0) > 0 && (
                    <SectionNode
                      label="Events"
                      icon={faCalendar}
                      nodeId={`section:${db.name}:events`}
                      expanded={expandedNodes.has(`section:${db.name}:events`)}
                      onToggle={toggleSection}
                      count={db.events?.length ?? 0}
                    >
                      {db.events?.map((ev) => (
                        <RoutineItem key={ev} icon={faCalendar} name={ev} color="text-cyan-500" />
                      ))}
                    </SectionNode>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-50 min-w-[180px] rounded-lg border bg-popover shadow-lg py-1 text-sm"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseLeave={() => setContextMenu(null)}
          >
            {contextMenu.type === "table" && contextMenu.name && (
              <>
                <ContextMenuItem
                  icon={faTable}
                  label="Select Rows"
                  onClick={() => handleSelectRows(contextMenu.db, contextMenu.name!)}
                />
                <ContextMenuItem
                  icon={faPen}
                  label="Alter Table"
                  onClick={() => handleAlterTable(contextMenu.db, contextMenu.name!)}
                />
                <ContextMenuItem
                  icon={faCopy}
                  label="Copy Table Name"
                  onClick={async () => {
                    await navigator.clipboard.writeText(contextMenu.name!);
                    toast.success("Table name copied");
                    setContextMenu(null);
                  }}
                />
                <ContextMenuItem
                  icon={faFileCode}
                  label="Copy CREATE Statement"
                  onClick={() => handleCopyCreateStatement(contextMenu.db, contextMenu.name!)}
                />
                <div className="my-1 h-px bg-border mx-2" />
                <ContextMenuItem
                  icon={faTrash}
                  label="Truncate Table"
                  danger
                  onClick={() => {
                    setTruncateTarget({ db: contextMenu.db, table: contextMenu.name! });
                    setContextMenu(null);
                  }}
                />
                <ContextMenuItem
                  icon={faTrash}
                  label="Drop Table"
                  danger
                  onClick={() => {
                    setDropTableTarget({ db: contextMenu.db, table: contextMenu.name! });
                    setContextMenu(null);
                  }}
                />
              </>
            )}
            {contextMenu.type === "db" && (
              <>
                <ContextMenuItem
                  icon={faFileCode}
                  label="New SQL Sheet"
                  onClick={() => handleNewSqlSheet(contextMenu.db)}
                />
                <ContextMenuItem
                  icon={faPlus}
                  label="Create Table"
                  onClick={() => handleCreateTable(contextMenu.db)}
                />
                <div className="my-1 h-px bg-border mx-2" />
                <ContextMenuItem
                  icon={faFileExport}
                  label="Export Database"
                  onClick={() => handleExportDatabase(contextMenu.db)}
                />
                <div className="my-1 h-px bg-border mx-2" />
                <ContextMenuItem
                  icon={faTrash}
                  label="Drop Database"
                  danger
                  onClick={() => {
                    setDropDbTarget(contextMenu.db);
                    setContextMenu(null);
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={dropTableTarget !== null}
        onClose={() => setDropTableTarget(null)}
        onConfirm={handleDropTable}
        title="Drop Table"
        description={`Are you sure you want to drop table '${dropTableTarget?.table}'? This will permanently delete all data and cannot be undone.`}
        confirmLabel="Drop Table"
        isLoading={isProcessing}
      />

      <ConfirmModal
        open={truncateTarget !== null}
        onClose={() => setTruncateTarget(null)}
        onConfirm={handleTruncateTable}
        title="Truncate Table"
        description={`Are you sure you want to truncate table '${truncateTarget?.table}'? All rows will be permanently deleted.`}
        confirmLabel="Truncate Table"
        isLoading={isProcessing}
      />

      <ConfirmModal
        open={dropDbTarget !== null}
        onClose={() => setDropDbTarget(null)}
        onConfirm={handleDropDatabase}
        title="Drop Database"
        description={`Are you sure you want to drop database '${dropDbTarget}'? This will permanently delete all tables and data. This cannot be undone.`}
        confirmLabel="Drop Database"
        isLoading={isProcessing}
      />
    </>
  );
}

function SectionNode({
  label,
  icon,
  nodeId,
  expanded,
  onToggle,
  count,
  children,
}: {
  label: string;
  icon: IconDefinition;
  nodeId: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-accent/50 rounded-sm text-xs text-muted-foreground"
        onClick={() => onToggle(nodeId)}
      >
        <FontAwesomeIcon icon={icon} className="text-sm shrink-0" />
        <span className="font-medium flex-1">{label}</span>
        <span className="text-[10px]">{count}</span>
        <FontAwesomeIcon
          icon={faChevronRight}
          className={cn("text-[10px] transition-transform", expanded && "rotate-90")}
        />
      </div>
      {expanded && <div className="pl-2">{children}</div>}
    </div>
  );
}

function RoutineItem({ icon, name, color }: { icon: IconDefinition; name: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-accent/50 rounded-sm text-xs">
      <FontAwesomeIcon icon={icon} className={`${color} text-sm shrink-0`} />
      <span className="truncate">{name}</span>
    </div>
  );
}

function ContextMenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: IconDefinition;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors",
        danger && "text-destructive hover:bg-destructive/10",
      )}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} className="text-base" />
      {label}
    </button>
  );
}
