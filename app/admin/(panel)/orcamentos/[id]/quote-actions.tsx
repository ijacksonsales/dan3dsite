"use client";

import {
  ArchiveIcon,
  ClipboardListIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Alert,
  StickyActions,
  primaryButtonClassName,
} from "@/components/admin/form";
import { useToast } from "@/components/admin/toast";
import { quoteReplyMessage } from "@/lib/quotes/form";
import {
  removeExpiredQuotePhotos,
  removeQuotePhotos,
} from "@/lib/quotes/photos";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import type { QuoteRequestStatus } from "@/types/database";

const NETWORK_ERROR = "Não deu certo. Confira a internet e tente de novo.";

export function QuoteActions({
  request,
  storeName,
}: {
  request: {
    id: string;
    number: number;
    name: string;
    phone: string;
    status: QuoteRequestStatus;
    order: { id: string; number: number } | null;
  };
  storeName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const reply = whatsappLink(
    request.phone,
    quoteReplyMessage({ ...request, storeName }),
  );

  async function setStatus(status: QuoteRequestStatus, done: string) {
    setPending(status);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("quote_requests")
      .update({
        status,
        archived_at: status === "archived" ? new Date().toISOString() : null,
      })
      .eq("id", request.id);
    setPending(null);
    if (updateError) {
      setError(NETWORK_ERROR);
      return;
    }
    toast(done);
    if (status === "archived") {
      void removeExpiredQuotePhotos(supabase);
      router.push("/admin/orcamentos");
    }
    router.refresh();
  }

  /** Opening WhatsApp counts as answering a new request. */
  function onReply() {
    if (request.status !== "new") return;
    void createClient()
      .from("quote_requests")
      .update({ status: "answered" })
      .eq("id", request.id)
      .then(() => router.refresh());
  }

  /**
   * Uses the customer with the same WhatsApp, or registers one, then opens
   * the new order form with the pieces filled in.
   */
  async function createOrder() {
    setPending("order");
    setError(null);
    const supabase = createClient();
    const { data: found, error: findError } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", request.phone)
      .order("created_at")
      .limit(1);
    let customerId = found?.[0]?.id ?? null;
    if (!findError && !customerId) {
      const { data: created } = await supabase
        .from("customers")
        .insert({ name: request.name, phone: request.phone })
        .select("id");
      customerId = created?.[0]?.id ?? null;
    }
    if (!customerId) {
      setPending(null);
      setError(NETWORK_ERROR);
      return;
    }
    router.push(
      `/admin/pedidos/novo?cliente=${customerId}&orcamento=${request.id}`,
    );
  }

  async function onDelete() {
    setPending("delete");
    setError(null);
    const supabase = createClient();
    if (!(await removeQuotePhotos(supabase, request.id))) {
      setPending(null);
      setError(NETWORK_ERROR);
      return;
    }
    const { error: deleteError } = await supabase
      .from("quote_requests")
      .delete()
      .eq("id", request.id);
    if (deleteError) {
      setPending(null);
      setError(NETWORK_ERROR);
      return;
    }
    toast("Pedido de orçamento excluído.");
    router.push("/admin/orcamentos");
    router.refresh();
  }

  return (
    <>
      <section className="mb-40 space-y-3">
        <h2 className="font-heading text-xl font-medium">Mais opções</h2>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-col gap-2">
          {request.status === "new" && (
            <SecondaryButton
              onClick={() => setStatus("answered", "Marcado como respondido.")}
              pending={pending === "answered"}
            >
              Marcar como respondido
            </SecondaryButton>
          )}
          {request.status !== "new" && (
            <SecondaryButton
              onClick={() => setStatus("new", "Voltou para “Novos”.")}
              pending={pending === "new"}
            >
              Voltar para “Novos”
            </SecondaryButton>
          )}
          {request.status !== "archived" && (
            <SecondaryButton
              onClick={() => setStatus("archived", "Orçamento arquivado.")}
              pending={pending === "archived"}
            >
              <ArchiveIcon className="size-5" />
              Arquivar
            </SecondaryButton>
          )}
          {confirmingDelete ? (
            <div className="space-y-3 rounded-2xl border border-destructive/40 p-4">
              <p className="text-base">
                Excluir o pedido de orçamento nº {request.number} e as fotos?
                Não dá para desfazer.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <SecondaryButton onClick={() => setConfirmingDelete(false)}>
                  Não excluir
                </SecondaryButton>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={pending !== null}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-destructive px-6 text-base font-medium text-white disabled:opacity-60"
                >
                  {pending === "delete" && (
                    <LoaderCircleIcon className="size-5 animate-spin" />
                  )}
                  Excluir
                </button>
              </div>
            </div>
          ) : (
            <SecondaryButton
              destructive
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2Icon className="size-5" />
              Excluir
            </SecondaryButton>
          )}
        </div>
      </section>

      <StickyActions>
        <a
          href={reply}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onReply}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted sm:flex-1"
        >
          <MessageCircleIcon className="size-5" />
          Responder no WhatsApp
        </a>
        {request.order ? (
          <Link
            href={`/admin/pedidos/${request.order.id}`}
            className={`${primaryButtonClassName} sm:flex-1`}
          >
            <ClipboardListIcon className="size-5" />
            Ver pedido nº {request.order.number}
          </Link>
        ) : (
          <button
            type="button"
            onClick={createOrder}
            disabled={pending !== null}
            className={`${primaryButtonClassName} sm:flex-1`}
          >
            {pending === "order" ? (
              <LoaderCircleIcon className="size-5 animate-spin" />
            ) : (
              <ClipboardListIcon className="size-5" />
            )}
            Criar pedido
          </button>
        )}
      </StickyActions>
    </>
  );
}

function SecondaryButton({
  children,
  onClick,
  pending,
  destructive,
}: {
  children: ReactNode;
  onClick: () => void;
  pending?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-medium disabled:opacity-60",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "border border-input bg-card hover:bg-muted",
      )}
    >
      {pending && <LoaderCircleIcon className="size-5 animate-spin" />}
      {children}
    </button>
  );
}
