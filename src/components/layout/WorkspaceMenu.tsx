import { useState } from "react";
import { useTabStore } from "@/stores/useTabStore";
import { tauriCreateDatabase } from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

interface WorkspaceMenuProps {
  connectionId: string;
}

export function WorkspaceMenu({ connectionId }: WorkspaceMenuProps) {
  const { openWorkspaceTab } = useTabStore();
  const [showCreateDb, setShowCreateDb] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateDatabase = async () => {
    if (!newDbName.trim()) return;
    setIsCreating(true);
    try {
      await tauriCreateDatabase({ connection_id: connectionId, name: newDbName.trim() });
      toast.success(`Database '${newDbName.trim()}' created`);
      setShowCreateDb(false);
      setNewDbName("");
    } catch (err) {
      toast.error("Failed to create database", String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const items: { icon: IconDefinition; label: string; action: () => void }[] = [
    {
      icon: faFileCode,
      label: "New SQL Sheet",
      action: () => openWorkspaceTab(connectionId, { type: "sql-sheet", title: "" }),
    },
    {
      icon: faDatabase,
      label: "Create Database",
      action: () => setShowCreateDb(true),
    },
    {
      icon: faUser,
      label: "Users & Privileges",
      action: () => openWorkspaceTab(connectionId, { type: "users", title: "Users & Privileges" }),
    },
    {
      icon: faFileExport,
      label: "Export",
      action: () => openWorkspaceTab(connectionId, { type: "export", title: "Export" }),
    },
    {
      icon: faFileImport,
      label: "Import",
      action: () => openWorkspaceTab(connectionId, { type: "import", title: "Import" }),
    },
    {
      icon: faChartBar,
      label: "Dashboard",
      action: () => openWorkspaceTab(connectionId, { type: "dashboard", title: "Dashboard" }),
    },
    {
      icon: faList,
      label: "Logs",
      action: () => openWorkspaceTab(connectionId, { type: "logs", title: "Logs" }),
    },
  ];

  return (
    <>
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

      <Dialog open={showCreateDb} onOpenChange={(v) => { if (!v) { setShowCreateDb(false); setNewDbName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Database</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="db-name">Database Name</Label>
              <Input
                id="db-name"
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                placeholder="my_database"
                onKeyDown={(e) => e.key === "Enter" && handleCreateDatabase()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDb(false); setNewDbName(""); }} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateDatabase} disabled={!newDbName.trim() || isCreating}>
              {isCreating ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
