import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/common/Toast";

export function LoginPage() {
  const { login, reset, error } = useAuthStore();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;

    setIsLoading(true);
    try {
      await login(password);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await reset();
      toast.success("DBrice has been reset");
    } catch (err) {
      toast.error("Failed to reset", String(err));
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.08),transparent_60%)]" />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <i className="bx bx-data text-3xl text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">DBrice</h1>
          <p className="text-sm text-muted-foreground">MySQL Client</p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border bg-card shadow-xl p-6">
          <h2 className="mb-1 text-lg font-semibold text-foreground">Welcome back</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter your master password to unlock.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword((v) => !v)}
              >
                <i className={`bx ${showPassword ? "bx-hide" : "bx-show"}`} />
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive animate-fade-in">
                <i className="bx bx-error-circle shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!password || isLoading}>
              {isLoading ? (
                <>
                  <i className="bx bx-loader-alt animate-spin" />
                  Unlocking...
                </>
              ) : (
                <>
                  <i className="bx bx-lock-open" />
                  Unlock
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Reset link */}
        <div className="mt-4 text-center">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            onClick={() => setShowResetModal(true)}
          >
            Forgot password? Reset DBrice
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleReset}
        title="Reset DBrice"
        description="This will permanently delete all your connections, history, and settings. This cannot be undone."
        confirmLabel="Reset Everything"
        confirmVariant="destructive"
        isLoading={isResetting}
      />
    </div>
  );
}
