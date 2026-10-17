"use client";

import { ClipboardListIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  CostBreakdownList,
  CostFields,
  useCostFields,
} from "@/components/admin/cost-fields";
import {
  Alert,
  Field,
  StickyActions,
  inputClassName,
  primaryButtonClassName,
} from "@/components/admin/form";
import { useToast } from "@/components/admin/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CostInputs, CostSettings } from "@/lib/costs/calculate";
import type { AdminMaterial } from "@/lib/costs/data";
import { formatMoney, formatNumberInput } from "@/lib/costs/inputs";
import { formatPrice } from "@/lib/format";
import { savePendingItem } from "@/lib/orders/pending-item";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

interface ProductOption {
  id: string;
  name: string;
  price_cents: number | null;
}

export function Calculator({
  settings,
  materials,
  products,
  savedCosts,
  initialProductId,
}: {
  settings: CostSettings;
  materials: AdminMaterial[];
  products: ProductOption[];
  savedCosts: Record<string, CostInputs>;
  initialProductId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [productId, setProductId] = useState(initialProductId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [askPrice, setAskPrice] = useState(false);
  const cost = useCostFields(
    settings,
    materials,
    (initialProductId && savedCosts[initialProductId]) || null,
    () => setSaveError(null),
  );
  const { inputs, result } = cost;

  const product = products.find(({ id }) => id === productId) ?? null;

  function chooseProduct(id: string | null) {
    setProductId(id);
    setSaveError(null);
    // A product with saved costs brings them back; otherwise keep what was
    // typed, so a price worked out first can be saved to the piece.
    const saved = id ? savedCosts[id] : undefined;
    if (saved) cost.load(saved);
  }

  async function save() {
    if (!product || !inputs || !result) return;
    setSaving(true);
    setSaveError(null);
    const { data, error } = await createClient()
      .from("product_costs")
      .upsert({
        product_id: product.id,
        inputs: inputs as unknown as Json,
      })
      .select("product_id");
    setSaving(false);
    if (error || !data?.length) {
      setSaveError(
        "Não foi possível salvar. Confira a internet e tente de novo.",
      );
      return;
    }
    if (
      result.roundedPrice > 0 &&
      product.price_cents !== result.roundedPrice
    ) {
      setAskPrice(true);
    } else {
      toast("Cálculo salvo na peça.");
    }
    router.refresh();
  }

  function sendToOrder() {
    if (!inputs) return;
    savePendingItem({
      productId: product?.id ?? null,
      description: product?.name ?? "",
      inputs,
    });
    router.push("/admin/pedidos/novo?item=calculadora");
  }

  return (
    <div className="space-y-8">
      <Field
        label="Peça"
        htmlFor="product"
        hint={
          product
            ? savedCosts[product.id]
              ? "Esta peça tem um cálculo salvo; ele aparece abaixo."
              : "Esta peça ainda não tem cálculo salvo."
            : "Escolha uma peça do catálogo para salvar o cálculo nela, ou só calcule."
        }
      >
        <select
          id="product"
          value={productId ?? ""}
          onChange={(event) => chooseProduct(event.target.value || null)}
          className={inputClassName}
        >
          <option value="">Nenhuma (só calcular)</option>
          {products.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </Field>

      <CostFields state={cost} />

      <section id="detalhes" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-medium">
          Como chegamos nesse preço
        </h2>
        <CostBreakdownList
          result={result}
          settings={settings}
          weightG={inputs?.weightG ?? 0}
        />
        <p className="text-sm text-muted-foreground">
          Tempo de impressão: {formatNumberInput(result?.printHours ?? 0) || 0}{" "}
          h. Para mudar margem, energia ou o valor da máquina, use “Valores da
          máquina, margem e materiais” no topo.
        </p>
      </section>

      <StickyActions>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Preço sugerido</p>
          <p className="font-heading text-2xl font-medium" aria-live="polite">
            {result ? formatMoney(result.roundedPrice) : "—"}
          </p>
          {result && result.roundedPrice > 0 && (
            <p className="text-sm text-muted-foreground">
              Custo {formatMoney(result.cost)} · Lucro{" "}
              {formatMoney(result.profitAtRoundedPrice)}
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={sendToOrder}
          disabled={!result || result.roundedPrice <= 0}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted disabled:opacity-60"
        >
          <ClipboardListIcon className="size-5" />
          Usar num pedido
        </button>
        {product && (
          <button
            type="button"
            onClick={save}
            disabled={saving || !result}
            className={`${primaryButtonClassName} sm:w-auto sm:min-w-48`}
          >
            {saving && <LoaderCircleIcon className="size-5 animate-spin" />}
            {saving ? "Salvando…" : "Salvar na peça"}
          </button>
        )}
      </StickyActions>

      {askPrice && product && result && (
        <PriceDialog
          product={product}
          newPrice={result.roundedPrice}
          onClose={(updated) => {
            setAskPrice(false);
            toast(
              updated
                ? "Cálculo salvo e preço da peça atualizado."
                : "Cálculo salvo na peça.",
            );
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PriceDialog({
  product,
  newPrice,
  onClose,
}: {
  product: ProductOption;
  newPrice: number;
  onClose: (updated: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update() {
    setPending(true);
    setError(null);
    const { data, error: updateError } = await createClient()
      .from("products")
      .update({ price_cents: newPrice })
      .eq("id", product.id)
      .select("id");
    setPending(false);
    if (updateError || !data?.length) {
      setError(
        "Não foi possível mudar o preço. Confira a internet e tente de novo.",
      );
      return;
    }
    onClose(true);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose(false)}>
      <DialogContent className="gap-6 p-6 text-base sm:max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="font-heading text-xl font-medium">
            Usar {formatPrice(newPrice)} na loja?
          </DialogTitle>
          <DialogDescription className="text-base">
            O cálculo foi salvo. Hoje “{product.name}” aparece na loja{" "}
            {product.price_cents == null
              ? "como “Sob consulta”"
              : `por ${formatPrice(product.price_cents)}`}
            .
          </DialogDescription>
        </DialogHeader>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={update}
            disabled={pending}
            className={`${primaryButtonClassName} sm:flex-1`}
          >
            {pending && <LoaderCircleIcon className="size-5 animate-spin" />}
            Usar {formatPrice(newPrice)}
          </button>
          <button
            type="button"
            onClick={() => onClose(false)}
            disabled={pending}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-input bg-card px-6 font-medium hover:bg-muted"
          >
            Manter o preço atual
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
