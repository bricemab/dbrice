import { useTabStore } from "@/stores/useTabStore";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faFileCode,
  faTable,
  faCode,
  faChartBar,
  faUser,
  faFileExport,
  faFileImport,
  faList,
  faFile,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

interface WorkspaceTabsProps {
  connectionId: string;
}

const TAB_ICONS: Record<string, IconDefinition> = {
  "sql-sheet": faFileCode,
  "table-designer": faTable,
  "routine-editor": faCode,
  dashboard: faChartBar,
  users: faUser,
  export: faFileExport,
  import: faFileImport,
  logs: faList,
};

export function WorkspaceTabs({ connectionId }: WorkspaceTabsProps) {
  const { connectionTabs, setActiveWorkspaceTab, closeWorkspaceTab } = useTabStore();
  const ct = connectionTabs.find((t) => t.connectionId === connectionId);
  if (!ct) return null;

  return (
    <div className="flex items-center h-8 border-b bg-background overflow-x-auto shrink-0">
      {ct.workspaceTabs.map((tab) => {
        const isActive = ct.activeWorkspaceTabId === tab.id;
        const tabIcon = TAB_ICONS[tab.type] ?? faFile;
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
            <FontAwesomeIcon icon={tabIcon} className="text-sm" />
            <span>{tab.title}</span>
            {tab.isDirty && <span className="text-primary">●</span>}
            <button
              className="ml-1 h-3.5 w-3.5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                closeWorkspaceTab(connectionId, tab.id);
              }}
            >
              <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
            </button>
          </button>
        );
      })}
    </div>
  );
}
