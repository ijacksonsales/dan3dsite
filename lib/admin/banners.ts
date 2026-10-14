export interface BannerWindow {
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export type BannerState = "live" | "off" | "scheduled" | "ended";

/** Mirrors the public RLS rule: active and inside its display window. */
export function bannerState(
  banner: BannerWindow,
  now = new Date(),
): BannerState {
  if (!banner.active) return "off";
  if (banner.starts_at && new Date(banner.starts_at) > now) return "scheduled";
  if (banner.ends_at && new Date(banner.ends_at) <= now) return "ended";
  return "live";
}

// Dates are whole days in the store's time zone (Brasília). Fixed, not the
// device's: part of the admin renders on the server, which runs in UTC.
// Brazil has had no daylight saving time since 2019.
const STORE_TIME_ZONE = "America/Sao_Paulo";
const STORE_UTC_OFFSET = "-03:00";

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: STORE_TIME_ZONE,
});

// "YYYY-MM-DD" (the en-CA format) in the store's time zone.
const isoDay = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: STORE_TIME_ZONE,
});

export function bannerStateLabel(banner: BannerWindow, now = new Date()) {
  switch (bannerState(banner, now)) {
    case "off":
      return "Desligado";
    case "scheduled":
      return `Agendado: entra em ${shortDate.format(new Date(banner.starts_at!))}`;
    case "ended":
      return `Encerrado em ${shortDate.format(lastDay(banner.ends_at!))}`;
    case "live":
      return banner.ends_at
        ? `No ar até ${shortDate.format(lastDay(banner.ends_at))}`
        : "No ar";
  }
}

// The banner enters at the start of the first day and leaves at the end of
// the last one (`ends_at` is exclusive: the next midnight).

const DAY_MS = 24 * 60 * 60 * 1000;
const lastDay = (endsAt: string) => new Date(new Date(endsAt).getTime() - 1);
const toDateInput = (date: Date) => isoDay.format(date);

function fromDateInput(value: string, dayOffset = 0): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const start = new Date(`${value}T00:00:00${STORE_UTC_OFFSET}`);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + dayOffset * DAY_MS);
}

/** "2026-12-01" → start of that day (ISO). Empty → null (no start). */
export function startsAtFromInput(value: string): string | null {
  return fromDateInput(value)?.toISOString() ?? null;
}

/** "2026-12-31" → end of that day, i.e. the next midnight (ISO). */
export function endsAtFromInput(value: string): string | null {
  return fromDateInput(value, 1)?.toISOString() ?? null;
}

export function startsAtToInput(iso: string | null): string {
  return iso ? toDateInput(new Date(iso)) : "";
}

export function endsAtToInput(iso: string | null): string {
  return iso ? toDateInput(lastDay(iso)) : "";
}

export type BannerLink =
  | { kind: "none" }
  | { kind: "product"; slug: string }
  | { kind: "category"; slug: string }
  | { kind: "url"; url: string };

/** `link_url` → what the form shows. */
export function parseBannerLink(linkUrl: string | null): BannerLink {
  if (!linkUrl) return { kind: "none" };
  const internal = linkUrl.match(/^\/(p|c)\/([^/?#]+)$/);
  if (internal)
    return internal[1] === "p"
      ? { kind: "product", slug: internal[2] }
      : { kind: "category", slug: internal[2] };
  return { kind: "url", url: linkUrl };
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Form choice → `link_url`. External links must be full web addresses. */
export function buildBannerLink(link: BannerLink): Parsed<string | null> {
  switch (link.kind) {
    case "none":
      return { ok: true, value: null };
    case "product":
      return link.slug
        ? { ok: true, value: `/p/${link.slug}` }
        : { ok: false, error: "Escolha a peça." };
    case "category":
      return link.slug
        ? { ok: true, value: `/c/${link.slug}` }
        : { ok: false, error: "Escolha a categoria." };
    case "url": {
      const text = link.url.trim();
      const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      try {
        const url = new URL(withScheme);
        if (!url.hostname.includes(".")) throw new Error("no host");
        return { ok: true, value: url.toString() };
      } catch {
        return {
          ok: false,
          error:
            "Cole o endereço completo, por exemplo https://instagram.com/…",
        };
      }
    }
  }
}
