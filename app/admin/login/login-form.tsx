"use client";

import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Alert,
  Field,
  TextInput,
  primaryButtonClassName,
} from "@/components/admin/form";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  next,
  noAccess,
}: {
  next: string;
  noAccess: boolean;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    noAccess
      ? "Esta conta não tem acesso ao painel. Entre com a conta da loja."
      : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Preencha o e-mail e a senha.");
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    // An old session from another account would keep the "no access" loop.
    if (noAccess) await supabase.auth.signOut();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setPending(false);
      setError(loginErrorMessage(signInError));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="E-mail" htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>

      <Field label="Senha" htmlFor="password">
        <div className="relative">
          <TextInput
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-14"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Esconder a senha" : "Mostrar a senha"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOffIcon className="size-5" />
            ) : (
              <EyeIcon className="size-5" />
            )}
          </button>
        </div>
      </Field>

      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClassName}
      >
        {pending && <LoaderCircleIcon className="size-5 animate-spin" />}
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

function loginErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "invalid_credentials")
    return "E-mail ou senha incorretos. Confira e tente de novo.";
  if (error.code === "over_request_rate_limit")
    return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  if (/fetch|network/i.test(error.message))
    return "Sem conexão com a internet. Confira o Wi-Fi e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo em instantes.";
}
