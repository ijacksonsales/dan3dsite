"use client";

import {
  CalculatorIcon,
  LoaderCircleIcon,
  MinusIcon,
  PackageIcon,
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  CostBreakdownList,
  CostFields,
  useCostFields,
} from "@/components/admin/cost-fields";
import {
  Alert,
  Field,
  StickyActions,
  TextArea,
  TextInput,
  primaryButtonClassName,
} from "@/components/admin/form";
import {
  CustomerDialog,
  type CustomerValues,
} from "@/components/admin/orders/customer-dialog";
import { useToast } from "@/components/admin/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatWhatsApp } from "@/lib/admin/settings";
import { calculateCost, type CostInputs } from "@/lib/costs/calculate";
import {
  formatMoney,
  formatMoneyInput,
  parseMoneyInput,
} from "@/lib/costs/inputs";
import { isDay } from "@/lib/dates";
import { formatPrice } from "@/lib/format";
import type { OrderFormOptions } from "@/lib/orders/data";
import { takePendingItem } from "@/lib/orders/pending-item";
import { orderTotals } from "@/lib/orders/totals";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

interface DraftItem {
  key: string;
  productId: string | null;
  description: string;
  quantity: number;
  price: string;
  unitCostCents: number | null;
  unitPassThroughCents: number;
  costInputs: CostInputs | null;
}

export interface OrderFormInitial {
  id: string | null;
  customerId: string | null;
  dueDate: string | null;
  discountCents: number;
  shippingCents: number;
  notes: string | null;
  items: {
    product_id: string | null;
    description: string;
    quantity: number;
    /** null: not priced yet (pieces from a quote request). */
    unit_price_cents: number | null;
    unit_cost_cents: number | null;
    unit_pass_through_cents: number;
    cost_inputs: CostInputs | null;
  }[];
}

let nextKey = 0;
const newKey = () => `item-${++nextKey}`;

export function OrderForm({
  options,
  initial,
  fromCalculator = false,
  quoteRequestId = null,
}: {
  options: OrderFormOptions;
  initial: OrderFormInitial;
  /** Adds the calculation sent by the calculator page ("Usar num pedido"). */
  fromCalculator?: boolean;
  /** Site quote request this order answers ("Criar pedido"). */
  quoteRequestId?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { settings, materials, products, savedCosts } = options;
  const isNew = initial.id === null;

  const [customers, setCustomers] = useState(options.customers);
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [items, setItems] = useState<DraftItem[]>(() =>
    initial.items.map((item) => ({
      key: newKey(),
      productId: item.product_id,
      description: item.description,
      quantity: item.quantity,
      price:
        item.unit_price_cents == null
          ? ""
          : formatMoneyInput(item.unit_price_cents),
      unitCostCents: item.unit_cost_cents,
      unitPassThroughCents: item.unit_pass_through_cents,
      costInputs: item.cost_inputs,
    })),
  );
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [shipping, setShipping] = useState(
    initial.shippingCents ? formatMoneyInput(initial.shippingCents) : "",
  );
  const [discount, setDiscount] = useState(
    initial.discountCents ? formatMoneyInput(initial.discountCents) : "",
  );
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // undefined: closed · null: new custom piece · key: recalculating that item.
  const [calculating, setCalculating] = useState<string | null | undefined>();

  /** Cost snapshot of a calculation, in whole cents. */
  function snapshot(inputs: CostInputs) {
    const result = calculateCost(settings, inputs, materials);
    return {
      result,
      unitCostCents: Math.round(result.cost),
      unitPassThroughCents: Math.round(result.extras + result.packaging),
    };
  }

  // The calculator page hands over its calculation through sessionStorage,
  // which only exists in the browser: read it once, after the first render.
  const tookPending = useRef(false);
  useEffect(() => {
    if (!fromCalculator || tookPending.current) return;
    tookPending.current = true;
    const pending = takePendingItem();
    if (!pending) return;
    const { result, unitCostCents, unitPassThroughCents } = snapshot(
      pending.inputs,
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only storage
    setItems((current) => [
      ...current,
      {
        key: newKey(),
        productId: pending.productId,
        description: pending.description,
        quantity: 1,
        price: formatMoneyInput(result.roundedPrice),
        unitCostCents,
        unitPassThroughCents,
        costInputs: pending.inputs,
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once
  }, [fromCalculator]);

  const customer = customers.find(({ id }) => id === customerId) ?? null;
  const parsedShipping = parseMoneyInput(shipping);
  const parsedDiscount = parseMoneyInput(discount);
  const parsedItems = items.map((item) => ({
    item,
    price: item.price.trim()
      ? parseMoneyInput(item.price)
      : ({ ok: false, error: "Digite o preço." } as const),
  }));

  const totals = orderTotals({
    items: parsedItems.map(({ item, price }) => ({
      quantity: item.quantity,
      unit_price_cents: price.ok ? price.value : 0,
      unit_cost_cents: item.unitCostCents,
    })),
    discount_cents: parsedDiscount.ok ? parsedDiscount.value : 0,
    shipping_cents: parsedShipping.ok ? parsedShipping.value : 0,
  });

  const errors = {
    customer: customer ? null : "Escolha ou cadastre o cliente.",
    items: items.length ? null : "Adicione pelo menos uma peça.",
    dueDate: !dueDate || isDay(dueDate) ? null : "Data inválida.",
    shipping: parsedShipping.ok ? null : parsedShipping.error,
    discount: parsedDiscount.ok ? null : parsedDiscount.error,
  };
  const itemsValid = parsedItems.every(
    ({ item, price }) => item.description.trim() && price.ok,
  );

  function updateItem(key: string, change: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
    setSaveError(null);
  }

  function addProduct(product: OrderFormOptions["products"][number]) {
    const saved = savedCosts[product.id];
    const cost = saved ? snapshot(saved) : null;
    setItems((current) => [
      ...current,
      {
        key: newKey(),
        productId: product.id,
        description: product.name,
        quantity: 1,
        price:
          product.price_cents != null
            ? formatMoneyInput(product.price_cents)
            : cost
              ? formatMoneyInput(cost.result.roundedPrice)
              : "",
        unitCostCents: cost?.unitCostCents ?? null,
        unitPassThroughCents: cost?.unitPassThroughCents ?? 0,
        costInputs: saved ?? null,
      },
    ]);
    setPicking(false);
    setSaveError(null);
  }

  function applyCalculation(
    key: string | null,
    description: string,
    inputs: CostInputs | null,
  ) {
    const cost = inputs ? snapshot(inputs) : null;
    const change = {
      description,
      unitCostCents: cost?.unitCostCents ?? null,
      unitPassThroughCents: cost?.unitPassThroughCents ?? 0,
      costInputs: inputs,
    };
    if (key) {
      updateItem(key, {
        ...change,
        ...(cost && { price: formatMoneyInput(cost.result.roundedPrice) }),
      });
    } else {
      setItems((current) => [
        ...current,
        {
          key: newKey(),
          productId: null,
          quantity: 1,
          price: cost ? formatMoneyInput(cost.result.roundedPrice) : "",
          ...change,
        },
      ]);
    }
    setCalculating(undefined);
    setSaveError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      Object.values(errors).some(Boolean) ||
      !itemsValid ||
      !parsedShipping.ok ||
      !parsedDiscount.ok ||
      !customer
    ) {
      setShowErrors(true);
      setSaveError("Confira os campos marcados em vermelho.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload = parsedItems.map(({ item, price }) => ({
      product_id: item.productId,
      description: item.description.trim(),
      quantity: item.quantity,
      unit_price_cents: price.ok ? price.value : 0,
      unit_cost_cents: item.unitCostCents,
      unit_pass_through_cents: item.unitPassThroughCents,
      cost_inputs: item.costInputs,
    }));
    const { data: id, error } = await createClient().rpc("save_order", {
      p_order_id: initial.id,
      p_customer_id: customer.id,
      p_due_date: dueDate || null,
      p_discount_cents: parsedDiscount.value,
      p_shipping_cents: parsedShipping.value,
      p_notes: notes.trim() || null,
      p_items: payload as unknown as Json,
    });
    if (error || !id) {
      setSaving(false);
      setSaveError(
        "Não foi possível salvar. Confira a internet e tente de novo.",
      );
      return;
    }
    if (quoteRequestId) {
      // Links the request to its order; the order is already saved, so a
      // failure here only leaves the request without the "Ver pedido" link.
      await createClient()
        .from("quote_requests")
        .update({ order_id: id, status: "answered" })
        .eq("id", quoteRequestId);
    }
    toast(isNew ? "Orçamento criado." : "Pedido salvo.");
    router.push(`/admin/pedidos/${id}`);
    router.refresh();
  }

  const calculatingItem =
    typeof calculating === "string"
      ? items.find(({ key }) => key === calculating)
      : undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      <FormSection number={1} title="Cliente">
        {customer ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-medium">
                {customer.name}
              </span>
              <span className="block text-base text-muted-foreground">
                {customer.phone
                  ? formatWhatsApp(customer.phone)
                  : "Sem WhatsApp cadastrado"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setCustomerId(null)}
              className="inline-flex min-h-12 shrink-0 items-center rounded-full border border-input bg-card px-5 font-medium hover:bg-muted"
            >
              Trocar
            </button>
          </div>
        ) : (
          <CustomerPicker
            customers={customers}
            error={showErrors ? errors.customer : null}
            onPick={(id) => {
              setCustomerId(id);
              setSaveError(null);
            }}
            onCreated={(created) => {
              setCustomers((current) =>
                [...current, created].sort((a, b) =>
                  a.name.localeCompare(b.name, "pt-BR"),
                ),
              );
              setCustomerId(created.id);
              toast("Cliente cadastrado.");
            }}
          />
        )}
      </FormSection>

      <FormSection number={2} title="Peças">
        {items.length === 0 ? (
          <p
            className={`rounded-2xl border border-dashed px-4 py-8 text-center text-base ${showErrors ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}
          >
            Nenhuma peça ainda. Adicione uma do catálogo ou uma peça avulsa.
          </p>
        ) : (
          <ul className="space-y-3">
            {parsedItems.map(({ item, price }) => (
              <li key={item.key}>
                <ItemCard
                  item={item}
                  priceError={showErrors && !price.ok ? price.error : null}
                  descriptionError={
                    showErrors && !item.description.trim()
                      ? "Digite o nome da peça."
                      : null
                  }
                  onChange={(change) => updateItem(item.key, change)}
                  onRemove={() =>
                    setItems((current) =>
                      current.filter(({ key }) => key !== item.key),
                    )
                  }
                  onCalculate={() => setCalculating(item.key)}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted"
          >
            <PackageIcon className="size-5" />
            Peça do catálogo
          </button>
          <button
            type="button"
            onClick={() => setCalculating(null)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted"
          >
            <PencilLineIcon className="size-5" />
            Peça avulsa
          </button>
        </div>
      </FormSection>

      <FormSection number={3} title="Entrega e valores">
        <Field
          label="Previsão de entrega"
          htmlFor="due-date"
          hint="Opcional. Pedidos perto do prazo aparecem em destaque."
          error={showErrors ? errors.dueDate : null}
        >
          <TextInput
            id="due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Frete (R$)"
            htmlFor="shipping"
            error={showErrors ? errors.shipping : null}
          >
            <TextInput
              id="shipping"
              inputMode="decimal"
              value={shipping}
              onChange={(event) => setShipping(event.target.value)}
              placeholder="0,00"
              aria-invalid={showErrors && !!errors.shipping}
            />
          </Field>
          <Field
            label="Desconto (R$)"
            htmlFor="discount"
            error={showErrors ? errors.discount : null}
          >
            <TextInput
              id="discount"
              inputMode="decimal"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              placeholder="0,00"
              aria-invalid={showErrors && !!errors.discount}
            />
          </Field>
        </div>
        <Field
          label="Observações"
          htmlFor="notes"
          hint="Cores, personalização, endereço de entrega… Só você vê."
        >
          <TextArea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
        </Field>

        <dl className="divide-y divide-border rounded-2xl border border-border bg-card text-base">
          <SummaryRow label="Peças" value={formatPrice(totals.subtotal)} />
          {totals.discount > 0 && (
            <SummaryRow
              label="Desconto"
              value={`−${formatPrice(totals.discount)}`}
            />
          )}
          {totals.shipping > 0 && (
            <SummaryRow label="Frete" value={formatPrice(totals.shipping)} />
          )}
          <SummaryRow label="Total" value={formatPrice(totals.total)} strong />
          <SummaryRow
            label="Custo estimado"
            value={
              totals.costKnown
                ? formatPrice(totals.cost)
                : `${formatPrice(totals.cost)} + itens sem cálculo`
            }
          />
          <SummaryRow
            label="Lucro estimado"
            value={totals.costKnown ? formatPrice(totals.profit) : "—"}
          />
        </dl>
        {!totals.costKnown && items.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Há peças sem custo calculado. Toque em “Calcular custo” nelas para
            ver o lucro.
          </p>
        )}
      </FormSection>

      <StickyActions>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="font-heading text-2xl font-medium">
            {formatPrice(totals.total)}
          </p>
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className={`${primaryButtonClassName} sm:w-auto sm:min-w-56`}
        >
          {saving && <LoaderCircleIcon className="size-5 animate-spin" />}
          {saving ? "Salvando…" : isNew ? "Criar orçamento" : "Salvar pedido"}
        </button>
      </StickyActions>

      {picking && (
        <ProductPicker
          products={products}
          hasCost={(id) => !!savedCosts[id]}
          onPick={addProduct}
          onClose={() => setPicking(false)}
        />
      )}

      {calculating !== undefined && (
        <CustomPieceDialog
          options={options}
          initialDescription={calculatingItem?.description ?? ""}
          initialInputs={
            calculatingItem
              ? (calculatingItem.costInputs ??
                (calculatingItem.productId
                  ? savedCosts[calculatingItem.productId]
                  : null) ??
                null)
              : null
          }
          isNew={calculating === null}
          onApply={(description, inputs) =>
            applyCalculation(calculating, description, inputs)
          }
          onClose={() => setCalculating(undefined)}
        />
      )}
    </form>
  );
}

function FormSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-3 font-heading text-xl font-medium">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-base text-primary-foreground">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-4 py-3 ${strong ? "text-lg font-medium" : ""}`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function CustomerPicker({
  customers,
  error,
  onPick,
  onCreated,
}: {
  customers: CustomerValues[];
  error: string | null;
  onPick: (id: string) => void;
  onCreated: (customer: CustomerValues) => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const term = normalize(search.trim());
  const digits = search.replace(/\D/g, "");
  const matches = customers
    .filter(
      (customer) =>
        !term ||
        normalize(customer.name).includes(term) ||
        (digits.length >= 4 && customer.phone?.includes(digits)),
    )
    .slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="customer-search" className="sr-only">
          Buscar cliente
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <TextInput
          id="customer-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar pelo nome ou telefone"
          autoComplete="off"
          className="pl-12"
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {matches.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {matches.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => onPick(customer.id)}
                className="flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left hover:bg-muted"
              >
                <span className="text-base font-medium">{customer.name}</span>
                {customer.phone && (
                  <span className="text-sm text-muted-foreground">
                    {formatWhatsApp(customer.phone)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {term && matches.length === 0 && (
        <p className="text-base text-muted-foreground">
          Nenhum cliente com esse nome.
        </p>
      )}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted"
      >
        <UserPlusIcon className="size-5" />
        {search.trim() && !digits
          ? `Cadastrar “${search.trim()}”`
          : "Cadastrar cliente novo"}
      </button>
      {creating && (
        <CustomerDialog
          customer={null}
          initialName={digits ? "" : search.trim()}
          onClose={() => setCreating(false)}
          onSaved={(customer) => {
            setCreating(false);
            onCreated(customer);
          }}
        />
      )}
    </div>
  );
}

function ItemCard({
  item,
  priceError,
  descriptionError,
  onChange,
  onRemove,
  onCalculate,
}: {
  item: DraftItem;
  priceError: string | null;
  descriptionError: string | null;
  onChange: (change: Partial<DraftItem>) => void;
  onRemove: () => void;
  onCalculate: () => void;
}) {
  const price = parseMoneyInput(item.price);
  const unitPrice = price.ok ? price.value : 0;
  const profit =
    item.unitCostCents != null
      ? (unitPrice - item.unitCostCents) * item.quantity
      : null;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <Field
        label="Peça"
        htmlFor={`${item.key}-description`}
        error={descriptionError}
      >
        <TextInput
          id={`${item.key}-description`}
          value={item.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Ex.: Chaveiro com nome"
          aria-invalid={!!descriptionError}
        />
      </Field>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <span className="block text-base font-medium" id={`${item.key}-qty`}>
            Quantidade
          </span>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-labelledby={`${item.key}-qty`}
          >
            <button
              type="button"
              onClick={() =>
                onChange({ quantity: Math.max(1, item.quantity - 1) })
              }
              disabled={item.quantity <= 1}
              aria-label="Diminuir quantidade"
              className="grid size-12 place-items-center rounded-full border border-input bg-card hover:bg-muted disabled:opacity-40"
            >
              <MinusIcon className="size-5" />
            </button>
            <span className="w-10 text-center text-lg font-medium tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onChange({ quantity: item.quantity + 1 })}
              aria-label="Aumentar quantidade"
              className="grid size-12 place-items-center rounded-full border border-input bg-card hover:bg-muted"
            >
              <PlusIcon className="size-5" />
            </button>
          </div>
        </div>
        <Field
          label="Preço de cada (R$)"
          htmlFor={`${item.key}-price`}
          error={priceError}
          className="min-w-40 flex-1"
        >
          <TextInput
            id={`${item.key}-price`}
            inputMode="decimal"
            value={item.price}
            onChange={(event) => onChange({ price: event.target.value })}
            onBlur={() => {
              if (price.ok && item.price.trim())
                onChange({ price: formatMoneyInput(price.value) });
            }}
            placeholder="0,00"
            aria-invalid={!!priceError}
          />
        </Field>
      </div>

      <p className="text-base text-muted-foreground">
        {item.quantity > 1 && `${item.quantity} × ${formatPrice(unitPrice)} = `}
        <span className="font-medium text-foreground">
          {formatPrice(unitPrice * item.quantity)}
        </span>
        {item.unitCostCents != null && profit != null ? (
          <>
            {" "}
            · custo {formatPrice(item.unitCostCents * item.quantity)} · lucro{" "}
            <span className={profit < 0 ? "text-destructive" : undefined}>
              {formatPrice(profit)}
            </span>
          </>
        ) : (
          " · custo não calculado"
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCalculate}
          className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-medium text-primary hover:bg-secondary"
        >
          <CalculatorIcon className="size-5" />
          {item.unitCostCents == null ? "Calcular custo" : "Recalcular"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-medium text-destructive hover:bg-destructive/10"
        >
          <Trash2Icon className="size-5" />
          Tirar
        </button>
      </div>
    </div>
  );
}

function ProductPicker({
  products,
  hasCost,
  onPick,
  onClose,
}: {
  products: OrderFormOptions["products"];
  hasCost: (id: string) => boolean;
  onPick: (product: OrderFormOptions["products"][number]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const term = normalize(search.trim());
  const matches = products.filter(
    (product) => !term || normalize(product.name).includes(term),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 p-6 text-base sm:max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="font-heading text-xl font-medium">
            Peça do catálogo
          </DialogTitle>
          <DialogDescription className="text-base">
            O preço vem da loja e o custo, do cálculo salvo na peça.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <label htmlFor="product-search" className="sr-only">
            Buscar peça
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <TextInput
            id="product-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar pelo nome"
            autoComplete="off"
            className="pl-12"
          />
        </div>
        <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto">
          {matches.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onPick(product)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {product.name}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatPrice(product.price_cents)}
                    {hasCost(product.id) ? "" : " · sem cálculo de custo"}
                  </span>
                </span>
                <PlusIcon className="size-5 shrink-0 text-primary" />
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-6 text-center text-muted-foreground">
              Nenhuma peça com esse nome.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function CustomPieceDialog({
  options,
  initialDescription,
  initialInputs,
  isNew,
  onApply,
  onClose,
}: {
  options: OrderFormOptions;
  initialDescription: string;
  initialInputs: CostInputs | null;
  isNew: boolean;
  onApply: (description: string, inputs: CostInputs | null) => void;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(initialDescription);
  const [showErrors, setShowErrors] = useState(false);
  const cost = useCostFields(
    options.settings,
    options.materials,
    initialInputs,
  );
  const descriptionError = description.trim() ? null : "Digite o nome da peça.";

  function apply(withCost: boolean) {
    if (descriptionError || (withCost && !cost.inputs)) {
      setShowErrors(true);
      return;
    }
    onApply(description.trim(), withCost ? cost.inputs : null);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 text-base sm:max-w-2xl">
        <DialogHeader className="pr-10">
          <DialogTitle className="font-heading text-xl font-medium">
            {isNew ? "Peça avulsa" : "Calcular custo"}
          </DialogTitle>
          <DialogDescription className="text-base">
            Preencha como na calculadora. O preço sugerido vai para o pedido e
            dá para mudar depois.
          </DialogDescription>
        </DialogHeader>

        <Field
          label="Nome da peça"
          htmlFor="custom-description"
          error={showErrors ? descriptionError : null}
        >
          <TextInput
            id="custom-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex.: Chaveiro com nome"
            aria-invalid={showErrors && !!descriptionError}
          />
        </Field>

        <CostFields state={cost} idPrefix="custom-" />

        <details className="rounded-2xl border border-border">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium">
            Como chegamos nesse preço
          </summary>
          <div className="p-2 pt-0">
            <CostBreakdownList
              result={cost.result}
              settings={options.settings}
              weightG={cost.inputs?.weightG ?? 0}
            />
          </div>
        </details>

        {showErrors && !cost.inputs && (
          <Alert>Corrija os campos marcados em vermelho.</Alert>
        )}

        <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-col gap-2 border-t border-border bg-popover px-6 py-4 sm:flex-row-reverse sm:items-center">
          <button
            type="button"
            onClick={() => apply(true)}
            className={`${primaryButtonClassName} sm:w-auto sm:min-w-56`}
          >
            {cost.result
              ? `${isNew ? "Adicionar" : "Usar"} por ${formatMoney(cost.result.roundedPrice)}`
              : isNew
                ? "Adicionar"
                : "Usar"}
          </button>
          {isNew && (
            <button
              type="button"
              onClick={() => apply(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-full px-6 font-medium text-primary hover:bg-secondary"
            >
              Adicionar sem calcular
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
