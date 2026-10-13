import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ADMIN_HOME } from "@/lib/admin/paths";

export function PageHeader({
  title,
  backHref = ADMIN_HOME,
  backLabel = "Início",
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-2">
      <Link
        href={backHref}
        className="-ml-3 inline-flex min-h-12 items-center gap-1 rounded-full pr-4 pl-2 text-base text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeftIcon className="size-5" />
        {backLabel}
      </Link>
      <h1 className="font-heading text-2xl font-medium">{title}</h1>
      {children}
    </div>
  );
}
