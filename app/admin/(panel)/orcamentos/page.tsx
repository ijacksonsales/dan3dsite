import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { formatDay, formatShortDay, storeToday } from "@/lib/dates";
import { parseQuoteItems } from "@/lib/quotes/form";
import { QUOTE_TABS, parseQuoteTab } from "@/lib/quotes/status";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orçamentos do site" };

/** Answered and archived tabs show the most recent ones only. */
const LIMIT = 100;

const createdDay = (timestamp: string) => storeToday(new Date(timestamp));

export default async function QuoteRequestsPage({
  searchParams,
}: PageProps<"/admin/orcamentos">) {
  const { aba } = await searchParams;
  const tab = parseQuoteTab(aba);
  const { status } = QUOTE_TABS.find((item) => item.tab === tab)!;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .select("id, number, name, city, items, needed_by, created_at, order_id")
    .eq("status", status)
    .order("created_at", { ascending: status === "new" })
    .limit(LIMIT);
  if (error) throw error;
  const today = storeToday();

  return (
    <>
      <PageHeader title="Orçamentos do site">
        <p className="text-base text-muted-foreground">
          Pedidos que os clientes mandam pela página “Orçamento personalizado”
          da loja.
        </p>
      </PageHeader>

      <nav
        aria-label="Situação dos orçamentos"
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {QUOTE_TABS.map((item) => (
          <Link
            key={item.tab}
            href={
              item.tab === "novos"
                ? "/admin/orcamentos"
                : `/admin/orcamentos?aba=${item.tab}`
            }
            aria-current={item.tab === tab ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 shrink-0 items-center rounded-full border px-5 text-base font-medium",
              item.tab === tab
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          {tab === "novos"
            ? "Nenhum pedido de orçamento novo. Quando um cliente mandar pelo site, ele aparece aqui."
            : tab === "respondidos"
              ? "Nenhum orçamento respondido."
              : "Nenhum orçamento arquivado."}
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((request) => {
            const items = parseQuoteItems(request.items);
            const pieces = items.reduce((sum, item) => sum + item.quantity, 0);
            const day = createdDay(request.created_at);
            return (
              <li key={request.id}>
                <Link
                  href={`/admin/orcamentos/${request.id}`}
                  className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-lg font-medium">
                      Nº {request.number} · {request.name}
                    </span>
                    <span className="block truncate text-base">
                      {items[0]?.description ?? "—"}
                    </span>
                    <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                      <span>
                        {day === today ? "Hoje" : formatShortDay(day)}
                      </span>
                      <span>{pieces === 1 ? "1 peça" : `${pieces} peças`}</span>
                      {request.city && <span>{request.city}</span>}
                      {request.needed_by && (
                        <span>Para {formatDay(request.needed_by)}</span>
                      )}
                      {request.order_id && (
                        <span className="font-medium text-primary">
                          Virou pedido
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {data.length === LIMIT && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Mostrando os {LIMIT} mais recentes.
        </p>
      )}
    </>
  );
}
