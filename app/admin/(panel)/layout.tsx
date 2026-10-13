import { StoreIcon } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/admin/logout-button";
import { BrandLogo } from "@/components/store/brand-logo";
import { ADMIN_HOME } from "@/lib/admin/paths";

/** Admin pages behind login (the middleware checks `is_admin()`). */
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4">
          <Link
            href={ADMIN_HOME}
            aria-label="Início do painel"
            className="flex min-h-12 items-center"
          >
            <BrandLogo />
          </Link>
          <Link
            href="/"
            target="_blank"
            className="ml-auto flex min-h-12 items-center gap-2 rounded-full px-4 text-base hover:bg-secondary"
          >
            <StoreIcon className="size-5" />
            <span className="max-sm:sr-only">Ver loja</span>
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28">
        {children}
      </main>
    </>
  );
}
