"use client";

import { useState } from "react";

import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChartMonth {
  month: string;
  label: string;
  /** "Outubro de 2026", for the details and the table. */
  longLabel: string;
  received: number;
  paid: number;
}

// Categorical slots 1 and 2 of the dataviz reference palette, validated on
// the panel's card surface in light (#fffdf9) and dark (#171717) mode.
const RECEIVED = "bg-[#2a78d6] dark:bg-[#3987e5]";
const PAID = "bg-[#eb6834] dark:bg-[#d95926]";

/**
 * Money received vs bills paid, one pair of bars per month. Tapping a month
 * shows its numbers (touch-first: no hover on a tablet); a table view sits
 * below for exact values.
 */
export function MonthChart({ months }: { months: ChartMonth[] }) {
  const [selected, setSelected] = useState(months.length - 1);
  const max = Math.max(1, ...months.flatMap((m) => [m.received, m.paid]));
  const current = months[selected];

  return (
    <figure className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Últimos 6 meses</span>
        <LegendItem className={RECEIVED} label="Recebido" />
        <LegendItem className={PAID} label="Contas pagas" />
      </figcaption>

      <div
        className="flex h-40 items-end gap-1 border-b border-border"
        role="group"
        aria-label="Recebido e contas pagas por mês. Toque num mês para ver os valores."
      >
        {months.map((m, index) => (
          <button
            key={m.month}
            type="button"
            onClick={() => setSelected(index)}
            aria-pressed={index === selected}
            aria-label={`${m.longLabel}: recebido ${formatPrice(m.received)}, contas pagas ${formatPrice(m.paid)}`}
            className={cn(
              "flex h-full flex-1 items-end justify-center gap-0.5 rounded-t-md px-1 transition-colors",
              index === selected ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <Bar className={RECEIVED} value={m.received} max={max} />
            <Bar className={PAID} value={m.paid} max={max} />
          </button>
        ))}
      </div>
      <div className="flex gap-1" aria-hidden>
        {months.map((m, index) => (
          <span
            key={m.month}
            className={cn(
              "flex-1 text-center text-sm",
              index === selected
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {m.label}
          </span>
        ))}
      </div>

      {current && (
        <p className="text-base" aria-live="polite">
          <span className="font-medium">{current.longLabel}</span>: recebido{" "}
          {formatPrice(current.received)} · contas pagas{" "}
          {formatPrice(current.paid)} · resultado{" "}
          <span
            className={cn(
              "font-medium",
              current.received - current.paid < 0 && "text-destructive",
            )}
          >
            {formatPrice(current.received - current.paid)}
          </span>
        </p>
      )}

      <details>
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-medium text-primary">
          Ver em tabela
        </summary>
        <table className="w-full text-base">
          <thead>
            <tr className="text-left text-sm text-muted-foreground">
              <th className="py-2 font-normal">Mês</th>
              <th className="py-2 text-right font-normal">Recebido</th>
              <th className="py-2 text-right font-normal">Pago</th>
              <th className="py-2 text-right font-normal">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {months.map((m) => (
              <tr key={m.month}>
                <td className="py-2">{m.longLabel}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatPrice(m.received)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatPrice(m.paid)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatPrice(m.received - m.paid)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Bar({
  className,
  value,
  max,
}: {
  className: string;
  value: number;
  max: number;
}) {
  // Zero stays visible as a hairline so an empty month still reads as data.
  const height = value > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <span
      className={cn("w-full max-w-6 rounded-t-[4px]", className)}
      style={{
        height: `${height}%`,
        minHeight: value > 0 ? 2 : 1,
        opacity: value > 0 ? 1 : 0.35,
      }}
    />
  );
}

function LegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-3 rounded-[3px]", className)} aria-hidden />
      {label}
    </span>
  );
}
