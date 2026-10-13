type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const decimal = (text: string) =>
  Number(
    text
      .trim()
      .replace(/^R\$\s*/i, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", "."),
  );

/** "89,90", "R$ 89", "1.250,00" → cents. Empty = "sob consulta" (null). */
export function parsePriceInput(input: string): Parsed<number | null> {
  if (!input.trim()) return { ok: true, value: null };
  const value = decimal(input);
  if (!Number.isFinite(value) || value <= 0)
    return {
      ok: false,
      error:
        "Digite só o valor, por exemplo 89,90. Deixe vazio para “sob consulta”.",
    };
  return { ok: true, value: Math.round(value * 100) };
}

/** 8990 → "89,90" for the input. */
export function formatPriceInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "15,2" (cm) → 152 (mm). Empty = unknown (null). */
export function parseCmInput(input: string): Parsed<number | null> {
  if (!input.trim()) return { ok: true, value: null };
  const value = decimal(input.replace(/\s*cm$/i, ""));
  if (!Number.isFinite(value) || value <= 0 || value > 1000)
    return { ok: false, error: "Digite a medida em cm, por exemplo 15,2." };
  return { ok: true, value: Math.round(value * 10 * 10) / 10 };
}

/** 152 (mm) → "15,2" for the input. */
export function formatCmInput(mm: number | null | undefined): string {
  if (mm == null) return "";
  return (mm / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
