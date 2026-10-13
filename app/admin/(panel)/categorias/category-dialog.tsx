"use client";

import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  Alert,
  Field,
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
import { SITE_URL } from "@/lib/site";
import { isValidSlug, slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/client";

import type { AdminCategory } from "./category-manager";

const UNIQUE_VIOLATION = "23505";

export function CategoryDialog({
  category,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  /** null creates a new category. */
  category: AdminCategory | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = category === null;
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  // New categories follow the name until the address is edited by hand.
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const nameError = name.trim() ? null : "Digite o nome da categoria.";
  const slugError = isValidSlug(slug)
    ? null
    : "Use só letras minúsculas sem acento, números e hífens.";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameError || slugError) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const values = { name: name.trim(), slug };
    const { data, error: saveError } = isNew
      ? await supabase
          .from("categories")
          .insert({ ...values, sort_order: nextSortOrder })
          .select("id")
      : await supabase
          .from("categories")
          .update(values)
          .eq("id", category.id)
          .select("id");
    setPending(false);

    if (saveError?.code === UNIQUE_VIOLATION) {
      setError(
        "Já existe uma categoria com esse endereço. Mude o nome ou o endereço.",
      );
      return;
    }
    if (saveError || !data?.length) {
      setError("Não foi possível salvar. Confira a internet e tente de novo.");
      return;
    }
    onSaved(isNew ? "Categoria criada." : "Categoria salva.");
  }

  async function onDelete() {
    if (!category) return;
    setPending(true);
    setError(null);
    const { data, error: deleteError } = await createClient()
      .from("categories")
      .delete()
      .eq("id", category.id)
      .select("id");
    setPending(false);
    if (deleteError || !data?.length) {
      setError("Não foi possível excluir. Confira a internet e tente de novo.");
      return;
    }
    onSaved("Categoria excluída.");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 text-base sm:max-w-lg">
        {confirmingDelete && category ? (
          <>
            <DialogHeader className="pr-10">
              <DialogTitle className="font-heading text-xl font-medium">
                Excluir “{category.name}”?
              </DialogTitle>
              <DialogDescription className="text-base">
                {category.productCount === 0
                  ? "Nenhuma peça está nesta categoria."
                  : `${category.productCount === 1 ? "A peça desta categoria continua" : `As ${category.productCount} peças desta categoria continuam`} na loja, mas ficam sem categoria até você escolher outra.`}{" "}
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
                {isNew ? "Nova categoria" : "Editar categoria"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Nome e endereço da categoria na loja.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="space-y-6" noValidate>
              <Field
                label="Nome"
                htmlFor="category-name"
                error={showErrors ? nameError : null}
              >
                <TextInput
                  id="category-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!slugTouched) setSlug(slugify(event.target.value));
                  }}
                  placeholder="Ex.: Presépios"
                  autoFocus={isNew}
                  aria-invalid={showErrors && !!nameError}
                />
              </Field>

              <Field
                label="Endereço na loja"
                htmlFor="category-slug"
                error={showErrors ? slugError : null}
                hint={
                  isNew
                    ? "Preenchido sozinho a partir do nome."
                    : "Se mudar, links antigos desta categoria deixam de funcionar."
                }
              >
                <div className="flex min-h-12 items-center overflow-hidden rounded-xl border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
                  <span className="shrink-0 pl-4 text-muted-foreground">
                    {new URL(SITE_URL).host}/c/
                  </span>
                  <input
                    id="category-slug"
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(event.target.value.toLowerCase());
                    }}
                    onBlur={() => setSlug((value) => slugify(value))}
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={showErrors && !!slugError}
                    className="min-h-12 min-w-0 flex-1 bg-transparent pr-4 text-base outline-none"
                  />
                </div>
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
                {isNew ? "Criar categoria" : "Salvar"}
              </button>

              {!isNew && (
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
                  Excluir categoria
                </button>
              )}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
