import { useEffect, useState } from "react";
import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { HomeGrid } from "@/components/connections/HomeGrid";
import { ConnectionFormModal } from "@/components/connections/ConnectionFormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/common/Toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolderPlus,
  faPlus,
  faMagnifyingGlass,
  faXmark,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

export function HomePage() {
  const { load, createFolder, setSearchQuery, searchQuery, isLoading } = useConnectionStore();
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [editConnection, setEditConnection] = useState<Connection | undefined>();

  useEffect(() => {
    load().catch((err) => toast.error("Failed to load connections", String(err)));
  }, [load]);

  const handleNewFolder = async () => {
    const name = `Folder ${Date.now().toString().slice(-4)}`;
    try {
      await createFolder(name);
    } catch (err) {
      toast.error("Failed to create folder", String(err));
    }
  };

  const handleEditConnection = (connection: Connection) => {
    setEditConnection(connection);
    setShowConnectionModal(true);
  };

  const handleModalClose = () => {
    setShowConnectionModal(false);
    setEditConnection(undefined);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
        <Button variant="outline" size="sm" onClick={handleNewFolder}>
          <FontAwesomeIcon icon={faFolderPlus} />
          New Folder
        </Button>
        <Button size="sm" onClick={() => setShowConnectionModal(true)}>
          <FontAwesomeIcon icon={faPlus} />
          New Connection
        </Button>
        <div className="relative ml-auto w-64">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
          />
          <Input
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <FontAwesomeIcon icon={faXmark} className="text-sm" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl mr-3" />
            Loading connections...
          </div>
        ) : (
          <HomeGrid
            onEditConnection={handleEditConnection}
            onNewConnection={() => setShowConnectionModal(true)}
          />
        )}
      </div>

      <ConnectionFormModal
        open={showConnectionModal}
        onClose={handleModalClose}
        editConnection={editConnection}
      />
    </div>
  );
}
