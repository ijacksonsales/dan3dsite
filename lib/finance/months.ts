import type { ExpenseCategory } from "@/types/database";

// Months as "YYYY-MM" (the `?mes=` parameter of the finance page).

const MONTH = /^(\d{4})-(\d{2})$/;

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const SHORT_NAMES = MONTH_NAMES.map((name) => name.slice(0, 3));

/** "2026-10" from `?mes=`, or the month of `today` ("YYYY-MM-DD"). */
export function parseMonth(value: unknown, today: string): string {
  if (typeof value === "string") {
    const match = value.match(MONTH);
    if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return value;
  }
  return today.slice(0, 7);
}

/** "2026-10" + 1 → "2026-11"; "2026-01" − 1 → "2025-12". */
export function shiftMonth(month: string, delta: number): string {
  const [, y, m] = month.match(MONTH)!;
  const index = Number(y) * 12 + Number(m) - 1 + delta;
  const year = Math.floor(index / 12);
  return `${year}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** "2026-10" → "2026-10-01". */
export function firstDay(month: string): string {
  return `${month}-01`;
}

/** "2026-02" → "2026-02-28". */
export function lastDay(month: string): string {
  const [, y, m] = month.match(MONTH)!;
  const day = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** "2026-10" → "outubro de 2026". */
export function monthLabel(month: string): string {
  const [, y, m] = month.match(MONTH)!;
  return `${MONTH_NAMES[Number(m) - 1]} de ${y}`;
}

/** "2026-10" → "Outubro de 2026" (for titles and the start of a sentence). */
export function monthTitle(month: string): string {
  const label = monthLabel(month);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "2026-10" → "out". */
export function shortMonthLabel(month: string): string {
  return SHORT_NAMES[Number(month.slice(5, 7)) - 1];
}

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  filament: "Filamento",
  materials: "Materiais",
  packaging: "Embalagem",
  energy: "Energia",
  machine: "Máquina e manutenção",
  other: "Outros",
};
