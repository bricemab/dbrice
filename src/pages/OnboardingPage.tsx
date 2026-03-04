import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDatabase,
  faEye,
  faEyeSlash,
  faCircleExclamation,
  faSpinner,
  faLock,
} from "@fortawesome/free-solid-svg-icons";

export function OnboardingPage() {
  const { setupPassword } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await setupPassword(password);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />

      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <FontAwesomeIcon icon={faDatabase} className="text-3xl text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">DBrice</h1>
          <p className="text-sm text-muted-foreground">MySQL Client</p>
        </div>

        <div className="rounded-xl border bg-card shadow-xl p-6">
          <h2 className="mb-1 text-lg font-semibold">Welcome to DBrice</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Set a master password to protect your connections and credentials.
          </p>

          <div className="mb-4 rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              <strong>Important:</strong> This password protects all your connection credentials. If
              you forget it, you will need to reset DBrice and all your connections will be lost.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Master Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Choose a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {/* Password strength indicator */}
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        passwordStrength(password) >= level
                          ? level <= 1
                            ? "bg-red-500"
                            : level <= 2
                              ? "bg-yellow-500"
                              : level <= 3
                                ? "bg-blue-500"
                                : "bg-green-500"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <FontAwesomeIcon icon={faCircleExclamation} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!password || !confirm || isLoading}
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faLock} />
                  Set Master Password
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}
