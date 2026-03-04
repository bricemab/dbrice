interface TestConnectionBannerProps {
  status: "idle" | "testing" | "success" | "error";
  error?: string;
}

export function TestConnectionBanner({ status, error }: TestConnectionBannerProps) {
  if (status === "idle") return null;

  if (status === "testing") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground animate-fade-in">
        <i className="bx bx-loader-alt animate-spin" />
        <span>Testing connection...</span>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-600 dark:text-green-400 animate-fade-in">
        <i className="bx bx-check-circle" />
        <span>Connection successful</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-600 dark:text-red-400 animate-fade-in">
      <i className="bx bx-x-circle shrink-0 mt-0.5" />
      <span className="break-all">{error || "Connection failed"}</span>
    </div>
  );
}
