"use client";

import {
  CheckIcon,
  LoaderCircleIcon,
  PlusIcon,
  RepeatIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Alert,
  Field,
  StickyActions,
  TextArea,
  TextInput,
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
import { formatMoneyInput, parseMoneyInput } from "@/lib/costs/inputs";
import { daysBetween, formatDay, isDay } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/months";
import { formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/types/database";

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount_cents: number;
  due_date: string;
  paid_on: string | null;
  repeat_monthly: boolean;
  notes: string | null;
}

function dueText(expense: Expense, today: string) {
  if (expense.paid_on) return `Paga em ${formatDay(expense.paid_on)}`;
  const days = daysBetween(today, expense.due_date);
  if (days < 0)
    return `Venceu em ${formatDay(expense.due_date)} (${-days === 1 ? "1 dia" : `${-days} dias`})`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${formatDay(expense.due_date)}`;
}

export function ExpenseManager({
  expenses,
  showPaid,
  today,
}: {
  expenses: Expense[];
  showPaid: boolean;
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  // undefined: closed · null: new bill · object: editing it.
  const [editing, setEditing] = useState<Expense | null | undefined>();
  const [paying, setPaying] = useState<Expense | null>(null);
  const total = expenses.reduce(
    (sum, expense) => sum + expense.amount_cents,
    0,
  );

  return (
    <>
      <nav aria-label="Contas" className="mb-6 flex gap-2">
        {[
          {
            href: "/admin/financeiro/contas",
            label: "A pagar",
            active: !showPaid,
          },
          {
            href: "/admin/financeiro/contas?aba=pagas",
            label: "Pagas",
            active: showPaid,
          },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 items-center rounded-full border px-5 text-base font-medium",
              tab.active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {expenses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          {showPaid
            ? "Nenhuma conta paga ainda."
            : "Nenhuma conta em aberto. Toque em “Nova conta” para lançar uma compra ou conta do mês."}
        </p>
      ) : (
        <>
          {!showPaid && (
            <p className="mb-3 text-base">
              Total em aberto: <strong>{formatPrice(total)}</strong>
            </p>
          )}
          <ul className="space-y-3">
            {expenses.map((expense) => {
              const late = !expense.paid_on && expense.due_date < today;
              return (
                <li
                  key={expense.id}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border bg-card p-2",
                    late ? "border-destructive/60" : "border-border",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setEditing(expense)}
                    className="flex min-h-14 min-w-0 flex-1 flex-col justify-center rounded-xl px-2 text-left hover:bg-muted"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-lg font-medium">
                        {expense.description}
                      </span>
                      {expense.repeat_monthly && (
                        <RepeatIcon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-label="Todo mês"
                        />
                      )}
                    </span>
                    <span className="text-base">
                      {formatPrice(expense.amount_cents)} ·{" "}
                      <span
                        className={
                          late
                            ? "font-medium text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {dueText(expense, today)}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {EXPENSE_CATEGORY_LABEL[expense.category]}
                    </span>
                  </button>
                  {!expense.paid_on && (
                    <button
                      type="button"
                      onClick={() => setPaying(expense)}
                      className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground hover:bg-espresso"
                    >
                      <CheckIcon className="size-5" />
                      Paguei
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <StickyActions>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <PlusIcon className="size-5" />
          Nova conta
        </button>
      </StickyActions>

      {paying && (
        <PayDialog
          expense={paying}
          today={today}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            toast(
              paying.repeat_monthly
                ? "Conta paga. A do próximo mês já foi lançada."
                : "Conta paga.",
            );
            router.refresh();
          }}
        />
      )}

      {editing !== undefined && (
        <ExpenseDialog
          expense={editing}
          today={today}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            toast(message);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function PayDialog({
  expense,
  today,
  onClose,
  onPaid,
}: {
  expense: Expense;
  today: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [paidOn, setPaidOn] = useState(today);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!isDay(paidOn)) {
      setError("Escolha a data do pagamento.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: payError } = await createClient().rpc("pay_expense", {
      p_expense_id: expense.id,
      p_paid_on: paidOn,
    });
    setPending(false);
    if (payError) {
      setError("Não foi possível salvar. Confira a internet e tente de novo.");
      return;
    }
    onPaid();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="gap-6 p-6 text-base sm:max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="font-heading text-xl font-medium">
            Pagar “{expense.description}”
          </DialogTitle>
          <DialogDescription className="text-base">
            {formatPrice(expense.amount_cents)}
            {expense.repeat_monthly &&
              ". Como é uma conta de todo mês, a do próximo mês é lançada sozinha."}
          </DialogDescription>
        </DialogHeader>
        <Field label="Data do pagamento" htmlFor="paid-on">
          <TextInput
            id="paid-on"
            type="date"
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <button
          type="button"
          onClick={pay}
          disabled={pending}
          className={primaryButtonClassName}
        >
          {pending && <LoaderCircleIcon className="size-5 animate-spin" />}
          Confirmar pagamento
        </button>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({
  expense,
  today,
  onClose,
  onSaved,
}: {
  /** null creates a new bill. */
  expense: Expense | null;
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = expense === null;
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "filament",
  );
  const [amount, setAmount] = useState(
    expense ? formatMoneyInput(expense.amount_cents) : "",
  );
  const [dueDate, setDueDate] = useState(expense?.due_date ?? today);
  const [repeat, setRepeat] = useState(expense?.repeat_monthly ?? false);
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const parsedAmount = parseMoneyInput(amount);
  const errors = {
    description: description.trim() ? null : "Digite o que é a conta.",
    amount:
      parsedAmount.ok && parsedAmount.value > 0
        ? null
        : "Digite o valor, por exemplo 120,00.",
    dueDate: isDay(dueDate) ? null : "Escolha a data.",
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Object.values(errors).some(Boolean) || !parsedAmount.ok) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const values = {
      description: description.trim(),
      category,
      amount_cents: parsedAmount.value,
      due_date: dueDate,
      repeat_monthly: repeat,
      notes: notes.trim() || null,
    };
    if (isNew) {
      const { data, error: saveError } = await supabase
        .from("expenses")
        .insert(values)
        .select("id");
      const id = data?.[0]?.id;
      if (saveError || !id) {
        setPending(false);
        setError(
          "Não foi possível salvar. Confira a internet e tente de novo.",
        );
        return;
      }
      // A purchase already paid goes through pay_expense, so a monthly bill
      // also gets next month's.
      if (alreadyPaid) {
        const { error: payError } = await supabase.rpc("pay_expense", {
          p_expense_id: id,
          p_paid_on: dueDate,
        });
        if (payError) {
          setPending(false);
          setError(
            "A conta foi lançada, mas não foi marcada como paga. Toque em “Paguei” nela.",
          );
          return;
        }
      }
      onSaved(alreadyPaid ? "Conta lançada como paga." : "Conta lançada.");
      return;
    }
    const { data, error: saveError } = await supabase
      .from("expenses")
      .update(values)
      .eq("id", expense.id)
      .select("id");
    setPending(false);
    if (saveError || !data?.length) {
      setError("Não foi possível salvar. Confira a internet e tente de novo.");
      return;
    }
    onSaved("Conta salva.");
  }

  async function markUnpaid() {
    if (!expense) return;
    setPending(true);
    setError(null);
    const { data, error: saveError } = await createClient()
      .from("expenses")
      .update({ paid_on: null })
      .eq("id", expense.id)
      .select("id");
    setPending(false);
    if (saveError || !data?.length) {
      setError("Não foi possível salvar. Confira a internet e tente de novo.");
      return;
    }
    onSaved("Conta voltou para “a pagar”.");
  }

  async function onDelete() {
    if (!expense) return;
    setPending(true);
    setError(null);
    const { data, error: deleteError } = await createClient()
      .from("expenses")
      .delete()
      .eq("id", expense.id)
      .select("id");
    setPending(false);
    if (deleteError || !data?.length) {
      setError("Não foi possível excluir. Confira a internet e tente de novo.");
      return;
    }
    onSaved("Conta excluída.");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 text-base sm:max-w-lg">
        {confirmingDelete && expense ? (
          <>
            <DialogHeader className="pr-10">
              <DialogTitle className="font-heading text-xl font-medium">
                Excluir “{expense.description}”?
              </DialogTitle>
              <DialogDescription className="text-base">
                Ela sai das contas e do financeiro. Isso não pode ser desfeito.
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
                {isNew ? "Nova conta" : "Editar conta"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Descrição, tipo, valor e vencimento.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="space-y-6" noValidate>
              <Field
                label="O que é"
                htmlFor="expense-description"
                error={showErrors ? errors.description : null}
              >
                <TextInput
                  id="expense-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ex.: 3 rolos de PLA"
                  autoFocus={isNew}
                  aria-invalid={showErrors && !!errors.description}
                />
              </Field>

              <Field label="Tipo" htmlFor="expense-category">
                <select
                  id="expense-category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as ExpenseCategory)
                  }
                  className={inputClassName}
                >
                  {(
                    Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[]
                  ).map((option) => (
                    <option key={option} value={option}>
                      {EXPENSE_CATEGORY_LABEL[option]}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Valor (R$)"
                  htmlFor="expense-amount"
                  error={showErrors ? errors.amount : null}
                >
                  <TextInput
                    id="expense-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0,00"
                    aria-invalid={showErrors && !!errors.amount}
                  />
                </Field>
                <Field
                  label="Vencimento"
                  htmlFor="expense-due"
                  error={showErrors ? errors.dueDate : null}
                >
                  <TextInput
                    id="expense-due"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </Field>
              </div>

              <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(event) => setRepeat(event.target.checked)}
                  className="size-6 accent-primary"
                />
                <span>
                  Conta de todo mês
                  <span className="block text-sm text-muted-foreground">
                    Luz, internet, aluguel… Ao pagar, a do próximo mês é lançada
                    sozinha.
                  </span>
                </span>
              </label>

              {isNew && (
                <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    checked={alreadyPaid}
                    onChange={(event) => setAlreadyPaid(event.target.checked)}
                    className="size-6 accent-primary"
                  />
                  <span>
                    Já está paga
                    <span className="block text-sm text-muted-foreground">
                      Compra feita à vista: entra como paga na data acima.
                    </span>
                  </span>
                </label>
              )}

              <Field label="Observações" htmlFor="expense-notes">
                <TextArea
                  id="expense-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  className="min-h-20"
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
                {isNew ? "Lançar conta" : "Salvar"}
              </button>

              {expense?.paid_on && (
                <button
                  type="button"
                  onClick={markUnpaid}
                  disabled={pending}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-input bg-card px-6 font-medium hover:bg-muted"
                >
                  Marcar como não paga
                </button>
              )}

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
                  Excluir conta
                </button>
              )}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
