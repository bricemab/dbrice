import { create } from "zustand";
import {
  tauriCheckFirstLaunch,
  tauriVerifyMasterPassword,
  tauriSetupMasterPassword,
  tauriResetDbrice,
} from "@/lib/tauri";

interface AuthState {
  isAuthenticated: boolean;
  isFirstLaunch: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (password: string) => Promise<boolean>;
  setupPassword: (password: string) => Promise<void>;
  logout: () => void;
  reset: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isFirstLaunch: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      const isFirst = await tauriCheckFirstLaunch();
      set({ isFirstLaunch: isFirst, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (password: string) => {
    set({ error: null });
    try {
      const valid = await tauriVerifyMasterPassword(password);
      if (valid) {
        set({ isAuthenticated: true, error: null });
      } else {
        set({ error: "Incorrect password. Please try again." });
      }
      return valid;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return false;
    }
  },

  setupPassword: async (password: string) => {
    await tauriSetupMasterPassword(password);
    set({ isFirstLaunch: false, isAuthenticated: true });
  },

  logout: () => {
    set({ isAuthenticated: false });
  },

  reset: async () => {
    await tauriResetDbrice();
    set({ isAuthenticated: false, isFirstLaunch: true });
  },
}));
