import { create } from "zustand";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  persistent?: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export function toast(
  title: string,
  options?: { type?: ToastType; description?: string; persistent?: boolean },
) {
  useToastStore.getState().addToast({
    title,
    type: options?.type ?? "info",
    description: options?.description,
    persistent: options?.persistent,
  });
}

toast.success = (title: string, description?: string) =>
  toast(title, { type: "success", description });
toast.error = (title: string, description?: string) =>
  toast(title, { type: "error", description, persistent: true });
toast.warning = (title: string, description?: string) =>
  toast(title, { type: "warning", description });
toast.info = (title: string, description?: string) =>
  toast(title, { type: "info", description });

function ToastItem({ item }: { item: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast);

  useEffect(() => {
    if (!item.persistent) {
      const timer = setTimeout(() => removeToast(item.id), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [item.id, item.persistent, removeToast]);

  const icons: Record<ToastType, string> = {
    success: "bx-check-circle",
    error: "bx-x-circle",
    warning: "bx-error",
    info: "bx-info-circle",
  };

  const styles: Record<ToastType, string> = {
    success: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
    error: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
    warning: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-fade-in",
        "bg-background/95 border-border",
        "min-w-[300px] max-w-[400px]",
      )}
    >
      <i className={cn("bx text-lg mt-0.5", icons[item.type], styles[item.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(item.id)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <i className="bx bx-x text-lg" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} />
      ))}
    </div>
  );
}
