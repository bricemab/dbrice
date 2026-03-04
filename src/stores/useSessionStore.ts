import { create } from "zustand";
import { tauriConnect, tauriDisconnect } from "@/lib/tauri";

export interface ActiveSession {
  connectionId: string;
  activeDatabase?: string;
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
}

interface SessionState {
  sessions: Map<string, ActiveSession>;
  connect: (connectionId: string, sshPassphrase?: string) => Promise<void>;
  disconnect: (connectionId: string) => Promise<void>;
  setActiveDatabase: (connectionId: string, database: string) => void;
  setConnectionLost: (connectionId: string) => void;
  getSession: (connectionId: string) => ActiveSession | undefined;
  isConnected: (connectionId: string) => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: new Map(),

  connect: async (connectionId, sshPassphrase) => {
    set((state) => {
      const next = new Map(state.sessions);
      next.set(connectionId, {
        connectionId,
        isConnected: false,
        isConnecting: true,
        error: undefined,
      });
      return { sessions: next };
    });

    try {
      await tauriConnect({ connection_id: connectionId, ssh_passphrase: sshPassphrase });
      set((state) => {
        const next = new Map(state.sessions);
        next.set(connectionId, {
          connectionId,
          isConnected: true,
          isConnecting: false,
          error: undefined,
        });
        return { sessions: next };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set((state) => {
        const next = new Map(state.sessions);
        next.set(connectionId, {
          connectionId,
          isConnected: false,
          isConnecting: false,
          error: msg,
        });
        return { sessions: next };
      });
      throw err;
    }
  },

  disconnect: async (connectionId) => {
    await tauriDisconnect(connectionId);
    set((state) => {
      const next = new Map(state.sessions);
      next.delete(connectionId);
      return { sessions: next };
    });
  },

  setActiveDatabase: (connectionId, database) => {
    set((state) => {
      const next = new Map(state.sessions);
      const session = next.get(connectionId);
      if (session) {
        next.set(connectionId, { ...session, activeDatabase: database });
      }
      return { sessions: next };
    });
  },

  setConnectionLost: (connectionId) => {
    set((state) => {
      const next = new Map(state.sessions);
      const session = next.get(connectionId);
      if (session) {
        next.set(connectionId, { ...session, isConnected: false, error: "Connection lost" });
      }
      return { sessions: next };
    });
  },

  getSession: (connectionId) => get().sessions.get(connectionId),
  isConnected: (connectionId) => get().sessions.get(connectionId)?.isConnected ?? false,
}));
