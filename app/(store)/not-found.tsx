import type { Metadata } from "next";

import { NotFoundContent } from "@/components/store/not-found-content";

export const metadata: Metadata = { title: "Página não encontrada" };

/** notFound() in store pages (unknown product or category). */
export default function StoreNotFound() {
  return <NotFoundContent />;
}
