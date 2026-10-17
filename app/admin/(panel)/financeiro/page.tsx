import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ReceiptTextIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { StickyActions, primaryButtonClassName } from "@/components/admin/form";
import { PageHeader } from "@/components/admin/page-header";
import { storeToday } from "@/lib/dates";
import {
  firstDay,
  lastDay,
  monthLabel,
  monthTitle,
  parseMonth,
  shiftMonth,
  shortMonthLabel,
} from "@/lib/finance/months";
import { formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { MonthChart } from "./month-chart";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinancePage({
  searchParams,
}: PageProps<"/admin/financeiro">) {
  const { mes } = await searchParams;
  const today = storeToday();
  const month = parseMonth(mes, today);
  const isCurrent = month === today.slice(0, 7);
  const chartStart = shiftMonth(month, -5);

  const supabase = await createClient();
  const [months, open, top] = await Promise.all([
    supabase.rpc("finance_months", {
      p_from: firstDay(chartStart),
      p_to: firstDay(month),
    }),
    supabase.rpc("finance_open", { p_today: today }),
    supabase.rpc("finance_top_items", {
      p_from: firstDay(month),
      p_to: lastDay(month),
    }),
  ]);
  if (months.error) throw months.error;
  if (open.error) throw open.error;
  if (top.error) throw top.error;

  const series = months.data.map((row) => ({
    month: row.month.slice(0, 7),
    label: shortMonthLabel(row.month.slice(0, 7)),
    longLabel: monthTitle(row.month.slice(0, 7)),
    received: row.received_cents,
    paid: row.expenses_paid_cents,
  }));
  const current = months.data.at(-1)!;
  const result = current.received_cents - current.expenses_paid_cents;
  const margin = current.delivered_revenue_cents - current.delivered_cost_cents;
  const pending = open.data[0];

  return (
    <>
      <PageHeader title="Financeiro" />

      <nav
        aria-label="Mês"
        className="mb-6 flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-1"
      >
        <Link
          href={`/admin/financeiro?mes=${shiftMonth(month, -1)}`}
          aria-label="Mês anterior"
          className="grid size-12 place-items-center rounded-full hover:bg-muted"
        >
          <ChevronLeftIcon className="size-6" />
        </Link>
        <span className="text-lg font-medium">{monthTitle(month)}</span>
        {isCurrent ? (
          <span className="size-12" aria-hidden />
        ) : (
          <Link
            href={`/admin/financeiro?mes=${shiftMonth(month, 1)}`}
            aria-label="Próximo mês"
            className="grid size-12 place-items-center rounded-full hover:bg-muted"
          >
            <ChevronRightIcon className="size-6" />
          </Link>
        )}
      </nav>

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-medium">Caixa do mês</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Recebido"
              value={formatPrice(current.received_cents)}
              hint="Pagamentos de pedidos"
            />
            <Stat
              label="Contas pagas"
              value={formatPrice(current.expenses_paid_cents)}
              hint="Filamento, materiais, energia…"
            />
            <Stat
              label="Resultado"
              value={formatPrice(result)}
              hint="Recebido − contas pagas"
              tone={result < 0 ? "bad" : "strong"}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-medium">Agora</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <LinkStat
              href="/admin/pedidos"
              label="A receber"
              value={formatPrice(pending.receivable_cents)}
              hint={
                pending.receivable_orders === 0
                  ? "Nenhum pedido com saldo"
                  : pending.receivable_orders === 1
                    ? "De 1 pedido"
                    : `De ${pending.receivable_orders} pedidos`
              }
            />
            <LinkStat
              href="/admin/financeiro/contas"
              label="A pagar"
              value={formatPrice(pending.payable_cents)}
              hint={
                pending.overdue_count > 0
                  ? `${pending.overdue_count === 1 ? "1 conta vencida" : `${pending.overdue_count} contas vencidas`}: ${formatPrice(pending.overdue_cents)}`
                  : pending.payable_count === 0
                    ? "Nenhuma conta em aberto"
                    : pending.payable_count === 1
                      ? "1 conta em aberto"
                      : `${pending.payable_count} contas em aberto`
              }
              tone={pending.overdue_count > 0 ? "warn" : undefined}
            />
          </div>
        </section>

        <MonthChart months={series} />

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-medium">
            Pedidos entregues no mês
          </h2>
          {current.delivered_count === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-base text-muted-foreground">
              Nenhum pedido entregue em {monthLabel(month)}.
            </p>
          ) : (
            <>
              <dl className="divide-y divide-border rounded-2xl border border-border bg-card text-base">
                <Row
                  label="Pedidos entregues"
                  value={String(current.delivered_count)}
                />
                <Row
                  label="Vendido (peças − descontos)"
                  value={formatPrice(current.delivered_revenue_cents)}
                />
                <Row
                  label="Custo estimado"
                  value={formatPrice(current.delivered_cost_cents)}
                />
                <Row
                  label="Margem estimada"
                  value={formatPrice(margin)}
                  strong
                />
              </dl>
              <p className="text-sm text-muted-foreground">
                Estimativa pela calculadora, sem frete.{" "}
                {current.items_without_cost > 0 &&
                  `${current.items_without_cost === 1 ? "1 peça está" : `${current.items_without_cost} peças estão`} sem custo calculado, então a margem real é menor. `}
                O “Resultado” acima é o dinheiro que entrou e saiu de fato.
              </p>
            </>
          )}
        </section>

        {top.data.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-heading text-xl font-medium">
              Mais vendidas no mês
            </h2>
            <ol className="divide-y divide-border rounded-2xl border border-border bg-card text-base">
              {top.data.map((item, index) => (
                <li
                  key={item.description}
                  className="flex items-baseline gap-3 px-4 py-3"
                >
                  <span className="w-5 shrink-0 text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.description}
                    <span className="block text-sm text-muted-foreground">
                      {item.quantity === 1
                        ? "1 unidade"
                        : `${item.quantity} unidades`}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatPrice(item.revenue_cents)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <StickyActions>
        <Link
          href="/admin/financeiro/contas"
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <ReceiptTextIcon className="size-5" />
          Contas a pagar
        </Link>
      </StickyActions>
    </>
  );
}

/** strong: highlighted card · bad: negative value · warn: only the hint is red. */
type Tone = "strong" | "bad" | "warn";

function StatBody({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  return (
    <>
      <span className="block text-base text-muted-foreground">{label}</span>
      <span
        className={cn(
          "block font-heading text-2xl font-medium tabular-nums",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "block text-sm",
          tone === "bad" || tone === "warn"
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {hint}
      </span>
    </>
  );
}

function Stat(props: {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4",
        props.tone === "strong" ? "border-primary" : "border-border",
      )}
    >
      <StatBody {...props} />
    </div>
  );
}

function LinkStat({
  href,
  ...props
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border bg-card p-4 hover:bg-muted"
    >
      <StatBody {...props} />
    </Link>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 px-4 py-3",
        strong && "font-medium",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
