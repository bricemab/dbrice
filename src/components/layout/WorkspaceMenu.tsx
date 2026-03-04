import { useTabStore } from "@/stores/useTabStore";

interface WorkspaceMenuProps {
  connectionId: string;
}

export function WorkspaceMenu({ connectionId }: WorkspaceMenuProps) {
  const { openWorkspaceTab } = useTabStore();

  const items = [
    { icon: "bx-code-alt", label: "New SQL Sheet", action: () => openWorkspaceTab(connectionId, { type: "sql-sheet", title: "" }) },
    { icon: "bx-data", label: "Create Database", action: () => openWorkspaceTab(connectionId, { type: "sql-sheet", title: "Create Database" }) },
    { icon: "bx-user", label: "Users & Privileges", action: () => openWorkspaceTab(connectionId, { type: "users", title: "Users & Privileges" }) },
    { icon: "bx-export", label: "Export", action: () => openWorkspaceTab(connectionId, { type: "export", title: "Export" }) },
    { icon: "bx-import", label: "Import", action: () => openWorkspaceTab(connectionId, { type: "import", title: "Import" }) },
    { icon: "bx-bar-chart-alt-2", label: "Dashboard", action: () => openWorkspaceTab(connectionId, { type: "dashboard", title: "Dashboard" }) },
    { icon: "bx-list-ul", label: "Logs", action: () => openWorkspaceTab(connectionId, { type: "logs", title: "Logs" }) },
  ];

  return (
    <div className="flex items-center h-8 border-b bg-muted/20 px-2 gap-1 shrink-0">
      {items.map(({ icon, label, action }) => (
        <button
          key={label}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={action}
        >
          <i className={`bx ${icon} text-sm`} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
