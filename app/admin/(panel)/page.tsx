import {
  ImagesIcon,
  PackageIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  TagsIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

interface Shortcut {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Screens not built yet show as "Em breve" instead of a broken link. */
  ready: boolean;
}

const SHORTCUTS: Shortcut[] = [
  {
    href: "/admin/produtos",
    label: "Produtos",
    description: "Ver, editar, publicar",
    icon: PackageIcon,
    ready: true,
  },
  {
    href: "/admin/destaques",
    label: "Destaques",
    description: "Peças da página inicial",
    icon: StarIcon,
    ready: true,
  },
  {
    href: "/admin/banners",
    label: "Banners",
    description: "Imagens do topo da loja",
    icon: ImagesIcon,
    ready: true,
  },
  {
    href: "/admin/categorias",
    label: "Categorias",
    description: "Nomes e ordem",
    icon: TagsIcon,
    ready: true,
  },
  {
    href: "/admin/configuracoes",
    label: "Configurações",
    description: "WhatsApp, Instagram, sobre",
    icon: SettingsIcon,
    ready: true,
  },
];

export default async function AdminHomePage() {
  const supabase = await createClient();
  const { count: drafts } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-medium">
        Olá! O que vamos fazer?
      </h1>

      <ShortcutCard
        shortcut={{
          href: "/admin/produtos/novo",
          label: "Novo produto",
          description: "Fotos, modelo 3D e preço",
          icon: PlusIcon,
          ready: true,
        }}
        primary
      />

      {drafts ? (
        <p className="rounded-xl bg-secondary px-4 py-3 text-base">
          Você tem <strong>{drafts}</strong>{" "}
          {drafts === 1
            ? "rascunho ainda não publicado"
            : "rascunhos ainda não publicados"}
          .
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.href}>
            <ShortcutCard shortcut={shortcut} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShortcutCard({
  shortcut: { href, label, description, icon: Icon, ready },
  primary,
}: {
  shortcut: Shortcut;
  primary?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          primary ? "bg-primary-foreground/15" : "bg-secondary text-primary",
        )}
      >
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-medium">{label}</span>
        <span
          className={cn(
            "block text-base",
            primary ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {ready ? description : "Em breve"}
        </span>
      </span>
    </>
  );

  const className = cn(
    "flex min-h-20 items-center gap-4 rounded-2xl p-4 transition-colors",
    primary
      ? "bg-primary text-primary-foreground"
      : "border border-border bg-card",
    ready ? (primary ? "hover:bg-espresso" : "hover:bg-muted") : "opacity-60",
  );

  if (!ready) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
