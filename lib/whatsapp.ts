import { formatDimensions, type Dimensions } from "@/lib/format";

/** `settings.whatsapp_number` format: 55 + area code + number. */
const WHATSAPP_NUMBER = /^55\d{10,11}$/;

export function isValidWhatsAppNumber(
  value: string | null | undefined,
): value is string {
  return value != null && WHATSAPP_NUMBER.test(value);
}

export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export interface OrderMessageInput extends Dimensions {
  name: string;
  url: string;
}

/** Pre-filled order message: piece name, measures and the page link. */
export function orderMessage(product: OrderMessageInput): string {
  const lines = [
    `Olá! Tenho interesse nesta peça: *${product.name}*`,
    formatDimensions(product),
    product.url,
  ];
  return lines.filter(Boolean).join("\n");
}
