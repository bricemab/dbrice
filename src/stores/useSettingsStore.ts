import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme, DefaultLimit } from "@/types/settings";

interface SettingsState {
  theme: Theme;
  defaultLimit: DefaultLimit;
  setTheme: (theme: Theme) => void;
  setDefaultLimit: (limit: DefaultLimit) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      defaultLimit: 1000,
      setTheme: (theme) => set({ theme }),
      setDefaultLimit: (limit) => set({ defaultLimit: limit }),
    }),
    {
      name: "dbrice-settings",
    },
  ),
);
