import { useRef, useState, useCallback } from "react";
import { SidebarTree } from "./SidebarTree";
import { useSessionStore } from "@/stores/useSessionStore";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate, faDatabase } from "@fortawesome/free-solid-svg-icons";

interface SidebarProps {
  connectionId: string;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 240;

export function Sidebar({ connectionId }: SidebarProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [refreshKey, setRefreshKey] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const { getSession } = useSessionStore();
  const session = getSession(connectionId);
  const activeDb = session?.activeDatabase;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = e.clientX - startX.current;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width],
  );

  return (
    <div className="relative flex flex-col border-r bg-background/95 shrink-0" style={{ width }}>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30 min-w-0">
        <FontAwesomeIcon icon={faDatabase} className="text-muted-foreground text-xs shrink-0" />
        <span
          className="text-xs font-medium truncate flex-1"
          title={activeDb ?? "No database selected"}
        >
          {activeDb ?? "Schema"}
        </span>
        <button
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          title="Refresh"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <FontAwesomeIcon icon={faRotate} className="text-sm" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-hidden">
        <SidebarTree connectionId={connectionId} refreshKey={refreshKey} />
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors",
          isDragging.current && "bg-primary/60",
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
