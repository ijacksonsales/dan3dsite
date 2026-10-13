import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { createClient } from "@/lib/supabase/server";

import { PasswordForm } from "./password-form";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings, error }, { data: auth }] = await Promise.all([
    supabase
      .from("settings")
      .select("store_name, whatsapp_number, instagram_url, about_text")
      .eq("id", 1)
      .maybeSingle(),
    supabase.auth.getClaims(),
  ]);
  if (error) throw error;

  return (
    <>
      <PageHeader title="Configurações" />
      <SettingsForm
        initial={
          settings ?? {
            store_name: "DAN3D",
            whatsapp_number: null,
            instagram_url: null,
            about_text: null,
          }
        }
      />
      <PasswordForm email={auth?.claims.email} />
    </>
  );
}
