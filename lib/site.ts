/** Public site settings shared by metadata, sitemap and share links. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://dan3d.jailabs.com.br"
).replace(/\/$/, "");

export const SITE_NAME = "DAN3D";

export const SITE_DESCRIPTION =
  "Peças impressas em 3D, religiosas e infantis. Veja cada peça em tamanho real no seu espaço antes de encomendar.";

export const absoluteUrl = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
