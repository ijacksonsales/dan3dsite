import type { Metadata } from "next";

import { NotFoundContent } from "@/components/store/not-found-content";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";

export const metadata: Metadata = { title: "Página não encontrada" };

/** Any address that matches no route: shown with the store around it. */
export default function NotFound() {
  return (
    <>
      <StoreHeader />
      <main className="flex-1">
        <NotFoundContent />
      </main>
      <StoreFooter />
    </>
  );
}
