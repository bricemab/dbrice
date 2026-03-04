import { useState } from "react";
import { useTabStore } from "@/stores/useTabStore";
import { TabBar } from "./TabBar";
import { HomePage } from "@/pages/HomePage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function AppShell() {
  const { activeConnectionId, connectionTabs } = useTabStore();
  const [showSettings, setShowSettings] = useState(false);

  const showHome = !activeConnectionId || connectionTabs.length === 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center border-b">
        <div className="flex-1">
          <TabBar />
        </div>
        <button
          className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-l shrink-0"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          <i className="bx bx-cog text-sm" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {showHome ? (
          <HomePage />
        ) : (
          <WorkspacePage connectionId={activeConnectionId!} />
        )}
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl h-[600px] p-0 flex flex-col">
          <SettingsPage onClose={() => setShowSettings(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
