"use client";

import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  Alert,
  Field,
  TextArea,
  TextInput,
  primaryButtonClassName,
} from "@/components/admin/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatWhatsApp, parseWhatsAppInput } from "@/lib/admin/settings";
import { createClient } from "@/lib/supabase/client";

export interface CustomerValues {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

const FOREIGN_KEY_VIOLATION = "23503";

/** Create (customer null) or edit a customer. Deleting needs `canDelete`. */
export function CustomerDialog({
  customer,
  initialName = "",
  canDelete = false,
  onClose,
  onSaved,
  onDeleted,
}: {
  customer: CustomerValues | null;
  /** Prefills the name of a new customer (e.g. what was typed in a search). */
  initialName?: string;
  canDelete?: boolean;
  onClose: () => void;
  onSaved: (customer: CustomerValues, message: string) => void;
  onDeleted?: () => void;
}) {
  const isNew = customer === null;
  const [name, setName] = useState(customer?.name ?? initialName);
  const [phone, setPhone] = useState(formatWhatsApp(customer?.phone));
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const parsedPhone = parseWhatsAppInput(phone);
  const nameError = name.trim() ? null : "Digite o nome do cliente.";
  const phoneError = parsedPhone.ok ? null : parsedPhone.error;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameError || !parsedPhone.ok) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const values = {
      name: name.trim(),
      phone: parsedPhone.value,
      notes: notes.trim() || null,
    };
    const { data, error: saveError } = isNew
      ? await supabase
          .from("customers")
          .insert(values)
          .select("id, name, phone, notes")
      : await supabase
          .from("customers")
          .update(values)
          .eq("id", customer.id)
          .select("id, name, phone, notes");
    setPending(false);
    if (saveError || !data?.length) {
      setError("Não foi possível salvar. Confira a internet e tente de novo.");
      return;
    }
    onSaved(data[0], isNew ? "Cliente cadastrado." : "Cliente salvo.");
  }

  async function onDelete() {
    if (!customer) return;
    setPending(true);
    setError(null);
    const { data, error: deleteError } = await createClient()
      .from("customers")
      .delete()
      .eq("id", customer.id)
      .select("id");
    setPending(false);
    if (deleteError?.code === FOREIGN_KEY_VIOLATION) {
      setError("Este cliente tem pedidos e não pode ser excluído.");
      return;
    }
    if (deleteError || !data?.length) {
      setError("Não foi possível excluir. Confira a internet e tente de novo.");
      return;
    }
    onDeleted?.();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 text-base sm:max-w-lg">
        {confirmingDelete && customer ? (
          <>
            <DialogHeader className="pr-10">
              <DialogTitle className="font-heading text-xl font-medium">
                Excluir “{customer.name}”?
              </DialogTitle>
              <DialogDescription className="text-base">
                Isso não pode ser desfeito.
              </DialogDescription>
            </DialogHeader>
            {error && <Alert>{error}</Alert>}
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-destructive px-6 font-medium text-white hover:bg-destructive/90 disabled:opacity-60"
              >
                {pending && (
                  <LoaderCircleIcon className="size-5 animate-spin" />
                )}
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={pending}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-input bg-card px-6 font-medium hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="pr-10">
              <DialogTitle className="font-heading text-xl font-medium">
                {isNew ? "Novo cliente" : "Editar cliente"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Nome, WhatsApp e observações do cliente.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="space-y-6" noValidate>
              <Field
                label="Nome"
                htmlFor="customer-name"
                error={showErrors ? nameError : null}
              >
                <TextInput
                  id="customer-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  autoFocus={isNew}
                  aria-invalid={showErrors && !!nameError}
                />
              </Field>

              <Field
                label="WhatsApp"
                htmlFor="customer-phone"
                hint="Com DDD. Usado para mandar o resumo do pedido."
                error={showErrors ? phoneError : null}
              >
                <TextInput
                  id="customer-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  onBlur={() => {
                    if (parsedPhone.ok)
                      setPhone(formatWhatsApp(parsedPhone.value));
                  }}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="(81) 98649-2071"
                  aria-invalid={showErrors && !!phoneError}
                />
              </Field>

              <Field
                label="Observações"
                htmlFor="customer-notes"
                hint="Endereço, preferências, como conheceu a loja…"
              >
                <TextArea
                  id="customer-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                />
              </Field>

              {error && <Alert>{error}</Alert>}

              <button
                type="submit"
                disabled={pending}
                className={primaryButtonClassName}
              >
                {pending && (
                  <LoaderCircleIcon className="size-5 animate-spin" />
                )}
                {isNew ? "Cadastrar cliente" : "Salvar"}
              </button>

              {!isNew && canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirmingDelete(true);
                  }}
                  disabled={pending}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2Icon className="size-5" />
                  Excluir cliente
                </button>
              )}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
