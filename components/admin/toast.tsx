"use client";

import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type Tone = "success" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(
  () => {},
);

/** `toast("Categoria salva.")` — short feedback above the bottom action bar. */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: Tone = "success") => {
    setCurrent({ id: ++nextId.current, message, tone });
  }, []);

  useEffect(() => {
    if (!current) return;
    // Errors stay longer: they usually say what to do next.
    const timeout = setTimeout(
      () => setCurrent((toast) => (toast?.id === current.id ? null : toast)),
      current.tone === "error" ? 7000 : 3000,
    );
    return () => clearTimeout(timeout);
  }, [current]);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4"
      >
        {current && (
          <p
            key={current.id}
            role={current.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-md animate-in items-center gap-3 rounded-2xl px-5 py-3 text-base shadow-lg fade-in-0 slide-in-from-bottom-2",
              current.tone === "error"
                ? "bg-destructive text-white"
                : "bg-espresso text-primary-foreground",
            )}
          >
            {current.tone === "error" ? (
              <CircleAlertIcon className="size-5 shrink-0" />
            ) : (
              <CircleCheckIcon className="size-5 shrink-0" />
            )}
            {current.message}
          </p>
        )}
      </div>
    </ToastContext>
  );
}
