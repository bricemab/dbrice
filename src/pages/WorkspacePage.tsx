import { Sidebar } from "@/components/layout/Sidebar";
import { WorkspaceMenu } from "@/components/layout/WorkspaceMenu";
import { WorkspaceTabs } from "@/components/layout/WorkspaceTabs";
import { ReconnectBanner } from "@/components/common/ReconnectBanner";
import { useTabStore } from "@/stores/useTabStore";
import { useSessionStore } from "@/stores/useSessionStore";

import { SqlSheet } from "@/components/editor/SqlSheet";
import { DashboardPage } from "@/components/dashboard/Dashboard";
import { TableDesigner } from "@/components/database/TableDesigner";
import { RoutineEditor } from "@/components/routines/RoutineEditor";
import { UserManager } from "@/components/users/UserManager";
import { ExportWizard } from "@/components/export/ExportWizard";
import { ImportWizard } from "@/components/export/ImportWizard";
import { LogsPanel } from "@/components/logs/LogsPanel";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCode } from "@fortawesome/free-solid-svg-icons";

interface WorkspacePageProps {
  connectionId: string;
}

export function WorkspacePage({ connectionId }: WorkspacePageProps) {
  const { getActiveWorkspaceTab } = useTabStore();
  const { sessions } = useSessionStore();
  const activeTab = getActiveWorkspaceTab(connectionId);
  const session = sessions.get(connectionId);
  const currentDatabase = session?.activeDatabase ?? "";

  const renderContent = () => {
    if (!activeTab) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <FontAwesomeIcon icon={faFileCode} className="text-4xl block" />
            <p className="text-sm">No tab open. Use the menu above to get started.</p>
          </div>
        </div>
      );
    }

    switch (activeTab.type) {
      case "sql-sheet":
        return <SqlSheet connectionId={connectionId} tabId={activeTab.id} />;

      case "dashboard":
        return <DashboardPage connectionId={connectionId} />;

      case "table-designer": {
        const meta = activeTab.metadata ?? {};
        return (
          <TableDesigner
            connectionId={connectionId}
            database={(meta.database as string) || currentDatabase}
            tableDef={meta.tableDef as Parameters<typeof TableDesigner>[0]["tableDef"]}
          />
        );
      }

      case "routine-editor": {
        const meta = activeTab.metadata ?? {};
        return (
          <RoutineEditor
            connectionId={connectionId}
            database={(meta.database as string) || currentDatabase}
            routineName={(meta.routineName as string) || ""}
            routineType={((meta.routineType as string) || "PROCEDURE") as "PROCEDURE" | "FUNCTION"}
            tabId={activeTab.id}
          />
        );
      }

      case "users":
        return <UserManager connectionId={connectionId} />;

      case "export":
        return <ExportWizard connectionId={connectionId} defaultDatabase={currentDatabase} />;

      case "import":
        return <ImportWizard connectionId={connectionId} defaultDatabase={currentDatabase} />;

      case "logs":
        return <LogsPanel connectionId={connectionId} />;

      default:
        return (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="text-sm">Unknown tab type: {activeTab.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ReconnectBanner connectionId={connectionId} />
      <WorkspaceMenu connectionId={connectionId} />
      <WorkspaceTabs connectionId={connectionId} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar connectionId={connectionId} />
        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </div>
    </div>
  );
}
