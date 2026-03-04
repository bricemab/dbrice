import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { ConnectionCard } from "./ConnectionCard";
import { FolderCard } from "./FolderCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlusCircle } from "@fortawesome/free-solid-svg-icons";

interface HomeGridProps {
  onEditConnection: (connection: Connection) => void;
  onNewConnection: () => void;
}

export function HomeGrid({ onEditConnection, onNewConnection }: HomeGridProps) {
  const { connections, folders, searchQuery } = useConnectionStore();

  const filteredConnections = connections.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mysql.hostname.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const rootConnections = filteredConnections.filter((c) => !c.folder_id);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 auto-rows-min">
      {/* Folders */}
      {folders.map((folder) => {
        const folderConnections = filteredConnections.filter((c) => c.folder_id === folder.id);
        if (searchQuery && folderConnections.length === 0) return null;
        return (
          <FolderCard
            key={folder.id}
            folder={folder}
            connections={folderConnections}
            onEditConnection={onEditConnection}
          />
        );
      })}

      {/* Root connections */}
      {rootConnections.map((conn) => (
        <ConnectionCard key={conn.id} connection={conn} onEdit={onEditConnection} />
      ))}

      {/* New Connection card */}
      <button
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-transparent p-4 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:bg-primary/5 min-h-[100px]"
        onClick={onNewConnection}
      >
        <FontAwesomeIcon icon={faPlusCircle} className="text-2xl" />
        <span className="text-sm font-medium">New Connection</span>
      </button>
    </div>
  );
}
