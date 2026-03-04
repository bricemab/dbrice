import { useState, useMemo, useCallback } from "react";
import type { QueryResult } from "@/types/mysql";
import { tauriExecuteQuery } from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faFileExport,
  faFileCode,
  faRotate,
  faSortUp,
  faSortDown,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

interface ResultGridProps {
  result: QueryResult;
  connectionId: string;
  tableName?: string;
  primaryKeys?: string[];
}

type SortDir = "asc" | "desc" | null;

export function ResultGrid({ result, connectionId, primaryKeys = [] }: ResultGridProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editedCells, setEditedCells] = useState<Map<string, string | null>>(new Map());
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 1000;

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortCol(null);
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const processedRows = useMemo(() => {
    let rows = result.rows;

    // Filter
    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim());
    if (activeFilters.length > 0) {
      rows = rows.filter((row) =>
        activeFilters.every(([colName, filterVal]) => {
          const colIdx = result.columns.findIndex((c) => c.name === colName);
          if (colIdx < 0) return true;
          const cellVal = row[colIdx] ?? "";
          return cellVal.toLowerCase().includes(filterVal.toLowerCase());
        }),
      );
    }

    // Sort
    if (sortCol && sortDir) {
      const colIdx = result.columns.findIndex((c) => c.name === sortCol);
      if (colIdx >= 0) {
        rows = [...rows].sort((a, b) => {
          const aVal = a[colIdx] ?? "";
          const bVal = b[colIdx] ?? "";
          const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }

    return rows;
  }, [result.rows, result.columns, filters, sortCol, sortDir]);

  const paginatedRows = useMemo(
    () => processedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [processedRows, page],
  );

  const totalPages = Math.ceil(processedRows.length / PAGE_SIZE);

  const handleCellClick = (rowIdx: number, colIdx: number, currentValue: string | null) => {
    setEditingCell({ rowIdx, colIdx });
    setEditValue(currentValue ?? "");
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const key = `${editingCell.rowIdx}:${editingCell.colIdx}`;
      const row = paginatedRows[editingCell.rowIdx];
      const original = row[editingCell.colIdx];
      if (editValue !== (original ?? "")) {
        setEditedCells((prev) => {
          const next = new Map(prev);
          next.set(key, editValue || null);
          return next;
        });
      }
    }
    setEditingCell(null);
  };

  const handleCancelEdits = () => {
    setEditedCells(new Map());
  };

  const handleApplyEdits = async () => {
    if (editedCells.size === 0) return;

    // Build UPDATE statements
    const updates: string[] = [];
    editedCells.forEach((newVal, key) => {
      const [rowIdxStr, colIdxStr] = key.split(":");
      const rowIdx = parseInt(rowIdxStr);
      const colIdx = parseInt(colIdxStr);
      const row = paginatedRows[rowIdx];
      const col = result.columns[colIdx];

      // Find primary key value for WHERE clause
      const pkClauses = primaryKeys
        .map((pk) => {
          const pkIdx = result.columns.findIndex((c) => c.name === pk);
          if (pkIdx < 0) return null;
          const pkVal = row[pkIdx];
          return pkVal === null ? `${pk} IS NULL` : `${pk} = '${pkVal?.replace(/'/g, "\\'")}'`;
        })
        .filter(Boolean);

      if (pkClauses.length === 0) return;

      const valStr = newVal === null ? "NULL" : `'${newVal.replace(/'/g, "\\'")}'`;
      updates.push(`UPDATE SET ${col.name} = ${valStr} WHERE ${pkClauses.join(" AND ")}`);
    });

    if (updates.length === 0) {
      toast.error("Cannot apply: no primary key found in result");
      return;
    }

    try {
      for (const sql of updates) {
        await tauriExecuteQuery({ connection_id: connectionId, sql });
      }
      toast.success(`${updates.length} row(s) updated`);
      setEditedCells(new Map());
    } catch (err) {
      toast.error("Failed to apply changes", String(err));
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditingCell(null);
    } else if (e.key === "Enter") {
      handleCellBlur();
    }
  };

  const handleCopyCell = useCallback(async (e: React.ClipboardEvent, value: string | null) => {
    e.preventDefault();
    await navigator.clipboard.writeText(value ?? "");
  }, []);

  if (result.columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <FontAwesomeIcon icon={faCircleCheck} className="mr-2 text-green-500" />
        {result.rows_affected > 0
          ? `${result.rows_affected} rows affected in ${result.execution_time_ms}ms`
          : `Query OK in ${result.execution_time_ms}ms`}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Result toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b bg-muted/20 text-xs text-muted-foreground shrink-0">
        <span>
          {processedRows.length.toLocaleString()} row{processedRows.length !== 1 ? "s" : ""} in{" "}
          {result.execution_time_ms}ms
        </span>
        <div className="ml-auto flex gap-2">
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => {
              /* export CSV */
            }}
          >
            <FontAwesomeIcon icon={faFileExport} />
            CSV
          </button>
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => {
              /* export JSON */
            }}
          >
            <FontAwesomeIcon icon={faFileCode} />
            JSON
          </button>
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            title="Refresh"
          >
            <FontAwesomeIcon icon={faRotate} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs font-mono">
          <thead className="sticky top-0 z-10">
            {/* Column headers */}
            <tr className="bg-muted/60 border-b">
              {result.columns.map((col) => (
                <th
                  key={col.name}
                  className="px-3 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap border-r cursor-pointer hover:bg-muted/80 select-none"
                  onClick={() => handleSort(col.name)}
                >
                  <div className="flex items-center gap-1">
                    {col.name}
                    {sortCol === col.name && (
                      <FontAwesomeIcon
                        icon={sortDir === "asc" ? faSortUp : faSortDown}
                        className="text-primary text-sm"
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
            {/* Filter row */}
            <tr className="bg-background border-b">
              {result.columns.map((col) => (
                <th key={col.name} className="px-1 py-0.5 border-r">
                  <input
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none px-1 py-0.5 rounded border border-transparent focus:border-border"
                    placeholder="filter..."
                    value={filters[col.name] ?? ""}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, [col.name]: e.target.value }))
                    }
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={cn(
                  "border-b hover:bg-muted/30 transition-colors",
                  selectedRows.has(rowIdx) && "bg-primary/10",
                )}
                onClick={() => {
                  setSelectedRows((prev) => {
                    const next = new Set(prev);
                    if (next.has(rowIdx)) next.delete(rowIdx);
                    else next.add(rowIdx);
                    return next;
                  });
                }}
              >
                {row.map((cell, colIdx) => {
                  const isEditing =
                    editingCell?.rowIdx === rowIdx && editingCell?.colIdx === colIdx;
                  const editKey = `${rowIdx}:${colIdx}`;
                  const editedValue = editedCells.get(editKey);
                  const displayValue = editedCells.has(editKey) ? editedValue : cell;

                  return (
                    <td
                      key={colIdx}
                      className={cn(
                        "px-3 py-1 border-r whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis align-top",
                        editedCells.has(editKey) && "bg-yellow-500/10",
                      )}
                      onCopy={(e) => handleCopyCell(e, displayValue ?? null)}
                      onDoubleClick={() => handleCellClick(rowIdx, colIdx, displayValue ?? null)}
                    >
                      {isEditing ? (
                        <input
                          className="w-full bg-background border border-primary rounded px-1 py-0.5 text-xs outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                        />
                      ) : displayValue === null ? (
                        <span className="italic text-muted-foreground/60">NULL</span>
                      ) : (
                        <span>{String(displayValue)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground shrink-0">
          <button
            className="hover:text-foreground disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <span>
            Page {page + 1} of {totalPages} — Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, processedRows.length)} of {processedRows.length}
          </span>
          <button
            className="hover:text-foreground disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      )}

      {/* Edit toolbar */}
      {editedCells.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-t bg-yellow-500/5 shrink-0">
          <span className="text-xs text-muted-foreground">
            {editedCells.size} pending change{editedCells.size !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              className="px-3 py-1 rounded text-xs bg-muted hover:bg-muted/80 transition-colors"
              onClick={handleCancelEdits}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1 rounded text-xs bg-green-500 text-white hover:bg-green-600 transition-colors"
              onClick={handleApplyEdits}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
