"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/citizen/Icon";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const config: Record<ToastType, { icon: string; color: string; bg: string; border: string }> = {
  success: { icon: "CheckCircle2", color: "text-safe-600", bg: "bg-safe-50", border: "border-safe-200" },
  error: { icon: "AlertCircle", color: "text-danger-600", bg: "bg-danger-50", border: "border-danger-200" },
  info: { icon: "Info", color: "text-navy-600", bg: "bg-navy-50", border: "border-navy-200" },
  warning: { icon: "AlertTriangle", color: "text-warn-600", bg: "bg-warn-50", border: "border-warn-200" },
};

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const c = config[toast.type];
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-[var(--shadow-card-lg)] ${c.bg} ${c.border} animate-slide-up`}>
      <Icon name={c.icon} className={`w-5 h-5 ${c.color} flex-shrink-0`} />
      <p className="text-sm font-medium text-navy-800 flex-1">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="text-slate2-400 hover:text-slate2-600 transition-colors">
        <Icon name="X" className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-3rem)]">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
