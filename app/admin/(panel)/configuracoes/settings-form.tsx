"use client";

import { ExternalLinkIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Field,
  StickyActions,
  TextArea,
  TextInput,
  primaryButtonClassName,
} from "@/components/admin/form";
import {
  formatInstagram,
  formatWhatsApp,
  parseInstagramInput,
  parseWhatsAppInput,
} from "@/lib/admin/settings";
import { createClient } from "@/lib/supabase/client";
import { whatsappLink } from "@/lib/whatsapp";

export interface SettingsValues {
  store_name: string;
  whatsapp_number: string | null;
  instagram_url: string | null;
  about_text: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [storeName, setStoreName] = useState(initial.store_name);
  const [whatsapp, setWhatsapp] = useState(
    formatWhatsApp(initial.whatsapp_number),
  );
  const [instagram, setInstagram] = useState(
    formatInstagram(initial.instagram_url),
  );
  const [about, setAbout] = useState(initial.about_text ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const parsedWhatsapp = parseWhatsAppInput(whatsapp);
  const parsedInstagram = parseInstagramInput(instagram);
  const nameError = storeName.trim() ? null : "Digite o nome da loja.";
  const whatsappError = parsedWhatsapp.ok ? null : parsedWhatsapp.error;
  const instagramError = parsedInstagram.ok ? null : parsedInstagram.error;

  const testLink =
    parsedWhatsapp.ok && parsedWhatsapp.value
      ? whatsappLink(
          parsedWhatsapp.value,
          "Teste do site: o botão do WhatsApp está funcionando.",
        )
      : null;

  function edited() {
    if (status.kind !== "saving") setStatus({ kind: "idle" });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameError || !parsedWhatsapp.ok || !parsedInstagram.ok) {
      setShowErrors(true);
      setStatus({
        kind: "error",
        message: "Confira os campos marcados em vermelho.",
      });
      return;
    }

    setStatus({ kind: "saving" });
    const { data, error } = await createClient()
      .from("settings")
      .update({
        store_name: storeName.trim(),
        whatsapp_number: parsedWhatsapp.value,
        instagram_url: parsedInstagram.value,
        about_text: about.trim() || null,
      })
      .eq("id", 1)
      .select("id");
    // RLS blocks silently: no row back means nothing was saved.
    if (error || !data?.length) {
      setStatus({
        kind: "error",
        message:
          "Não foi possível salvar. Confira a internet e tente de novo. Se continuar, saia e entre de novo no painel.",
      });
      return;
    }
    setShowErrors(false);
    setStatus({ kind: "saved" });
    // Reload the server data so the page matches what is saved.
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Field
        label="Nome da loja"
        htmlFor="store_name"
        error={showErrors ? nameError : null}
      >
        <TextInput
          id="store_name"
          value={storeName}
          onChange={(event) => {
            setStoreName(event.target.value);
            edited();
          }}
          autoComplete="organization"
          aria-invalid={showErrors && !!nameError}
        />
      </Field>

      <Field
        label="WhatsApp para encomendas"
        htmlFor="whatsapp"
        hint="Com DDD. É para esse número que vão as mensagens do botão “Encomendar pelo WhatsApp”."
        error={showErrors ? whatsappError : null}
      >
        <div className="flex gap-2">
          <TextInput
            id="whatsapp"
            value={whatsapp}
            onChange={(event) => {
              setWhatsapp(event.target.value);
              edited();
            }}
            onBlur={() => {
              if (parsedWhatsapp.ok)
                setWhatsapp(formatWhatsApp(parsedWhatsapp.value));
            }}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(81) 98649-2071"
            aria-invalid={showErrors && !!whatsappError}
            aria-describedby={
              showErrors && whatsappError ? "whatsapp-error" : undefined
            }
          />
          <a
            href={testLink ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!testLink}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-input bg-card px-4 text-base font-medium hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            Testar
            <ExternalLinkIcon className="size-4" />
          </a>
        </div>
      </Field>

      <Field
        label="Instagram"
        htmlFor="instagram"
        hint="O nome do perfil (por exemplo @dan3d) ou o link. Deixe vazio se não quiser mostrar."
        error={showErrors ? instagramError : null}
      >
        <TextInput
          id="instagram"
          value={instagram}
          onChange={(event) => {
            setInstagram(event.target.value);
            edited();
          }}
          onBlur={() => {
            if (parsedInstagram.ok)
              setInstagram(formatInstagram(parsedInstagram.value));
          }}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="@dan3d"
          aria-invalid={showErrors && !!instagramError}
          aria-describedby={
            showErrors && instagramError ? "instagram-error" : undefined
          }
        />
      </Field>

      <Field
        label="Sobre a loja"
        htmlFor="about"
        hint="Um texto curto contando quem faz as peças e como funcionam as encomendas."
      >
        <TextArea
          id="about"
          value={about}
          onChange={(event) => {
            setAbout(event.target.value);
            edited();
          }}
          rows={5}
        />
      </Field>

      <StickyActions>
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`min-w-0 flex-1 text-base empty:hidden ${status.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {status.kind === "saved" && "Alterações salvas."}
          {status.kind === "error" && status.message}
        </p>
        <button
          type="submit"
          disabled={status.kind === "saving"}
          className={`${primaryButtonClassName} sm:w-auto sm:min-w-48`}
        >
          {status.kind === "saving" && (
            <LoaderCircleIcon className="size-5 animate-spin" />
          )}
          {status.kind === "saving"
            ? "Salvando…"
            : status.kind === "saved"
              ? "Salvo ✓"
              : "Salvar"}
        </button>
      </StickyActions>
    </form>
  );
}
