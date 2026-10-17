import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { storeToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

import { ExpenseManager } from "./expense-manager";

export const metadata: Metadata = { title: "Contas a pagar" };

const PAID_LIMIT = 100;
const COLUMNS =
  "id, description, category, amount_cents, due_date, paid_on, repeat_monthly, notes";

export default async function ExpensesPage({
  searchParams,
}: PageProps<"/admin/financeiro/contas">) {
  const { aba } = await searchParams;
  const showPaid = aba === "pagas";
  const supabase = await createClient();
  const { data, error } = showPaid
    ? await supabase
        .from("expenses")
        .select(COLUMNS)
        .not("paid_on", "is", null)
        .order("paid_on", { ascending: false })
        .limit(PAID_LIMIT)
    : await supabase
        .from("expenses")
        .select(COLUMNS)
        .is("paid_on", null)
        .order("due_date");
  if (error) throw error;

  return (
    <>
      <PageHeader
        title="Contas a pagar"
        backHref="/admin/financeiro"
        backLabel="Financeiro"
      >
        <p className="text-base text-muted-foreground">
          Tudo o que sai do caixa: filamento, materiais, energia, manutenção.
        </p>
      </PageHeader>
      <ExpenseManager
        expenses={data}
        showPaid={showPaid}
        today={storeToday()}
      />
    </>
  );
}
