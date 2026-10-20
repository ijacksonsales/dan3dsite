import type { QuoteRequestStatus } from "@/types/database";

export const QUOTE_STATUS_LABEL: Record<QuoteRequestStatus, string> = {
  new: "Novo",
  answered: "Respondido",
  archived: "Arquivado",
};

export type QuoteTab = "novos" | "respondidos" | "arquivados";

export const QUOTE_TABS: {
  tab: QuoteTab;
  label: string;
  status: QuoteRequestStatus;
}[] = [
  { tab: "novos", label: "Novos", status: "new" },
  { tab: "respondidos", label: "Respondidos", status: "answered" },
  { tab: "arquivados", label: "Arquivados", status: "archived" },
];

export function parseQuoteTab(value: unknown): QuoteTab {
  return QUOTE_TABS.some(({ tab }) => tab === value)
    ? (value as QuoteTab)
    : "novos";
}

/** Photos of archived requests are deleted after this many days. */
export const PHOTO_RETENTION_DAYS = 30;

/** Storage path in the private `quotes` bucket (see the migration). */
export const quotePhotoPath = (requestId: string, index: number) =>
  `${requestId}/${index}.webp`;
