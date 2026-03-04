import { useTabStore } from "@/stores/useTabStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { cn } from "@/lib/utils";

export function TabBar() {
  const { connectionTabs, activeConnectionId, setActiveConnection, closeConnectionTab } =
    useTabStore();
  const { sessions, disconnect } = useSessionStore();
  const { connections } = useConnectionStore();

  const handleClose = async (connectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeConnectionTab(connectionId);
    try {
      await disconnect(connectionId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center h-9 border-b bg-background/95 no-select shrink-0">
      <div className="flex items-center overflow-x-auto flex-1">
        {connectionTabs.map((tab) => {
          const connection = connections.find((c) => c.id === tab.connectionId);
          const session = sessions.get(tab.connectionId);
          const isActive = activeConnectionId === tab.connectionId;
          const isConnected = session?.isConnected ?? false;

          return (
            <button
              key={tab.connectionId}
              className={cn(
                "flex items-center gap-1.5 h-full px-3 border-r text-sm transition-colors shrink-0 min-w-0 max-w-[200px]",
                isActive
                  ? "bg-background text-foreground border-t-2 border-t-primary"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
              onClick={() => setActiveConnection(tab.connectionId)}
            >
              {/* Color dot */}
              {connection?.color && (
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: connection.color }}
                />
              )}

              {/* Connection name */}
              <span className="truncate text-xs font-medium">
                {connection?.name ?? tab.connectionId}
              </span>

              {/* Status indicator */}
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  isConnected ? "bg-green-500" : "bg-red-400",
                )}
              />

              {/* Close button */}
              <button
                className="ml-1 h-4 w-4 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                onClick={(e) => handleClose(tab.connectionId, e)}
              >
                <i className="bx bx-x text-xs" />
              </button>
            </button>
          );
        })}
      </div>

      {/* Home button */}
      <button
        className={cn(
          "flex h-full items-center px-3 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border-l shrink-0",
          !activeConnectionId && "text-foreground bg-background",
        )}
        onClick={() => setActiveConnection("")}
        title="Home"
      >
        <i className="bx bx-home text-sm" />
      </button>

      {/* Plus button */}
      <button
        className="flex h-full items-center px-3 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border-l shrink-0"
        onClick={() => setActiveConnection("")}
        title="Open new connection"
      >
        <i className="bx bx-plus text-sm" />
      </button>
    </div>
  );
}
