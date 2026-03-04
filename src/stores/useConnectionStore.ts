import { create } from "zustand";
import type { Connection, Folder, CreateConnectionInput } from "@/types/connection";
import {
  tauriGetConnections,
  tauriGetFolders,
  tauriCreateConnection,
  tauriUpdateConnection,
  tauriDeleteConnection,
  tauriDuplicateConnection,
  tauriCreateFolder,
  tauriUpdateFolder,
  tauriDeleteFolder,
  tauriMoveConnectionToFolder,
  tauriReorderConnections,
} from "@/lib/tauri";

interface ConnectionState {
  connections: Connection[];
  folders: Folder[];
  isLoading: boolean;
  searchQuery: string;
  expandedFolders: Set<string>;

  load: () => Promise<void>;
  createConnection: (input: CreateConnectionInput) => Promise<Connection>;
  updateConnection: (id: string, input: CreateConnectionInput) => Promise<Connection>;
  deleteConnection: (id: string) => Promise<void>;
  duplicateConnection: (id: string) => Promise<Connection>;
  createFolder: (name: string) => Promise<Folder>;
  updateFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveToFolder: (connectionId: string, folderId?: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  setSearchQuery: (query: string) => void;
  toggleFolderExpanded: (folderId: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  folders: [],
  isLoading: false,
  searchQuery: "",
  expandedFolders: new Set(),

  load: async () => {
    set({ isLoading: true });
    try {
      const [connections, folders] = await Promise.all([
        tauriGetConnections(),
        tauriGetFolders(),
      ]);
      set({ connections, folders, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createConnection: async (input) => {
    const connection = await tauriCreateConnection(input);
    set((state) => ({ connections: [...state.connections, connection] }));
    return connection;
  },

  updateConnection: async (id, input) => {
    const updated = await tauriUpdateConnection(id, input);
    set((state) => ({
      connections: state.connections.map((c) => (c.id === id ? updated : c)),
    }));
    return updated;
  },

  deleteConnection: async (id) => {
    await tauriDeleteConnection(id);
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    }));
  },

  duplicateConnection: async (id) => {
    const copy = await tauriDuplicateConnection(id);
    set((state) => ({ connections: [...state.connections, copy] }));
    return copy;
  },

  createFolder: async (name) => {
    const folder = await tauriCreateFolder(name);
    set((state) => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  updateFolder: async (id, name) => {
    await tauriUpdateFolder(id, name);
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  },

  deleteFolder: async (id) => {
    await tauriDeleteFolder(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      connections: state.connections.map((c) =>
        c.folder_id === id ? { ...c, folder_id: undefined } : c,
      ),
    }));
  },

  moveToFolder: async (connectionId, folderId) => {
    await tauriMoveConnectionToFolder(connectionId, folderId);
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === connectionId ? { ...c, folder_id: folderId } : c,
      ),
    }));
  },

  reorder: async (orderedIds) => {
    await tauriReorderConnections(orderedIds);
    const { connections } = get();
    const sorted = orderedIds
      .map((id) => connections.find((c) => c.id === id))
      .filter(Boolean) as Connection[];
    const rest = connections.filter((c) => !orderedIds.includes(c.id));
    set({ connections: [...sorted, ...rest] });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleFolderExpanded: (folderId) => {
    set((state) => {
      const next = new Set(state.expandedFolders);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return { expandedFolders: next };
    });
  },
}));
