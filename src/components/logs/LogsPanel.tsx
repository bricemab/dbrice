import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { tauriGetLogs, tauriClearLogs, tauriExportLogs } from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
import type { LogEntry } from "@/types/settings";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faList,
  faChevronDown,
  faRotate,
  faSpinner,
  faDownload,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

interface LogsPanelProps {
  connectionId: string;
}

type LogLevel = "INFO" | "WARNING" | "ERROR";

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: "text-blue-500 dark:text-blue-400",
  WARNING: "text-amber-500 dark:text-amber-400",
  ERROR: "text-red-500 dark:text-red-400",
};

const LEVEL_BG: Record<LogLevel, string> = {
  INFO: "bg-blue-500/10",
  WARNING: "bg-amber-500/10",
  ERROR: "bg-red-500/10",
};

export function LogsPanel({ connectionId }: LogsPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<LogLevel | "ALL">("ALL");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await tauriGetLogs({ connection_id: connectionId });
      setLogs(data);
    } catch (err) {
      toast.error("Failed to load logs", String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await tauriClearLogs({ connection_id: connectionId });
      setLogs([]);
      toast.success("Logs cleared");
    } catch (err) {
      toast.error("Failed to clear logs", String(err));
    } finally {
      setShowClearConfirm(false);
    }
  };

  const handleExportLogs = async () => {
    setIsExporting(true);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        filters: [{ name: "Text Files", extensions: ["txt"] }],
        defaultPath: `dbrice_logs_${connectionId}.txt`,
      });
      if (!filePath) return;

      await tauriExportLogs({ connection_id: connectionId, file_path: filePath });
      toast.success("Logs exported successfully");
    } catch (err) {
      toast.error("Failed to export logs", String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const filteredLogs = filterLevel === "ALL" ? logs : logs.filter((l) => l.level === filterLevel);

  const levelCounts = {
    INFO: logs.filter((l) => l.level === "INFO").length,
    WARNING: logs.filter((l) => l.level === "WARNING").length,
    ERROR: logs.filter((l) => l.level === "ERROR").length,
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        <FontAwesomeIcon icon={faList} className="text-muted-foreground" />
        <span className="text-sm font-medium">Connection Logs</span>

        {/* Level filters */}
        <div className="flex gap-1 ml-2">
          {(["ALL", "INFO", "WARNING", "ERROR"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                filterLevel === level
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {level}
              {level !== "ALL" && <span className="ml-1 opacity-70">({levelCounts[level]})</span>}
              {level === "ALL" && <span className="ml-1 opacity-70">({logs.length})</span>}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Auto scroll toggle */}
          <button
            onClick={() => setAutoScroll((v) => !v)}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors flex items-center gap-1",
              autoScroll ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <FontAwesomeIcon icon={faChevronDown} />
            Auto-scroll
          </button>

          <Button variant="outline" size="sm" onClick={loadLogs}>
            <FontAwesomeIcon icon={faRotate} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLogs}
            disabled={isExporting || logs.length === 0}
          >
            {isExporting ? (
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            ) : (
              <FontAwesomeIcon icon={faDownload} />
            )}
            Export Logs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            disabled={logs.length === 0}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <FontAwesomeIcon icon={faTrash} />
            Clear Logs
          </Button>
        </div>
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <FontAwesomeIcon
            icon={faSpinner}
            className="animate-spin text-2xl text-muted-foreground"
          />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <FontAwesomeIcon icon={faList} className="text-3xl block" />
            <p className="text-sm">No log entries</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5 font-mono text-xs">
            {filteredLogs.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}

      {/* Clear confirm */}
      <ConfirmModal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearLogs}
        title="Clear Logs"
        description="Are you sure you want to clear all log entries for this connection? This cannot be undone."
        confirmLabel="Clear Logs"
        confirmVariant="destructive"
      />
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const level = (entry.level as LogLevel) || "INFO";
  const isLong = entry.message.length > 120;

  const timestamp = new Date(entry.created_at).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const dateStr = new Date(entry.created_at).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-1.5 rounded hover:bg-muted/40 transition-colors",
        level === "ERROR" && "bg-red-500/5",
      )}
    >
      {/* Timestamp */}
      <span className="text-muted-foreground whitespace-nowrap shrink-0">
        {dateStr} {timestamp}
      </span>

      {/* Level badge */}
      <span
        className={cn(
          "shrink-0 px-1 py-0.5 rounded text-[10px] font-semibold uppercase",
          LEVEL_COLORS[level],
          LEVEL_BG[level],
        )}
      >
        {level}
      </span>

      {/* Message */}
      <span
        className={cn(
          "flex-1 break-all",
          level === "ERROR" && "text-red-600 dark:text-red-400",
          level === "WARNING" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {isLong && !expanded ? `${entry.message.slice(0, 120)}...` : entry.message}
        {isLong && (
          <button
            className="ml-1 text-primary hover:underline text-[10px]"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "show less" : "show more"}
          </button>
        )}
      </span>
    </div>
  );
}
