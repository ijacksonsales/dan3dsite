import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Section({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto w-full max-w-6xl px-4", className)}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="font-heading text-xs tracking-[0.25em] text-muted-foreground uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-1 font-heading text-2xl tracking-wide sm:text-3xl">
            {title}
          </h2>
        </div>
        {action && (
          <Link
            href={action.href}
            className="flex min-h-12 shrink-0 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-input bg-card px-6 py-12 text-center">
      <p className="font-heading text-lg">{title}</p>
      {children && (
        <div className="mt-2 text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}
