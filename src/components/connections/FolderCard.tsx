import { useState } from "react";
import type { Folder, Connection } from "@/types/connection";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { toast } from "@/components/common/Toast";
import { ConnectionCard } from "./ConnectionCard";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faFolderOpen,
  faChevronRight,
  faPen,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

interface FolderCardProps {
  folder: Folder;
  connections: Connection[];
  onEditConnection: (connection: Connection) => void;
}

export function FolderCard({ folder, connections, onEditConnection }: FolderCardProps) {
  const { updateFolder, deleteFolder, expandedFolders, toggleFolderExpanded } =
    useConnectionStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isExpanded = expandedFolders.has(folder.id);

  const handleRename = async () => {
    if (editName.trim() && editName !== folder.name) {
      try {
        await updateFolder(folder.id, editName.trim());
        toast.success("Folder renamed");
      } catch (err) {
        toast.error("Failed to rename folder", String(err));
      }
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteFolder(folder.id);
      toast.success(`Folder "${folder.name}" deleted`);
    } catch (err) {
      toast.error("Failed to delete folder", String(err));
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <div className="col-span-full">
        {/* Folder header */}
        <div
          className={cn(
            "group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm cursor-pointer",
            "hover:shadow-md hover:border-primary/30 transition-all",
          )}
          onClick={() => toggleFolderExpanded(folder.id)}
        >
          <FontAwesomeIcon
            icon={isExpanded ? faFolderOpen : faFolder}
            className="text-lg text-muted-foreground transition-transform"
          />

          {isEditing ? (
            <input
              className="flex-1 bg-transparent text-sm font-medium outline-none border-b border-primary"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span className="flex-1 text-sm font-medium">{folder.name}</span>
          )}

          <span className="text-xs text-muted-foreground">
            {connections.length} connection{connections.length !== 1 ? "s" : ""}
          </span>

          <FontAwesomeIcon
            icon={faChevronRight}
            className={cn(
              "text-muted-foreground transition-transform",
              isExpanded && "rotate-90",
            )}
          />

          {/* Actions */}
          <div
            className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => {
                setEditName(folder.name);
                setIsEditing(true);
              }}
              title="Rename folder"
            >
              <FontAwesomeIcon icon={faPen} className="text-sm" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => setShowDeleteModal(true)}
              title="Delete folder"
            >
              <FontAwesomeIcon icon={faTrash} className="text-sm" />
            </button>
          </div>
        </div>

        {/* Connections inside folder */}
        {isExpanded && connections.length > 0 && (
          <div className="mt-2 pl-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                onEdit={onEditConnection}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Folder"
        description={`Delete "${folder.name}"? The connections inside will be moved to root.`}
        confirmLabel="Delete Folder"
        isLoading={isDeleting}
      />
    </>
  );
}
