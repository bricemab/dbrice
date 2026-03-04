import { useState } from "react";
import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useTabStore } from "@/stores/useTabStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { toast } from "@/components/common/Toast";
import { formatRelativeTime, cn } from "@/lib/utils";

interface ConnectionCardProps {
  connection: Connection;
  onEdit: (connection: Connection) => void;
}

export function ConnectionCard({ connection, onEdit }: ConnectionCardProps) {
  const { deleteConnection, duplicateConnection } = useConnectionStore();
  const { openConnectionTab } = useTabStore();
  const { connect } = useSessionStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      openConnectionTab(connection.id);
      await connect(connection.id);
      toast.success(`Connected to ${connection.name}`);
    } catch (err) {
      toast.error(`Failed to connect to ${connection.name}`, String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const copy = await duplicateConnection(connection.id);
      toast.success(`Duplicated as "${copy.name}"`);
    } catch (err) {
      toast.error("Failed to duplicate connection", String(err));
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteConnection(connection.id);
      toast.success(`"${connection.name}" deleted`);
    } catch (err) {
      toast.error("Failed to delete connection", String(err));
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all",
          "hover:shadow-md hover:border-primary/30 cursor-pointer",
        )}
        onDoubleClick={handleConnect}
      >
        {/* Color accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl opacity-60"
          style={{ backgroundColor: connection.color ?? "#6366f1" }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: connection.color ?? "#6366f1" }}
            />
            <h3 className="font-semibold text-sm truncate">{connection.name}</h3>
          </div>
          {connection.method === "tcp_ip_over_ssh" && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400">
              SSH
            </span>
          )}
        </div>

        {/* Details */}
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground truncate" title={connection.mysql.hostname}>
            <i className="bx bx-server mr-1" />
            {connection.mysql.hostname}
            {connection.mysql.port !== 3306 && (
              <span className="text-muted-foreground/60">:{connection.mysql.port}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground/60">
            <i className="bx bx-time-five mr-1" />
            {formatRelativeTime(connection.last_connected_at)}
          </p>
        </div>

        {/* Actions (visible on hover) */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 backdrop-blur-sm border text-muted-foreground hover:text-foreground hover:bg-primary hover:text-white hover:border-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleConnect();
              }}
              title="Connect"
            >
              {isConnecting ? (
                <i className="bx bx-loader-alt animate-spin text-sm" />
              ) : (
                <i className="bx bx-play text-sm" />
              )}
            </button>
          </div>
          <div className="flex gap-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 backdrop-blur-sm border text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(connection);
              }}
              title="Edit"
            >
              <i className="bx bx-pencil text-sm" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 backdrop-blur-sm border text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicate();
              }}
              title="Duplicate"
            >
              <i className="bx bx-copy text-sm" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 backdrop-blur-sm border text-muted-foreground hover:text-destructive transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteModal(true);
              }}
              title="Delete"
            >
              <i className="bx bx-trash text-sm" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Connection"
        description={`Are you sure you want to delete "${connection.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </>
  );
}
