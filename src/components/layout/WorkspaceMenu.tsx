import { useTabStore } from "@/stores/useTabStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faFileCode,
  faDatabase,
  faUser,
  faFileExport,
  faFileImport,
  faChartBar,
  faList,
} from "@fortawesome/free-solid-svg-icons";

interface WorkspaceMenuProps {
  connectionId: string;
}

export function WorkspaceMenu({ connectionId }: WorkspaceMenuProps) {
  const { openWorkspaceTab } = useTabStore();

  const items: { icon: IconDefinition; label: string; action: () => void }[] = [
    { icon: faFileCode, label: "New SQL Sheet", action: () => openWorkspaceTab(connectionId, { type: "sql-sheet", title: "" }) },
    { icon: faDatabase, label: "Create Database", action: () => openWorkspaceTab(connectionId, { type: "sql-sheet", title: "Create Database" }) },
    { icon: faUser, label: "Users & Privileges", action: () => openWorkspaceTab(connectionId, { type: "users", title: "Users & Privileges" }) },
    { icon: faFileExport, label: "Export", action: () => openWorkspaceTab(connectionId, { type: "export", title: "Export" }) },
    { icon: faFileImport, label: "Import", action: () => openWorkspaceTab(connectionId, { type: "import", title: "Import" }) },
    { icon: faChartBar, label: "Dashboard", action: () => openWorkspaceTab(connectionId, { type: "dashboard", title: "Dashboard" }) },
    { icon: faList, label: "Logs", action: () => openWorkspaceTab(connectionId, { type: "logs", title: "Logs" }) },
  ];

  return (
    <div className="flex items-center h-8 border-b bg-muted/20 px-2 gap-1 shrink-0">
      {items.map(({ icon, label, action }) => (
        <button
          key={label}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={action}
        >
          <FontAwesomeIcon icon={icon} className="text-sm" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
