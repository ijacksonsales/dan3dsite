import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ConverterTester } from "./converter-tester";

export const metadata: Metadata = {
  title: "Teste do conversor 3D · DAN3D",
  robots: { index: false, follow: false },
};

/** Phase 1 test page: development only, or a logged-in admin (PLAN.md §5). */
export default async function ConverterPage() {
  if (process.env.NODE_ENV !== "development") {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) notFound();
  }
  return <ConverterTester />;
}
