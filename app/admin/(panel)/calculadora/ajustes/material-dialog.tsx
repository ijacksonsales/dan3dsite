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
import { materialCost } from "@/lib/costs/calculate";
import type { AdminMaterial } from "@/lib/costs/data";
import {
  formatMoney,
  formatMoneyInput,
  formatNumberInput,
  parseMoneyInput,
  parseNumberInput,
} from "@/lib/costs/inputs";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { MaterialCategory } from "@/types/database";

export const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  packaging: "Embalagem",
  extra: "Material extra",
};

const CATEGORY_HINT: Record<MaterialCategory, string> = {
  packaging: "Saco, etiqueta, sacola, caixa…",
  extra: "Argola de chaveiro, ímã, tinta…",
};

export function MaterialDialog({
  material,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  /** null creates a new material. */
  material: AdminMaterial | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = material === null;
  const [name, setName] = useState(material?.name ?? "");
  const [category, setCategory] = useState<MaterialCategory>(
    material?.category ?? "packaging",
  );
  const [units, setUnits] = useState(
    formatNumberInput(material?.pack_units ?? 0),
  );
  const [price, setPrice] = useState(
    material ? formatMoneyInput(material.pack_price_cents) : "",
  );
  const [quantity, setQuantity] = useState(
    formatNumberInput(material?.default_quantity ?? 1),
  );
  const [usedByDefault, setUsedByDefault] = useState(
    material?.used_by_default ?? false,
  );
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const parsedUnits = parseNumberInput(units, {
    error: "Digite quantas unidades vêm no pacote.",
  });
  const parsedPrice = parseMoneyInput(price);
  const parsedQuantity = parseNumberInput(quantity, {
    error: "Digite quantas unidades vão em cada peça.",
  });
  const errors = {
    name: name.trim() ? null : "Digite o nome do material.",
    units:
      parsedUnits.ok && parsedUnits.value > 0
        ? null
        : "Digite quantas unidades vêm no pacote.",
    price:
      parsedPrice.ok && price.trim() ? null : "Digite o valor pago no pacote.",
    quantity:
      parsedQuantity.ok && parsedQuantity.value > 0
        ? null
        : "Digite quantas unidades vão em cada peça.",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const unitCost =
    parsedUnits.ok && parsedPrice.ok && parsedUnits.value > 0
      ? materialCost(
          {
            id: "",
            name,
            category,
            pack_units: parsedUnits.value,
            pack_price_cents: parsedPrice.value,
          },
          1,
        )
      : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasErrors || !parsedUnits.ok || !parsedPrice.ok || !parsedQuantity.ok) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const values = {
      name: name.trim(),
      category,
      pack_units: parsedUnits.value,
      pack_price_cents: parsedPrice.value,
      default_quantity: parsedQuantity.value,
      used_by_default: usedByDefault,
    };
    const { data, error: saveError } = isNew
      ? await supabase
          .from("materials")
          .insert({ ...values, sort_order: nextSortOrder })
          .select("id")
      : await supabase
          .from("materials")
          .update(values)
          .eq("id", material.id)
          .select("id");
    setPending(false);
    if (saveError || !data?.length) {
      setError("Não foi possível salvar. Confira a internet e tente de novo.");
      return;
    }
    onSaved(isNew ? "Material criado." : "Material salvo.");
  }

  async function onDelete() {
    if (!material) return;
    setPending(true);
    setError(null);
    const { data, error: deleteError } = await createClient()
      .from("materials")
      .delete()
      .eq("id", material.id)
      .select("id");
    setPending(false);
    if (deleteError || !data?.length) {
      setError("Não foi possível excluir. Confira a internet e tente de novo.");
      return;
    }
    onSaved("Material excluído.");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 text-base sm:max-w-lg">
        {confirmingDelete && material ? (
          <>
            <DialogHeader className="pr-10">
              <DialogTitle className="font-heading text-xl font-medium">
                Excluir “{material.name}”?
              </DialogTitle>
              <DialogDescription className="text-base">
                Ele deixa de aparecer na calculadora. Cálculos salvos nas peças
                passam a ignorá-lo. Isso não pode ser desfeito.
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
                {isNew ? "Novo material" : "Editar material"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Nome, tipo e preço do pacote.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="space-y-6" noValidate>
              <Field
                label="Nome"
                htmlFor="material-name"
                error={showErrors ? errors.name : null}
              >
                <TextInput
                  id="material-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Sacola kraft"
                  autoFocus={isNew}
                  aria-invalid={showErrors && !!errors.name}
                />
              </Field>

              <fieldset className="space-y-2">
                <legend className="text-base font-medium">Tipo</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(["packaging", "extra"] as const).map((option) => (
                    <label
                      key={option}
                      className={cn(
                        "flex min-h-12 cursor-pointer flex-col justify-center rounded-xl border px-4 py-2",
                        category === option
                          ? "border-primary bg-primary/5"
                          : "border-input bg-card",
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <input
                          type="radio"
                          name="material-category"
                          checked={category === option}
                          onChange={() => setCategory(option)}
                          className="size-5 accent-primary"
                        />
                        {CATEGORY_LABEL[option]}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {CATEGORY_HINT[option]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Unidades no pacote"
                  htmlFor="material-units"
                  error={showErrors ? errors.units : null}
                >
                  <TextInput
                    id="material-units"
                    inputMode="decimal"
                    value={units}
                    onChange={(event) => setUnits(event.target.value)}
                    placeholder="100"
                    aria-invalid={showErrors && !!errors.units}
                  />
                </Field>
                <Field
                  label="Valor do pacote (R$)"
                  htmlFor="material-price"
                  error={showErrors ? errors.price : null}
                >
                  <TextInput
                    id="material-price"
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="14,90"
                    aria-invalid={showErrors && !!errors.price}
                  />
                </Field>
              </div>
              {unitCost != null && (
                <p className="-mt-3 text-sm text-muted-foreground">
                  Sai a {formatMoney(unitCost)} cada.
                </p>
              )}

              <Field
                label="Quantos vão em cada peça"
                htmlFor="material-quantity"
                hint="Quantidade sugerida; dá para mudar em cada cálculo."
                error={showErrors ? errors.quantity : null}
              >
                <TextInput
                  id="material-quantity"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  aria-invalid={showErrors && !!errors.quantity}
                />
              </Field>

              <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
                <input
                  type="checkbox"
                  checked={usedByDefault}
                  onChange={(event) => setUsedByDefault(event.target.checked)}
                  className="size-6 accent-primary"
                />
                Já vem marcado em cálculos novos
              </label>

              {error && <Alert>{error}</Alert>}

              <button
                type="submit"
                disabled={pending}
                className={primaryButtonClassName}
              >
                {pending && (
                  <LoaderCircleIcon className="size-5 animate-spin" />
                )}
                {isNew ? "Criar material" : "Salvar"}
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
                  Excluir material
                </button>
              )}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
