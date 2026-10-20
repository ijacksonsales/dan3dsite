import { parseCmInput, formatCmInput } from "@/lib/admin/product-form";
import { parseWhatsAppInput } from "@/lib/admin/settings";
import { formatDay, isDay } from "@/lib/dates";
import { formatCm } from "@/lib/format";
import type { Json, QuoteRequestItem } from "@/types/database";

// Custom quote requests from /orcamento (PLAN.md §5, phase 11). Limits match
// submit_quote_request() in the migration; the database checks them again.

export const MAX_QUOTE_ITEMS = 10;
export const MAX_QUOTE_PHOTOS = 5;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_QUANTITY = 999;

/** One piece as typed in the form (sizes in cm, as text). */
export interface QuoteDraftItem {
  description: string;
  quantity: number;
  height: string;
  width: string;
}

export interface QuoteFormValues {
  name: string;
  phone: string;
  city: string;
  items: QuoteDraftItem[];
  neededBy: string;
  notes: string;
}

export interface QuoteItemErrors {
  description: string | null;
  height: string | null;
  width: string | null;
}

export interface QuoteFormErrors {
  name: string | null;
  phone: string | null;
  neededBy: string | null;
  notes: string | null;
  items: QuoteItemErrors[];
}

/** What submit_quote_request() receives. */
export interface QuotePayload {
  name: string;
  phone: string;
  city: string | null;
  items: QuoteRequestItem[];
  neededBy: string | null;
  notes: string | null;
}

export function emptyQuoteItem(description = ""): QuoteDraftItem {
  return { description, quantity: 1, height: "", width: "" };
}

export function validateQuoteForm(
  values: QuoteFormValues,
  today: string,
):
  { ok: true; payload: QuotePayload } | { ok: false; errors: QuoteFormErrors } {
  const phone = parseWhatsAppInput(values.phone);
  const items = values.items.map((item) => {
    const height = parseCmInput(item.height);
    const width = parseCmInput(item.width);
    const description = item.description.trim();
    return {
      height,
      width,
      errors: {
        description: !description
          ? "Conte o que é a peça."
          : description.length > MAX_DESCRIPTION_LENGTH
            ? "Texto muito longo. Use as observações para os detalhes."
            : null,
        height: height.ok ? null : height.error,
        width: width.ok ? null : width.error,
      },
    };
  });

  const errors: QuoteFormErrors = {
    name: values.name.trim() ? null : "Digite seu nome.",
    phone: !values.phone.trim()
      ? "Digite seu WhatsApp para a gente responder."
      : phone.ok
        ? null
        : phone.error,
    neededBy: !values.neededBy
      ? null
      : !isDay(values.neededBy)
        ? "Data inválida."
        : values.neededBy < today
          ? "Escolha uma data a partir de hoje."
          : null,
    notes:
      values.notes.length > MAX_NOTES_LENGTH
        ? `Use no máximo ${MAX_NOTES_LENGTH} letras.`
        : null,
    items: items.map(({ errors }) => errors),
  };

  const hasErrors =
    errors.name ||
    errors.phone ||
    errors.neededBy ||
    errors.notes ||
    errors.items.some((item) => item.description || item.height || item.width);
  if (hasErrors || !phone.ok || !phone.value) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      name: values.name.trim().slice(0, 100),
      phone: phone.value,
      city: values.city.trim().slice(0, 100) || null,
      items: values.items.map((item, index) => ({
        description: item.description.trim(),
        quantity: Math.min(
          MAX_QUANTITY,
          Math.max(1, Math.round(item.quantity)),
        ),
        height_mm: items[index].height.ok ? items[index].height.value : null,
        width_mm: items[index].width.ok ? items[index].width.value : null,
      })),
      neededBy: values.neededBy || null,
      notes: values.notes.trim() || null,
    },
  };
}

/** Safe read of `quote_requests.items` (jsonb). */
export function parseQuoteItems(value: Json): QuoteRequestItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const { description, quantity, height_mm, width_mm } = raw;
    if (typeof description !== "string" || !description) return [];
    const size = (mm: unknown) =>
      typeof mm === "number" && Number.isFinite(mm) && mm > 0 ? mm : null;
    return [
      {
        description,
        quantity: typeof quantity === "number" && quantity > 0 ? quantity : 1,
        height_mm: size(height_mm),
        width_mm: size(width_mm),
      },
    ];
  });
}

/** "20 cm de altura × 10 cm de largura", or null when no size was given. */
export function quoteItemSize(item: QuoteRequestItem): string | null {
  const parts = [
    formatCm(item.height_mm) && `${formatCm(item.height_mm)} de altura`,
    formatCm(item.width_mm) && `${formatCm(item.width_mm)} de largura`,
  ].filter(Boolean);
  return parts.length ? parts.join(" × ") : null;
}

/** Order item text: "Anjo da guarda (20 cm de altura)". */
export function quoteItemDescription(item: QuoteRequestItem): string {
  const size = quoteItemSize(item);
  return size ? `${item.description} (${size})` : item.description;
}

/** Sizes back to the form input format, e.g. for tests and edits. */
export const quoteItemToDraft = (item: QuoteRequestItem): QuoteDraftItem => ({
  description: item.description,
  quantity: item.quantity,
  height: formatCmInput(item.height_mm),
  width: formatCmInput(item.width_mm),
});

/**
 * Sent by the visitor to the store right after the form ("Avisar a DAN3D no
 * WhatsApp"), so the owner hears about it at once, without e-mail.
 */
export function quoteNoticeMessage(request: {
  number: number;
  name: string;
  items: QuoteRequestItem[];
}): string {
  return [
    `Olá! Sou ${request.name.trim()} e acabei de mandar o *pedido de orçamento nº ${request.number}* pelo site.`,
    "",
    ...request.items.map(
      (item) => `• ${item.quantity}× ${quoteItemDescription(item)}`,
    ),
  ].join("\n");
}

/** First message from the owner to the customer ("Responder no WhatsApp"). */
export function quoteReplyMessage(request: {
  number: number;
  name: string;
  storeName: string;
}): string {
  const firstName = request.name.trim().split(/\s+/)[0];
  return `Olá, ${firstName}! Aqui é da ${request.storeName}. Recebemos seu pedido de orçamento nº ${request.number} pelo site.`;
}

/** Order notes prefilled from the request ("Criar pedido"). */
export function quoteOrderNotes(request: {
  number: number;
  city: string | null;
  needed_by: string | null;
  notes: string | null;
}): string {
  return [
    `Pedido de orçamento nº ${request.number} do site.`,
    request.city && `Cidade: ${request.city}`,
    request.needed_by && `Precisa para: ${formatDay(request.needed_by)}`,
    request.notes,
  ]
    .filter(Boolean)
    .join("\n");
}
