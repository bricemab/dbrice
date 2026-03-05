import { useState, useCallback } from "react";
import { tauriExecuteQuery } from "@/lib/tauri";
import type { QueryResult } from "@/types/mysql";

interface UseMysqlQueryOptions {
  connectionId: string;
  limit?: number;
}

export function useMysqlQuery({ connectionId, limit = 1000 }: UseMysqlQueryOptions) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const execute = useCallback(
    async (sql: string) => {
      if (!sql.trim()) return;
      setIsExecuting(true);
      setError(null);
      try {
        const r = await tauriExecuteQuery({ connection_id: connectionId, sql, limit });
        setResult(r);
        return r;
      } catch (err) {
        const msg = String(err);
        setError(msg);
        setResult(null);
        throw err;
      } finally {
        setIsExecuting(false);
      }
    },
    [connectionId, limit],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, isExecuting, execute, reset };
}
