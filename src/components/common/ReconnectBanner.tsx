import { useState } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import { toast } from "./Toast";

interface ReconnectBannerProps {
  connectionId: string;
}

export function ReconnectBanner({ connectionId }: ReconnectBannerProps) {
  const { getSession, connect } = useSessionStore();
  const session = getSession(connectionId);
  const [isReconnecting, setIsReconnecting] = useState(false);

  if (!session || session.isConnected) return null;

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await connect(connectionId);
      toast.success("Reconnected successfully");
    } catch (err) {
      toast.error("Failed to reconnect", String(err));
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-orange-500/10 border-b border-orange-500/20 text-sm text-orange-600 dark:text-orange-400">
      <i className="bx bx-wifi-off" />
      <span className="flex-1">Connection lost</span>
      <button
        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-orange-500/15 hover:bg-orange-500/25 transition-colors text-xs font-medium"
        onClick={handleReconnect}
        disabled={isReconnecting}
      >
        {isReconnecting ? (
          <>
            <i className="bx bx-loader-alt animate-spin" />
            Reconnecting...
          </>
        ) : (
          <>
            <i className="bx bx-refresh" />
            Reconnect
          </>
        )}
      </button>
    </div>
  );
}
