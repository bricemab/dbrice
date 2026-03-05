import { useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/useSessionStore";
import { tauriExecuteQuery } from "@/lib/tauri";

const POLL_INTERVAL = 15_000; // 15 seconds

/**
 * Polls the connection every 15s with a lightweight query to detect drops.
 * Updates the session store via setConnectionLost when the connection is gone.
 */
export function useConnectionStatus(connectionId: string) {
  const { isConnected, setConnectionLost } = useSessionStore();
  const connected = isConnected(connectionId);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!connected) return;

    const check = async () => {
      try {
        await tauriExecuteQuery({ connection_id: connectionId, sql: "SELECT 1", limit: 1 });
      } catch {
        setConnectionLost(connectionId);
      }
    };

    intervalRef.current = setInterval(check, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [connected, connectionId, setConnectionLost]);
}
