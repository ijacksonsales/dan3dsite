"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Swipeable row of category chips under the header. */
export function CategoryNav({
  categories,
}: {
  categories: { id: string; name: string; slug: string }[];
}) {
  const pathname = usePathname();
  if (categories.length === 0) return null;

  const items = [
    { href: "/", label: "Início" },
    ...categories.map((c) => ({ href: `/c/${c.slug}`, label: c.name })),
  ];

  return (
    <nav aria-label="Categorias" className="border-t border-border/60">
      <ul className="mx-auto no-scrollbar flex max-w-6xl gap-2 overflow-x-auto px-4">
        {items.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="group flex h-12 items-center"
              >
                <span
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground group-hover:bg-accent",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
