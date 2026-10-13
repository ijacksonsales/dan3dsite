"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Alert, Field, TextInput } from "@/components/admin/form";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin/settings";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function PasswordForm({ email }: { email?: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("new_password") ?? "");
    const confirmation = String(form.get("confirm_password") ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus({
        kind: "error",
        message: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      });
      return;
    }
    if (password !== confirmation) {
      setStatus({
        kind: "error",
        message: "As duas senhas estão diferentes. Digite de novo.",
      });
      return;
    }

    setStatus({ kind: "saving" });
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setStatus({ kind: "error", message: passwordErrorMessage(error) });
      return;
    }
    formElement.reset();
    setStatus({ kind: "saved" });
  }

  return (
    <section
      aria-labelledby="password-title"
      className="mt-10 space-y-6 border-t border-border pt-8"
    >
      <div className="space-y-1">
        <h2 id="password-title" className="font-heading text-xl font-medium">
          Trocar senha
        </h2>
        <p className="text-base text-muted-foreground">
          A senha do seu acesso ao painel. Depois de trocar, o painel continua
          aberto neste aparelho.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* Lets password managers know which account this is for. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={email ?? ""}
          hidden
          readOnly
        />
        <Field
          label="Nova senha"
          htmlFor="new_password"
          hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}
        >
          <TextInput
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            onChange={() => setStatus({ kind: "idle" })}
          />
        </Field>
        <Field label="Repita a nova senha" htmlFor="confirm_password">
          <TextInput
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            onChange={() => setStatus({ kind: "idle" })}
          />
        </Field>

        {status.kind === "error" && <Alert>{status.message}</Alert>}
        {status.kind === "saved" && (
          <Alert tone="info">
            Senha trocada. Use a nova no próximo acesso.
          </Alert>
        )}

        <button
          type="submit"
          disabled={status.kind === "saving"}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted disabled:opacity-60 sm:w-auto"
        >
          {status.kind === "saving" && (
            <LoaderCircleIcon className="size-5 animate-spin" />
          )}
          Trocar senha
        </button>
      </form>
    </section>
  );
}

function passwordErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "same_password")
    return "A nova senha precisa ser diferente da atual.";
  if (error.code === "weak_password")
    return "Essa senha é fácil de adivinhar. Use uma mais longa, misturando letras e números.";
  if (error.code === "reauthentication_needed")
    return "Por segurança, saia e entre de novo no painel antes de trocar a senha.";
  if (/fetch|network/i.test(error.message))
    return "Sem conexão com a internet. Confira o Wi-Fi e tente de novo.";
  return "Não foi possível trocar a senha agora. Tente de novo em instantes.";
}
