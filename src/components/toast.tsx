"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { CheckCircle2, Info, X, AlertTriangle, AlertCircle } from "lucide-react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export type Toast = {
    id: string;
    variant: ToastVariant;
    title: string;
    description?: string;
    /** Auto-dismiss after this many ms. 0 = sticky. Default 4000. */
    duration?: number;
};

type ToastContextValue = {
    show: (toast: Omit<Toast, "id"> & { id?: string }) => string;
    success: (title: string, description?: string) => string;
    error: (title: string, description?: string) => string;
    warning: (title: string, description?: string) => string;
    info: (title: string, description?: string) => string;
    dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ReactNode> = {
    info: <Info className="h-4 w-4 text-brand-300" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-300" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-300" />,
    error: <AlertCircle className="h-4 w-4 text-red-300" />,
};

const VARIANT_CLASS: Record<ToastVariant, string> = {
    info: "border-brand-500/40 bg-brand-500/10",
    success: "border-emerald-500/40 bg-emerald-500/10",
    warning: "border-amber-500/40 bg-amber-500/10",
    error: "border-red-500/40 bg-red-500/10",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const show = useCallback<ToastContextValue["show"]>(
        (input) => {
            const id =
                input.id ??
                (typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `t_${Date.now()}_${Math.random().toString(36).slice(2)}`);
            const toast: Toast = {
                id,
                variant: input.variant,
                title: input.title,
                description: input.description,
                duration: input.duration ?? 4000,
            };
            setToasts((prev) => [...prev.filter((t) => t.id !== id), toast]);
            if (toast.duration && toast.duration > 0) {
                const timer = setTimeout(() => dismiss(id), toast.duration);
                timersRef.current.set(id, timer);
            }
            return id;
        },
        [dismiss],
    );

    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            for (const t of timers.values()) clearTimeout(t);
            timers.clear();
        };
    }, []);

    const value = useMemo<ToastContextValue>(
        () => ({
            show,
            dismiss,
            success: (title, description) =>
                show({ variant: "success", title, description }),
            error: (title, description) =>
                show({ variant: "error", title, description, duration: 6000 }),
            warning: (title, description) =>
                show({ variant: "warning", title, description }),
            info: (title, description) =>
                show({ variant: "info", title, description }),
        }),
        [show, dismiss],
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                aria-live="polite"
                aria-atomic="false"
                className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
            >
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        role={t.variant === "error" ? "alert" : "status"}
                        className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border ${VARIANT_CLASS[t.variant]} p-3 text-sm shadow-lg backdrop-blur`}
                    >
                        <span className="mt-0.5 shrink-0">{ICONS[t.variant]}</span>
                        <div className="min-w-0 flex-1">
                            <div className="font-medium">{t.title}</div>
                            {t.description ? (
                                <div className="mt-0.5 text-xs text-fg-muted">
                                    {t.description}
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={() => dismiss(t.id)}
                            className="shrink-0 rounded p-1 text-fg-muted hover:bg-bg-muted hover:text-fg"
                            aria-label="Dismiss"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error("useToast must be used within <ToastProvider>");
    }
    return ctx;
}
