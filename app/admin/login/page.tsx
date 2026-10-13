import type { Metadata } from "next";

import { BrandLogo } from "@/components/store/brand-logo";
import { safeAdminPath } from "@/lib/admin/paths";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  const { next, erro } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo priority />
          <h1 className="font-heading text-2xl font-medium">Painel da loja</h1>
        </div>
        <LoginForm
          next={safeAdminPath(typeof next === "string" ? next : null)}
          noAccess={erro === "sem-acesso"}
        />
      </div>
    </main>
  );
}
