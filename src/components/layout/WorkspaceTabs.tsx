import { useTabStore } from "@/stores/useTabStore";
import { cn } from "@/lib/utils";

interface WorkspaceTabsProps {
  connectionId: string;
}

const TAB_ICONS: Record<string, string> = {
  "sql-sheet": "bx-code-alt",
  "table-designer": "bx-table",
  "routine-editor": "bx-code-block",
  dashboard: "bx-bar-chart-alt-2",
  users: "bx-user",
  export: "bx-export",
  import: "bx-import",
  logs: "bx-list-ul",
};

export function WorkspaceTabs({ connectionId }: WorkspaceTabsProps) {
  const { connectionTabs, setActiveWorkspaceTab, closeWorkspaceTab } = useTabStore();
  const ct = connectionTabs.find((t) => t.connectionId === connectionId);
  if (!ct) return null;

  return (
    <div className="flex items-center h-8 border-b bg-background overflow-x-auto shrink-0">
      {ct.workspaceTabs.map((tab) => {
        const isActive = ct.activeWorkspaceTabId === tab.id;
        return (
          <button
            key={tab.id}
            className={cn(
              "flex items-center gap-1.5 h-full px-3 border-r text-xs transition-colors shrink-0 whitespace-nowrap",
              isActive
                ? "bg-background text-foreground border-b-2 border-b-primary -mb-px"
                : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
            onClick={() => setActiveWorkspaceTab(connectionId, tab.id)}
          >
            <i className={`bx ${TAB_ICONS[tab.type] ?? "bx-file"} text-sm`} />
            <span>{tab.title}</span>
            {tab.isDirty && <span className="text-primary">●</span>}
            <button
              className="ml-1 h-3.5 w-3.5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                closeWorkspaceTab(connectionId, tab.id);
              }}
            >
              <i className="bx bx-x text-[10px]" />
            </button>
          </button>
        );
      })}
    </div>
  );
}
