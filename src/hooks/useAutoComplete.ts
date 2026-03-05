import { useState, useEffect } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import { tauriGetDatabases, tauriGetTables, tauriGetTableColumns } from "@/lib/tauri";

interface AutoCompleteData {
  databases: string[];
  tables: string[];
  columns: string[];
}

/**
 * Fetches schema data for CodeMirror autocomplete suggestions.
 * Re-fetches when the active database changes.
 */
export function useAutoComplete(connectionId: string): AutoCompleteData {
  const { getSession } = useSessionStore();
  const session = getSession(connectionId);
  const activeDatabase = session?.activeDatabase;

  const [data, setData] = useState<AutoCompleteData>({
    databases: [],
    tables: [],
    columns: [],
  });

  useEffect(() => {
    if (!session?.isConnected) return;

    tauriGetDatabases({ connection_id: connectionId })
      .then((dbs) => setData((prev) => ({ ...prev, databases: dbs })))
      .catch(() => {});
  }, [connectionId, session?.isConnected]);

  useEffect(() => {
    if (!activeDatabase || !session?.isConnected) return;

    tauriGetTables({ connection_id: connectionId, database: activeDatabase })
      .then(async (tables) => {
        const tableNames = tables.map((t) => t.name);
        setData((prev) => ({ ...prev, tables: tableNames }));

        // Fetch columns for all tables (best-effort)
        const colResults = await Promise.allSettled(
          tableNames.map((t) =>
            tauriGetTableColumns({
              connection_id: connectionId,
              database: activeDatabase,
              table: t,
            }),
          ),
        );
        const columns = colResults.flatMap((r) =>
          r.status === "fulfilled" ? (r.value as { name: string }[]).map((c) => c.name) : [],
        );
        setData((prev) => ({ ...prev, columns: [...new Set(columns)] }));
      })
      .catch(() => {});
  }, [connectionId, activeDatabase, session?.isConnected]);

  return data;
}
