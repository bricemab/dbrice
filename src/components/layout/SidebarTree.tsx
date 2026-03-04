import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import {
  tauriGetDatabases,
  tauriGetTables,
  tauriGetTableColumns,
  tauriGetViews,
  tauriGetProcedures,
  tauriGetFunctions,
  tauriGetEvents,
  tauriGetCreateStatement,
} from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
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

export function SidebarTree({ connectionId }: SidebarTreeProps) {
  const { getSession, setActiveDatabase } = useSessionStore();
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

  useEffect(() => {
    if (session?.isConnected) {
      loadDatabases();
    }
  }, [session?.isConnected, connectionId]);

  const loadDatabases = async () => {
    try {
      const dbs = await tauriGetDatabases({ connection_id: connectionId });
      setDatabases(
        dbs.map((name) => ({ name, loaded: false, expanded: false })),
      );
    } catch (err) {
      toast.error("Failed to load databases", String(err));
    }
  };

  const toggleDb = async (db: DbNode) => {
    const nodeId = `db:${db.name}`;
    const isExpanded = expandedNodes.has(nodeId);

    if (!isExpanded && !db.loaded) {
      // Load tables
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
        const cols = await tauriGetTableColumns({ connection_id: connectionId, database: db, table: table.name }) as ColumnInfo[];
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
      const sql = await tauriGetCreateStatement({ connection_id: connectionId, database: db, object_type: "TABLE", name: table });
      await navigator.clipboard.writeText(sql);
      toast.success("CREATE statement copied");
    } catch (err) {
      toast.error("Failed to copy", String(err));
    }
    setContextMenu(null);
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
                          onContextMenu={(e) => handleTableContextMenu(e, db.name, table.name)}
                        >
                          <FontAwesomeIcon icon={faTable} className="text-blue-500 text-sm shrink-0" />
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
                                  <FontAwesomeIcon icon={faTableColumns} className="text-[10px] shrink-0" />
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
                      <RoutineItem key={f} icon={faCalculator} name={f} color="text-green-500" />
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
                onClick={() => setContextMenu(null)}
              />
              <ContextMenuItem
                icon={faPen}
                label="Alter Table"
                onClick={() => setContextMenu(null)}
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
                onClick={() => setContextMenu(null)}
              />
              <ContextMenuItem
                icon={faTrash}
                label="Drop Table"
                danger
                onClick={() => setContextMenu(null)}
              />
            </>
          )}
          {contextMenu.type === "db" && (
            <>
              <ContextMenuItem
                icon={faFileCode}
                label="New SQL Sheet"
                onClick={() => setContextMenu(null)}
              />
              <ContextMenuItem
                icon={faPlus}
                label="Create Table"
                onClick={() => setContextMenu(null)}
              />
              <div className="my-1 h-px bg-border mx-2" />
              <ContextMenuItem
                icon={faFileExport}
                label="Export Database"
                onClick={() => setContextMenu(null)}
              />
              <div className="my-1 h-px bg-border mx-2" />
              <ContextMenuItem
                icon={faTrash}
                label="Drop Database"
                danger
                onClick={() => setContextMenu(null)}
              />
            </>
          )}
        </div>
      )}
    </div>
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
          className={cn(
            "text-[10px] transition-transform",
            expanded && "rotate-90",
          )}
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
