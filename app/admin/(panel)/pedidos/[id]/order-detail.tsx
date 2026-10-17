"use client";

import {
  BanknoteIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import {
  Alert,
  Field,
  StickyActions,
  TextInput,
  primaryButtonClassName,
} from "@/components/admin/form";
import { DueText } from "@/components/admin/orders/order-card";
import { useToast } from "@/components/admin/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatWhatsApp } from "@/lib/admin/settings";
import { formatMoneyInput, parseMoneyInput } from "@/lib/costs/inputs";
import { formatDay, isDay } from "@/lib/dates";
import { formatPrice } from "@/lib/format";
import { orderMessage } from "@/lib/orders/message";
import {
  PAYMENT_METHOD_LABEL,
  STATUS_FLOW,
  STATUS_LABEL,
  isClosed,
  nextStep,
} from "@/lib/orders/status";
import { orderTotals } from "@/lib/orders/totals";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import type { OrderStatus, PaymentMethod } from "@/types/database";

interface Payment {
  id: string;
  amount_cents: number;
  paid_on: string;
  method: PaymentMethod;
  note: string | null;
}

interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  due_date: string | null;
  discount_cents: number;
  shipping_cents: number;
  notes: string | null;
  customer: { id: string; name: string; phone: string | null };
  order_items: {
    id: string;
    product_id: string | null;
    description: string;
    quantity: number;
    unit_price_cents: number;
    unit_cost_cents: number | null;
  }[];
  order_payments: Payment[];
}

type Confirm = "cancel" | "delete" | { back: OrderStatus } | null;

export function OrderDetail({
  order,
  storeName,
  today,
}: {
  order: Order;
  storeName: string;
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [removingPayment, setRemovingPayment] = useState<Payment | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const totals = orderTotals({
    items: order.order_items,
    discount_cents: order.discount_cents,
    shipping_cents: order.shipping_cents,
    payments: order.order_payments,
  });
  const next = nextStep(order.status);
  const closed = isClosed(order.status);
  const flowIndex = STATUS_FLOW.indexOf(order.status);
  const previous = flowIndex > 0 ? STATUS_FLOW[flowIndex - 1] : null;

  const message = orderMessage({
    number: order.number,
    status: order.status,
    customerName: order.customer.name,
    storeName,
    dueDate: order.due_date,
    items: order.order_items,
    discount_cents: order.discount_cents,
    shipping_cents: order.shipping_cents,
    payments: order.order_payments,
  });
  const whatsapp = order.customer.phone
    ? whatsappLink(order.customer.phone, message)
    : null;

  async function setStatus(status: OrderStatus, done: string) {
    setPending(true);
    setError(null);
    const { data, error: updateError } = await createClient()
      .from("orders")
      .update({
        status,
        delivered_at: status === "delivered" ? new Date().toISOString() : null,
      })
      .eq("id", order.id)
      .select("id");
    setPending(false);
    if (updateError || !data?.length) {
      setError(
        "Não foi possível mudar a situação. Confira a internet e tente de novo.",
      );
      return;
    }
    setConfirm(null);
    toast(done);
    router.refresh();
  }

  async function deleteOrder() {
    setPending(true);
    setError(null);
    const { data, error: deleteError } = await createClient()
      .from("orders")
      .delete()
      .eq("id", order.id)
      .select("id");
    if (deleteError || !data?.length) {
      setPending(false);
      setError("Não foi possível excluir. Confira a internet e tente de novo.");
      return;
    }
    toast("Pedido excluído.");
    router.push("/admin/pedidos");
    router.refresh();
  }

  async function removePayment(payment: Payment) {
    setPending(true);
    setError(null);
    const { data, error: deleteError } = await createClient()
      .from("order_payments")
      .delete()
      .eq("id", payment.id)
      .select("id");
    setPending(false);
    if (deleteError || !data?.length) {
      setError(
        "Não foi possível apagar o pagamento. Confira a internet e tente de novo.",
      );
      return;
    }
    setRemovingPayment(null);
    toast("Pagamento apagado.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error && !confirm && !removingPayment && <Alert>{error}</Alert>}

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">Cliente</h2>
        <Link
          href={`/admin/clientes/${order.customer.id}`}
          className="flex min-h-16 flex-col justify-center rounded-2xl border border-border bg-card px-4 py-3 hover:bg-muted"
        >
          <span className="text-lg font-medium">{order.customer.name}</span>
          <span className="text-base text-muted-foreground">
            {order.customer.phone
              ? formatWhatsApp(order.customer.phone)
              : "Sem WhatsApp cadastrado"}
          </span>
        </Link>
        {order.due_date && (
          <p className="text-base">
            Previsão de entrega: {formatDay(order.due_date)}{" "}
            <DueText
              status={order.status}
              dueDate={order.due_date}
              today={today}
            />
          </p>
        )}
        {order.notes && (
          <p className="rounded-xl bg-secondary px-4 py-3 text-base whitespace-pre-line">
            {order.notes}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-medium">Peças</h2>
          {!closed && (
            <Link
              href={`/admin/pedidos/${order.id}/editar`}
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-medium text-primary hover:bg-secondary"
            >
              <PencilIcon className="size-5" />
              Editar
            </Link>
          )}
        </div>
        <dl className="divide-y divide-border rounded-2xl border border-border bg-card text-base">
          {order.order_items.map((item) => (
            <Row
              key={item.id}
              label={
                <>
                  {item.quantity}× {item.description}
                  {item.quantity > 1 && (
                    <span className="block text-sm text-muted-foreground">
                      {formatPrice(item.unit_price_cents)} cada
                    </span>
                  )}
                </>
              }
              value={formatPrice(item.quantity * item.unit_price_cents)}
            />
          ))}
          {totals.discount > 0 && (
            <Row label="Desconto" value={`−${formatPrice(totals.discount)}`} />
          )}
          {totals.shipping > 0 && (
            <Row label="Frete" value={formatPrice(totals.shipping)} />
          )}
          <Row label="Total" value={formatPrice(totals.total)} strong />
        </dl>
        <p className="text-sm text-muted-foreground">
          {totals.costKnown
            ? `Custo estimado ${formatPrice(totals.cost)} · lucro estimado ${formatPrice(totals.profit)}`
            : "Há peças sem custo calculado; o lucro não pode ser estimado."}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">Pagamentos</h2>
        {order.order_payments.length > 0 && (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {order.order_payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center gap-3 py-1 pr-1 pl-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {formatPrice(payment.amount_cents)} ·{" "}
                    {PAYMENT_METHOD_LABEL[payment.method]}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatDay(payment.paid_on)}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setRemovingPayment(payment);
                  }}
                  aria-label={`Apagar pagamento de ${formatPrice(payment.amount_cents)}`}
                  className="grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <XIcon className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-base">
          {totals.paid === 0
            ? "Nenhum pagamento registrado."
            : totals.balance > 0
              ? `Pago ${formatPrice(totals.paid)} · falta ${formatPrice(totals.balance)}`
              : `Pago ${formatPrice(totals.paid)} · pagamento completo ✓`}
        </p>
        {order.status !== "canceled" && (
          <button
            type="button"
            onClick={() => setPaying(true)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted"
          >
            <BanknoteIcon className="size-5" />
            Registrar pagamento
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-medium">Mais opções</h2>
        <div className="flex flex-col gap-2">
          {previous && (
            <SecondaryButton
              onClick={() => {
                setError(null);
                setConfirm({ back: previous });
              }}
            >
              Voltar para “{STATUS_LABEL[previous]}”
            </SecondaryButton>
          )}
          {order.status === "canceled" ? (
            <SecondaryButton
              onClick={() =>
                setStatus("quote", "Pedido reaberto como orçamento.")
              }
              disabled={pending}
            >
              Reabrir como orçamento
            </SecondaryButton>
          ) : (
            <SecondaryButton
              onClick={() => {
                setError(null);
                setConfirm("cancel");
              }}
            >
              Cancelar pedido
            </SecondaryButton>
          )}
          {order.order_payments.length === 0 && (
            <SecondaryButton
              destructive
              onClick={() => {
                setError(null);
                setConfirm("delete");
              }}
            >
              <Trash2Icon className="size-5" />
              Excluir pedido
            </SecondaryButton>
          )}
        </div>
      </section>

      <StickyActions>
        <a
          href={whatsapp ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!whatsapp}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:flex-1"
        >
          <MessageCircleIcon className="size-5" />
          {whatsapp ? "Enviar pelo WhatsApp" : "Cliente sem WhatsApp"}
        </a>
        {next && (
          <button
            type="button"
            onClick={() =>
              setStatus(
                next.status,
                `Pedido agora está “${STATUS_LABEL[next.status]}”.`,
              )
            }
            disabled={pending}
            className={`${primaryButtonClassName} sm:flex-1`}
          >
            {pending && <LoaderCircleIcon className="size-5 animate-spin" />}
            {next.label}
          </button>
        )}
      </StickyActions>

      {paying && (
        <PaymentDialog
          orderId={order.id}
          suggested={totals.balance}
          today={today}
          onClose={() => setPaying(false)}
          onSaved={() => {
            setPaying(false);
            toast("Pagamento registrado.");
            router.refresh();
          }}
        />
      )}

      {removingPayment && (
        <ConfirmDialog
          title={`Apagar o pagamento de ${formatPrice(removingPayment.amount_cents)}?`}
          description={`Registrado em ${formatDay(removingPayment.paid_on)} (${PAYMENT_METHOD_LABEL[removingPayment.method]}). Use isso só para corrigir um registro errado.`}
          action="Apagar pagamento"
          destructive
          pending={pending}
          error={error}
          onConfirm={() => removePayment(removingPayment)}
          onClose={() => setRemovingPayment(null)}
        />
      )}

      {confirm === "cancel" && (
        <ConfirmDialog
          title={`Cancelar o pedido nº ${order.number}?`}
          description="Ele sai da lista de pedidos em andamento. Os pagamentos registrados continuam aqui. Dá para reabrir depois."
          action="Cancelar pedido"
          destructive
          pending={pending}
          error={error}
          onConfirm={() => setStatus("canceled", "Pedido cancelado.")}
          onClose={() => setConfirm(null)}
        />
      )}

      {confirm === "delete" && (
        <ConfirmDialog
          title={`Excluir o pedido nº ${order.number}?`}
          description="Ele some de vez, com todas as peças. Isso não pode ser desfeito."
          action="Excluir pedido"
          destructive
          pending={pending}
          error={error}
          onConfirm={deleteOrder}
          onClose={() => setConfirm(null)}
        />
      )}

      {confirm && typeof confirm === "object" && (
        <ConfirmDialog
          title={`Voltar para “${STATUS_LABEL[confirm.back]}”?`}
          description="Use isso para corrigir uma mudança feita por engano."
          action="Voltar"
          pending={pending}
          error={error}
          onConfirm={() =>
            setStatus(
              confirm.back,
              `Pedido voltou para “${STATUS_LABEL[confirm.back]}”.`,
            )
          }
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 px-4 py-3",
        strong && "text-lg font-medium",
      )}
    >
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-medium disabled:opacity-60",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "border border-input bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({
  title,
  description,
  action,
  destructive,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  action: string;
  destructive?: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="gap-6 p-6 text-base sm:max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="font-heading text-xl font-medium">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 font-medium disabled:opacity-60",
              destructive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-espresso",
            )}
          >
            {pending && <LoaderCircleIcon className="size-5 animate-spin" />}
            {action}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-input bg-card px-6 font-medium hover:bg-muted"
          >
            Agora não
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  orderId,
  suggested,
  today,
  onClose,
  onSaved,
}: {
  orderId: string;
  suggested: number;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(
    suggested > 0 ? formatMoneyInput(suggested) : "",
  );
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseMoneyInput(amount);
  const amountError =
    parsedAmount.ok && parsedAmount.value > 0
      ? null
      : "Digite o valor recebido, por exemplo 50,00.";
  const dateError = isDay(paidOn) ? null : "Escolha a data.";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (amountError || dateError || !parsedAmount.ok) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    setError(null);
    const { data, error: saveError } = await createClient()
      .from("order_payments")
      .insert({
        order_id: orderId,
        amount_cents: parsedAmount.value,
        paid_on: paidOn,
        method,
        note: note.trim() || null,
      })
      .select("id");
    setPending(false);
    if (saveError || !data?.length) {
      setError("Não foi possível salvar. Confira a internet e tente de novo.");
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 text-base sm:max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="font-heading text-xl font-medium">
            Registrar pagamento
          </DialogTitle>
          <DialogDescription className="text-base">
            Sinal ou restante.{" "}
            {suggested > 0 && `Falta receber ${formatPrice(suggested)}.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valor (R$)"
              htmlFor="payment-amount"
              error={showErrors ? amountError : null}
            >
              <TextInput
                id="payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={showErrors && !!amountError}
              />
            </Field>
            <Field
              label="Data"
              htmlFor="payment-date"
              error={showErrors ? dateError : null}
            >
              <TextInput
                id="payment-date"
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-base font-medium">Forma</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
                (option) => (
                  <label
                    key={option}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 font-medium",
                      method === option
                        ? "border-primary bg-primary/5"
                        : "border-input bg-card",
                    )}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      checked={method === option}
                      onChange={() => setMethod(option)}
                      className="size-5 accent-primary"
                    />
                    {PAYMENT_METHOD_LABEL[option]}
                  </label>
                ),
              )}
            </div>
          </fieldset>

          <Field
            label="Observação"
            htmlFor="payment-note"
            hint="Opcional. Ex.: sinal de 50%."
          >
            <TextInput
              id="payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {error && <Alert>{error}</Alert>}

          <button
            type="submit"
            disabled={pending}
            className={primaryButtonClassName}
          >
            {pending && <LoaderCircleIcon className="size-5 animate-spin" />}
            Registrar{" "}
            {parsedAmount.ok && parsedAmount.value > 0
              ? formatPrice(parsedAmount.value)
              : ""}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
