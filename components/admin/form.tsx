import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Admin form controls: tall touch targets (≥ 48 px) and 16 px text, which
 * also stops iOS from zooming into the field on focus.
 */
export const inputClassName =
  "block min-h-12 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="block text-base font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClassName, className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputClassName, "min-h-32 py-3 leading-relaxed", className)}
      {...props}
    />
  );
}

/** Bottom bar for the main action, always within thumb reach on a tablet. */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
        {children}
      </div>
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-4 py-3 text-base",
        tone === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {children}
    </p>
  );
}

/** Large primary action, full width on phones and tablets in portrait. */
export const primaryButtonClassName =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-espresso disabled:opacity-60";
