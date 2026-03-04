import { useEffect } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { Toaster } from "@/components/common/Toast";

export default function App() {
  const { theme } = useSettingsStore();
  const { isAuthenticated, isFirstLaunch, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }
  }, [theme]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading DBrice...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isFirstLaunch ? <OnboardingPage /> : !isAuthenticated ? <LoginPage /> : <AppShell />}
      <Toaster />
    </>
  );
}
