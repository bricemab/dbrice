import { useState, useCallback, useRef } from "react";
import { SqlEditor } from "./SqlEditor";
import { ResultGrid } from "./ResultGrid";
import type { QueryResult } from "@/types/mysql";
import { tauriExecuteQuery } from "@/lib/tauri";
import { useTabStore } from "@/stores/useTabStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faPlay,
  faCode,
  faCircleExclamation,
  faXmark,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";

interface SqlSheetProps {
  connectionId: string;
  tabId: string;
}

const LIMIT_OPTIONS = [10, 100, 1000, 10000] as const;

export function SqlSheet({ connectionId, tabId }: SqlSheetProps) {
  const { setTabDirty } = useTabStore();
  const { defaultLimit } = useSettingsStore();

  const [sql, setSql] = useState("SELECT 1;");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [limit, setLimit] = useState<number>(defaultLimit);
  const [splitPosition, setSplitPosition] = useState(60); // percentage
  const isDraggingSplit = useRef(false);

  const handleSqlChange = useCallback(
    (value: string) => {
      setSql(value);
      setTabDirty(connectionId, tabId, true);
    },
    [connectionId, tabId, setTabDirty],
  );

  const handleExecute = useCallback(
    async (sqlToRun: string) => {
      if (!sqlToRun.trim()) return;
      setIsExecuting(true);
      setError(null);

      try {
        const queryResult = await tauriExecuteQuery({
          connection_id: connectionId,
          sql: sqlToRun,
          limit,
        });
        setResult(queryResult);
      } catch (err) {
        const msg = String(err);
        setError(msg);
        setResult(null);
        toast.error("Query failed", msg);
      } finally {
        setIsExecuting(false);
      }
    },
    [connectionId, limit],
  );

  const handleSplitMouseDown = (e: React.MouseEvent) => {
    isDraggingSplit.current = true;
    const startY = e.clientY;
    const startPos = splitPosition;
    const container = (e.target as HTMLElement).closest(".split-container") as HTMLElement;
    const containerHeight = container?.clientHeight ?? 600;

    const handleMove = (e: MouseEvent) => {
      if (!isDraggingSplit.current) return;
      const delta = e.clientY - startY;
      const newPos = Math.min(85, Math.max(15, startPos + (delta / containerHeight) * 100));
      setSplitPosition(newPos);
    };

    const handleUp = () => {
      isDraggingSplit.current = false;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/20 shrink-0">
        <Button
          size="sm"
          onClick={() => handleExecute(sql)}
          disabled={isExecuting}
          className="h-7 px-3 text-xs"
        >
          {isExecuting ? (
            <>
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              Running...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faPlay} />
              Execute
            </>
          )}
        </Button>

        <Select
          value={String(limit)}
          onValueChange={(v) => setLimit(parseInt(v))}
        >
          <SelectTrigger className="h-7 w-24 text-xs">
            <span className="text-muted-foreground mr-1">LIMIT</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((v) => (
              <SelectItem key={v} value={String(v)}>
                {v.toLocaleString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Format SQL"
        >
          <FontAwesomeIcon icon={faCode} />
          Format
        </button>
      </div>

      {/* Split view */}
      <div className="split-container flex flex-col flex-1 overflow-hidden">
        {/* Editor */}
        <div
          className="overflow-hidden"
          style={{ height: `${splitPosition}%` }}
        >
          <SqlEditor
            value={sql}
            onChange={handleSqlChange}
            onExecute={handleExecute}
          />
        </div>

        {/* Divider */}
        <div
          className="h-1.5 bg-border/50 hover:bg-primary/40 cursor-row-resize transition-colors shrink-0 flex items-center justify-center"
          onMouseDown={handleSplitMouseDown}
        >
          <div className="w-8 h-0.5 rounded bg-muted-foreground/30" />
        </div>

        {/* Results */}
        <div
          className="overflow-hidden"
          style={{ height: `${100 - splitPosition - 1}%` }}
        >
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-600 dark:text-red-400">
              <FontAwesomeIcon icon={faCircleExclamation} className="shrink-0 mt-0.5" />
              <span className="flex-1 text-xs break-all font-mono">{error}</span>
              <button
                className="text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setError(null)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          )}

          {result ? (
            <ResultGrid result={result} connectionId={connectionId} />
          ) : !error ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              <FontAwesomeIcon icon={faCircleInfo} className="mr-2 text-lg" />
              Press Ctrl+Enter to execute the query
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
