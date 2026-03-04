import { create } from "zustand";
import type { QueryHistoryEntry } from "@/types/mysql";

interface QueryHistoryState {
  // In-memory per connection
  history: Map<string, QueryHistoryEntry[]>;
  addEntry: (connectionId: string, entry: QueryHistoryEntry) => void;
  getHistory: (connectionId: string) => QueryHistoryEntry[];
  clearHistory: (connectionId: string) => void;
}

export const useQueryHistoryStore = create<QueryHistoryState>((set, get) => ({
  history: new Map(),

  addEntry: (connectionId, entry) => {
    set((state) => {
      const next = new Map(state.history);
      const existing = next.get(connectionId) ?? [];
      // Keep last 500 entries
      const updated = [entry, ...existing].slice(0, 500);
      next.set(connectionId, updated);
      return { history: next };
    });
  },

  getHistory: (connectionId) => get().history.get(connectionId) ?? [],

  clearHistory: (connectionId) => {
    set((state) => {
      const next = new Map(state.history);
      next.delete(connectionId);
      return { history: next };
    });
  },
}));
