import type { ReactNode } from "react";

/** Centered message for "not found" and error pages, store style. */
export function StatusMessage({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-heading text-3xl tracking-wide text-balance">
        {title}
      </h1>
      <div className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
        {children}
      </div>
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        {actions}
      </div>
    </div>
  );
}

export const statusPrimaryClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-espresso";
export const statusSecondaryClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted";
