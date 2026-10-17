import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { createClient } from "@/lib/supabase/server";

import { CustomerList } from "./customer-list";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, notes, orders(count)")
    .order("name");
  if (error) throw error;

  return (
    <>
      <PageHeader
        title="Clientes"
        backHref="/admin/pedidos"
        backLabel="Pedidos"
      />
      <CustomerList
        initial={data.map(({ orders, ...customer }) => ({
          ...customer,
          orderCount: orders[0]?.count ?? 0,
        }))}
      />
    </>
  );
}
