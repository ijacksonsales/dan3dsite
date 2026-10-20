import {
  CalculatorIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  ImagesIcon,
  InboxIcon,
  PenToolIcon,
  PackageIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  TagsIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { addDays, storeToday } from "@/lib/dates";
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

const STORE_SHORTCUTS: Shortcut[] = [
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
    href: "/admin/metricas",
    label: "Números da loja",
    description: "Visitas, AR e WhatsApp (30 dias)",
    icon: ChartColumnIcon,
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

const BUSINESS_SHORTCUTS: Shortcut[] = [
  {
    href: "/admin/orcamentos",
    label: "Orçamentos do site",
    description: "Pedidos que os clientes mandam pela loja",
    icon: InboxIcon,
    ready: true,
  },
  {
    href: "/admin/pedidos",
    label: "Pedidos",
    description: "Orçamentos, produção e pagamentos",
    icon: ClipboardListIcon,
    ready: true,
  },
  {
    href: "/admin/clientes",
    label: "Clientes",
    description: "Contatos e histórico",
    icon: UsersIcon,
    ready: true,
  },
  {
    href: "/admin/financeiro",
    label: "Financeiro",
    description: "Recebido, contas e lucro do mês",
    icon: WalletIcon,
    ready: true,
  },
  {
    href: "/admin/calculadora",
    label: "Calculadora de preço",
    description: "Custo, lucro e preço sugerido",
    icon: CalculatorIcon,
    ready: true,
  },
];

const TOOL_SHORTCUTS: Shortcut[] = [
  {
    href: "/admin/ferramentas/svg",
    label: "Imagem para SVG",
    description: "Logo ou desenho para o Bambu Studio",
    icon: PenToolIcon,
    ready: true,
  },
];

const GROUPS: { title: string; shortcuts: Shortcut[] }[] = [
  { title: "Loja", shortcuts: STORE_SHORTCUTS },
  { title: "Gestão", shortcuts: BUSINESS_SHORTCUTS },
  { title: "Ferramentas", shortcuts: TOOL_SHORTCUTS },
];

export default async function AdminHomePage() {
  const supabase = await createClient();
  const [{ count: drafts }, { count: dueSoon }, { count: newQuotes }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
      // Orders being made that are late or due within 3 days.
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["confirmed", "in_production", "ready"])
        .lte("due_date", addDays(storeToday(), 3)),
      supabase
        .from("quote_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
    ]);

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

      {newQuotes ? (
        <Link
          href="/admin/orcamentos"
          className="flex min-h-12 items-center rounded-xl bg-sky-100 px-4 py-3 text-base text-sky-950 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-100"
        >
          <span>
            <strong>{newQuotes}</strong>{" "}
            {newQuotes === 1
              ? "pedido de orçamento novo do site"
              : "pedidos de orçamento novos do site"}
            . Ver →
          </span>
        </Link>
      ) : null}

      {dueSoon ? (
        <Link
          href="/admin/pedidos"
          className="flex min-h-12 items-center rounded-xl bg-amber-100 px-4 py-3 text-base text-amber-950 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-100"
        >
          <span>
            <strong>{dueSoon}</strong>{" "}
            {dueSoon === 1
              ? "pedido atrasado ou com entrega nos próximos 3 dias"
              : "pedidos atrasados ou com entrega nos próximos 3 dias"}
            . Ver pedidos →
          </span>
        </Link>
      ) : null}

      {drafts ? (
        <p className="rounded-xl bg-secondary px-4 py-3 text-base">
          Você tem <strong>{drafts}</strong>{" "}
          {drafts === 1
            ? "rascunho ainda não publicado"
            : "rascunhos ainda não publicados"}
          .
        </p>
      ) : null}

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="font-heading text-xl font-medium">{group.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.shortcuts.map((shortcut) => (
              <li key={shortcut.href}>
                <ShortcutCard shortcut={shortcut} />
              </li>
            ))}
          </ul>
        </section>
      ))}
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
