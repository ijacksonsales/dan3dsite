"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ADMIN_LOGIN } from "@/lib/admin/paths";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await createClient().auth.signOut();
    router.replace(ADMIN_LOGIN);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="flex min-h-12 items-center gap-2 rounded-full px-4 text-base hover:bg-secondary disabled:opacity-60"
    >
      <LogOutIcon className="size-5" />
      Sair
    </button>
  );
}
