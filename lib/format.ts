// Display helpers. Units: database in mm, interface in cm (CLAUDE.md).

const cmFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

const priceFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 152 → "15,2 cm". */
export function formatCm(mm: number | null | undefined): string | null {
  if (mm == null || !Number.isFinite(mm) || mm <= 0) return null;
  return `${cmFormatter.format(mm / 10)} cm`;
}

/** Cents → "R$ 89,00"; null means the price is given on request. */
export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "Sob consulta";
  // Intl uses a non-breaking space after "R$"; keep it, it avoids a bad wrap.
  return priceFormatter.format(cents / 100);
}

export interface Dimensions {
  height_mm: number | null;
  width_mm: number | null;
  depth_mm: number | null;
}

/** Labelled measures in cm, skipping the unknown ones. */
export function dimensionList(
  product: Dimensions,
): { label: string; value: string }[] {
  const entries: [string, number | null][] = [
    ["Altura", product.height_mm],
    ["Largura", product.width_mm],
    ["Profundidade", product.depth_mm],
  ];
  return entries.flatMap(([label, mm]) => {
    const value = formatCm(mm);
    return value ? [{ label, value }] : [];
  });
}

/** "Altura 15 cm · Largura 6 cm · Profundidade 4,5 cm". */
export function formatDimensions(product: Dimensions): string | null {
  const list = dimensionList(product);
  if (list.length === 0) return null;
  return list.map(({ label, value }) => `${label} ${value}`).join(" · ");
}
