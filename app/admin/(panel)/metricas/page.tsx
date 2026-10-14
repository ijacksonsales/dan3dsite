import {
  EyeIcon,
  MessageCircleIcon,
  ScanIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { ProductThumb } from "@/components/admin/product-thumb";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Números da loja" };

const DAYS = 30;
const TOP = 20;

const number = new Intl.NumberFormat("pt-BR");

/** Start of the reporting window, as the ISO timestamp the RPC expects. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function MetricsPage() {
  const supabase = await createClient();
  const [{ data: summary, error }, { data: products }] = await Promise.all([
    supabase.rpc("event_summary", { since: daysAgo(DAYS) }),
    supabase
      .from("products")
      .select("id, name, product_images(path, sort_order)")
      .order("sort_order", { referencedTable: "product_images" })
      .limit(1, { referencedTable: "product_images" }),
  ]);
  if (error) throw error;

  const byId = new Map(
    (products ?? []).map((product) => [product.id, product]),
  );
  const rows = summary
    .flatMap((row) => {
      const product = row.product_id ? byId.get(row.product_id) : undefined;
      return product
        ? [
            {
              ...row,
              id: product.id,
              name: product.name,
              coverPath: product.product_images[0]?.path ?? null,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.product_views - a.product_views ||
        b.whatsapp_clicks - a.whatsapp_clicks ||
        b.ar_opens - a.ar_opens,
    );
  const totals = summary.reduce(
    (sum, row) => ({
      views: sum.views + row.product_views,
      ar: sum.ar + row.ar_opens,
      whatsapp: sum.whatsapp + row.whatsapp_clicks,
    }),
    { views: 0, ar: 0, whatsapp: 0 },
  );

  return (
    <>
      <PageHeader title="Números da loja">
        <p className="text-base text-muted-foreground">
          Últimos {DAYS} dias, contando as páginas das peças.
        </p>
      </PageHeader>

      <dl className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={EyeIcon}
          label="Visitas às peças"
          value={totals.views}
        />
        <StatTile
          icon={ScanIcon}
          label="Vezes que viram no espaço (AR)"
          value={totals.ar}
        />
        <StatTile
          icon={MessageCircleIcon}
          label="Cliques em “Encomendar pelo WhatsApp”"
          value={totals.whatsapp}
        />
      </dl>

      <section aria-labelledby="top-title" className="mt-10 space-y-4">
        <h2 id="top-title" className="font-heading text-xl font-medium">
          Peças mais vistas
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
            Ainda não há visitas registradas neste período.
          </p>
        ) : (
          <table className="w-full border-separate border-spacing-y-2 text-base">
            <caption className="sr-only">
              Visitas, aberturas do AR e cliques no WhatsApp por peça, nos
              últimos {DAYS} dias
            </caption>
            <thead className="text-sm text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 text-left font-normal">
                  Peça
                </th>
                <th
                  scope="col"
                  className="w-16 px-2 text-right font-normal sm:w-24"
                >
                  Visitas
                </th>
                <th
                  scope="col"
                  className="w-12 px-2 text-right font-normal sm:w-24"
                >
                  AR
                </th>
                <th
                  scope="col"
                  className="w-16 px-2 text-right font-normal sm:w-24"
                >
                  WhatsApp
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, TOP).map((row) => (
                <tr key={row.id} className="bg-card">
                  <th
                    scope="row"
                    className="rounded-l-2xl border-y border-l border-border p-2 text-left font-normal"
                  >
                    <Link
                      href={`/admin/produtos/${row.id}`}
                      className="flex min-h-12 items-center gap-3 rounded-xl hover:underline"
                    >
                      <ProductThumb
                        path={row.coverPath}
                        size={48}
                        className="max-sm:hidden"
                      />
                      <span className="line-clamp-2 font-medium">
                        {row.name}
                      </span>
                    </Link>
                  </th>
                  <Count value={row.product_views} />
                  <Count value={row.ar_opens} />
                  <Count value={row.whatsapp_clicks} last />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <dt className="flex items-center gap-2 text-base text-muted-foreground">
        <Icon className="size-5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="font-heading text-4xl font-medium tabular-nums">
        {number.format(value)}
      </dd>
    </div>
  );
}

function Count({ value, last }: { value: number; last?: boolean }) {
  return (
    <td
      className={`border-y border-border px-2 text-right tabular-nums ${
        last ? "rounded-r-2xl border-r" : ""
      } ${value === 0 ? "text-muted-foreground" : ""}`}
    >
      {number.format(value)}
    </td>
  );
}
