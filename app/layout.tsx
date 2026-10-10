import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Jost } from "next/font/google";
import { preconnect } from "react-dom";

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Only used by the dev/admin screens: don't preload it on store pages.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

// Geometric, wide letterforms close to the DAN3D wordmark; used for headings.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · Peças impressas em 3D`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    images: [{ url: "/brand/og-default.jpg", width: 1200, height: 630 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#faf6f0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Photos, banners and 3D models come from Supabase: open the connections
  // early, in parallel with the HTML. Images load without CORS; the model and
  // the metrics use CORS, which needs its own connection.
  const { url: supabaseUrl } = getSupabasePublicEnv();
  preconnect(supabaseUrl);
  preconnect(supabaseUrl, { crossOrigin: "anonymous" });

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
