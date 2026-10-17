import { decimal } from "@/lib/admin/product-form";
import { formatPrice } from "@/lib/format";

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const numberFormatter = (maximumFractionDigits: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits, useGrouping: false });

/**
 * A number typed in a calculator field ("70", "2,5", "1.000"). Empty counts
 * as zero, so a field left blank does not block the price.
 */
export function parseNumberInput(
  input: string,
  { max = 1_000_000, error = "Digite só números, por exemplo 2,5." } = {},
): Parsed<number> {
  if (!input.trim()) return { ok: true, value: 0 };
  const value = decimal(input);
  if (!Number.isFinite(value) || value < 0 || value > max)
    return { ok: false, error };
  return { ok: true, value };
}

/** 2.5 → "2,5"; 0 → "" so the placeholder shows. */
export function formatNumberInput(value: number, digits = 2): string {
  if (!value) return "";
  return numberFormatter(digits).format(value);
}

/** Money in reais ("12,90", "R$ 3.200") → cents. Empty counts as zero. */
export function parseMoneyInput(input: string): Parsed<number> {
  const parsed = parseNumberInput(input, {
    max: 10_000_000,
    error: "Digite só o valor, por exemplo 12,90.",
  });
  return parsed.ok
    ? { ok: true, value: Math.round(parsed.value * 100) }
    : parsed;
}

/** Cents → "12,90" for an input; 0 → "0,00". */
export function formatMoneyInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Cents with fractions → "R$ 2,06" (rounded to the cent). */
export function formatMoney(cents: number): string {
  return formatPrice(Math.round(cents));
}
