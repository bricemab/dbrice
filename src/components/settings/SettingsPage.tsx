import { useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { tauriChangeMasterPassword } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { toast } from "@/components/common/Toast";
import type { Theme, DefaultLimit } from "@/types/settings";
import { cn } from "@/lib/utils";

export function SettingsPage({ onClose }: { onClose: () => void }) {
  const { theme, defaultLimit, setTheme, setDefaultLimit } = useSettingsStore();
  const { reset } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);

    if (newPassword.length < 6) {
      setPwdError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Passwords do not match.");
      return;
    }

    setIsSavingPwd(true);
    try {
      await tauriChangeMasterPassword(currentPassword, newPassword);
      toast.success("Master password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwdError(String(err));
    } finally {
      setIsSavingPwd(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await reset();
    } catch (err) {
      toast.error("Failed to reset", String(err));
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">Settings</h1>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={onClose}
        >
          <i className="bx bx-x text-xl" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-8">
        {/* Appearance */}
        <Section title="Appearance">
          <Field label="Theme">
            <div className="flex gap-2">
              {(["light", "dark", "system"] as Theme[]).map((t) => (
                <button
                  key={t}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm capitalize transition-colors",
                    theme === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent",
                  )}
                  onClick={() => setTheme(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Editor */}
        <Section title="Editor">
          <Field label="Default LIMIT">
            <Select
              value={String(defaultLimit)}
              onValueChange={(v) => setDefaultLimit(parseInt(v) as DefaultLimit)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 100, 1000, 10000].map((v) => (
                  <SelectItem key={v} value={String(v)}>
                    {v.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* Security */}
        <Section title="Security">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Change Master Password</h4>
            <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {pwdError && (
                <p className="text-sm text-destructive">{pwdError}</p>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={!currentPassword || !newPassword || isSavingPwd}
              >
                {isSavingPwd ? "Saving..." : "Save Password"}
              </Button>
            </form>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowResetModal(true)}
              >
                <i className="bx bx-reset" />
                Reset DBrice
              </Button>
            </div>
          </div>
        </Section>

        {/* About */}
        <Section title="About">
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Version: <span className="text-foreground font-mono">v1.0.0</span>
            </p>
            <div className="flex gap-3">
              <a
                className="text-primary hover:underline"
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  const { open } = await import("@tauri-apps/plugin-shell");
                  open("https://github.com/bricemab/dbrice/releases");
                }}
              >
                View Changelog
              </a>
              <a
                className="text-primary hover:underline"
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  const { open } = await import("@tauri-apps/plugin-shell");
                  open("https://github.com/bricemab/dbrice");
                }}
              >
                GitHub
              </a>
            </div>
          </div>
        </Section>
      </div>

      <ConfirmModal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleReset}
        title="Reset DBrice"
        description="This will permanently delete all your connections, history, and settings. This cannot be undone."
        confirmLabel="Reset Everything"
        isLoading={isResetting}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
