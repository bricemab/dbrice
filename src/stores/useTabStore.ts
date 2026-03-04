import { create } from "zustand";

export type WorkspaceTabType =
  | "sql-sheet"
  | "table-designer"
  | "routine-editor"
  | "dashboard"
  | "users"
  | "export"
  | "import"
  | "logs";

export interface WorkspaceTab {
  id: string;
  type: WorkspaceTabType;
  title: string;
  isDirty?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ConnectionTab {
  connectionId: string;
  activeWorkspaceTabId: string | null;
  workspaceTabs: WorkspaceTab[];
  sqlSheetCounter: number;
}

interface TabState {
  // Global connection tabs
  connectionTabs: ConnectionTab[];
  activeConnectionId: string | null;

  // Actions
  openConnectionTab: (connectionId: string) => void;
  closeConnectionTab: (connectionId: string) => void;
  setActiveConnection: (connectionId: string) => void;

  // Workspace tabs within a connection
  openWorkspaceTab: (connectionId: string, tab: Omit<WorkspaceTab, "id">) => string;
  closeWorkspaceTab: (connectionId: string, tabId: string) => void;
  setActiveWorkspaceTab: (connectionId: string, tabId: string) => void;
  setTabDirty: (connectionId: string, tabId: string, dirty: boolean) => void;
  setTabTitle: (connectionId: string, tabId: string, title: string) => void;
  getActiveWorkspaceTab: (connectionId: string) => WorkspaceTab | null;
}

let tabIdCounter = 0;
const generateTabId = () => `tab-${++tabIdCounter}`;

export const useTabStore = create<TabState>((set, get) => ({
  connectionTabs: [],
  activeConnectionId: null,

  openConnectionTab: (connectionId) => {
    const { connectionTabs } = get();
    if (connectionTabs.some((t) => t.connectionId === connectionId)) {
      set({ activeConnectionId: connectionId });
      return;
    }

    const firstTabId = generateTabId();
    const newTab: ConnectionTab = {
      connectionId,
      activeWorkspaceTabId: firstTabId,
      sqlSheetCounter: 1,
      workspaceTabs: [
        {
          id: firstTabId,
          type: "sql-sheet",
          title: "Query 1",
          isDirty: false,
        },
      ],
    };

    set((state) => ({
      connectionTabs: [...state.connectionTabs, newTab],
      activeConnectionId: connectionId,
    }));
  },

  closeConnectionTab: (connectionId) => {
    set((state) => {
      const tabs = state.connectionTabs.filter((t) => t.connectionId !== connectionId);
      const newActive =
        state.activeConnectionId === connectionId
          ? (tabs[tabs.length - 1]?.connectionId ?? null)
          : state.activeConnectionId;
      return { connectionTabs: tabs, activeConnectionId: newActive };
    });
  },

  setActiveConnection: (connectionId) => set({ activeConnectionId: connectionId }),

  openWorkspaceTab: (connectionId, tabData) => {
    const id = generateTabId();
    set((state) => ({
      connectionTabs: state.connectionTabs.map((ct) => {
        if (ct.connectionId !== connectionId) return ct;

        // For sql-sheet, generate "Query N" title
        let title = tabData.title;
        let sqlSheetCounter = ct.sqlSheetCounter;
        if (tabData.type === "sql-sheet" && !tabData.title) {
          sqlSheetCounter = ct.sqlSheetCounter + 1;
          title = `Query ${sqlSheetCounter}`;
        }

        return {
          ...ct,
          sqlSheetCounter,
          activeWorkspaceTabId: id,
          workspaceTabs: [...ct.workspaceTabs, { ...tabData, id, title }],
        };
      }),
    }));
    return id;
  },

  closeWorkspaceTab: (connectionId, tabId) => {
    set((state) => ({
      connectionTabs: state.connectionTabs.map((ct) => {
        if (ct.connectionId !== connectionId) return ct;
        const tabs = ct.workspaceTabs.filter((t) => t.id !== tabId);
        const newActiveId =
          ct.activeWorkspaceTabId === tabId
            ? (tabs[tabs.length - 1]?.id ?? null)
            : ct.activeWorkspaceTabId;
        return { ...ct, workspaceTabs: tabs, activeWorkspaceTabId: newActiveId };
      }),
    }));
  },

  setActiveWorkspaceTab: (connectionId, tabId) => {
    set((state) => ({
      connectionTabs: state.connectionTabs.map((ct) =>
        ct.connectionId === connectionId ? { ...ct, activeWorkspaceTabId: tabId } : ct,
      ),
    }));
  },

  setTabDirty: (connectionId, tabId, dirty) => {
    set((state) => ({
      connectionTabs: state.connectionTabs.map((ct) => {
        if (ct.connectionId !== connectionId) return ct;
        return {
          ...ct,
          workspaceTabs: ct.workspaceTabs.map((t) =>
            t.id === tabId ? { ...t, isDirty: dirty } : t,
          ),
        };
      }),
    }));
  },

  setTabTitle: (connectionId, tabId, title) => {
    set((state) => ({
      connectionTabs: state.connectionTabs.map((ct) => {
        if (ct.connectionId !== connectionId) return ct;
        return {
          ...ct,
          workspaceTabs: ct.workspaceTabs.map((t) =>
            t.id === tabId ? { ...t, title } : t,
          ),
        };
      }),
    }));
  },

  getActiveWorkspaceTab: (connectionId) => {
    const ct = get().connectionTabs.find((t) => t.connectionId === connectionId);
    if (!ct || !ct.activeWorkspaceTabId) return null;
    return ct.workspaceTabs.find((t) => t.id === ct.activeWorkspaceTabId) ?? null;
  },
}));
