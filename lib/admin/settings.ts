import { isValidWhatsAppNumber } from "@/lib/whatsapp";

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Accepts the number the way people type it — "(81) 98649-2071",
 * "81986492071", "+55 81 98649-2071" — and returns the stored format
 * (55 + area code + number). Empty means "no WhatsApp".
 */
export function parseWhatsAppInput(input: string): Parsed<string | null> {
  let digits = input.replace(/\D/g, "");
  if (!digits) return { ok: true, value: null };
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!isValidWhatsAppNumber(digits))
    return {
      ok: false,
      error: "Digite o DDD e o número, por exemplo (81) 98649-2071.",
    };
  return { ok: true, value: digits };
}

/** Stored "5581986492071" → "(81) 98649-2071" for the form. */
export function formatWhatsApp(stored: string | null | undefined): string {
  if (!isValidWhatsAppNumber(stored)) return stored ?? "";
  const local = stored.slice(2);
  const ddd = local.slice(0, 2);
  const number = local.slice(2);
  const split = number.length - 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}

const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/i;

/**
 * Accepts "@dan3d", "dan3d" or a profile link and returns the profile URL.
 * Empty means "no Instagram".
 */
export function parseInstagramInput(input: string): Parsed<string | null> {
  const value = input.trim();
  if (!value) return { ok: true, value: null };

  let handle = value.replace(/^@/, "");
  const link = value.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i,
  );
  if (link) handle = link[1];

  if (!INSTAGRAM_HANDLE.test(handle))
    return {
      ok: false,
      error: "Digite o nome do perfil, por exemplo @dan3d, ou cole o link.",
    };
  return { ok: true, value: `https://www.instagram.com/${handle}/` };
}

/** Stored profile URL → "@handle" for the form. */
export function formatInstagram(stored: string | null | undefined): string {
  if (!stored) return "";
  const parsed = parseInstagramInput(stored);
  if (!parsed.ok || !parsed.value) return stored;
  return `@${parsed.value.split("/").at(-2)}`;
}

export const MIN_PASSWORD_LENGTH = 8;
