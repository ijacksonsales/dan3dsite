"use client";

import { ChevronRightIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  StickyActions,
  TextInput,
  primaryButtonClassName,
} from "@/components/admin/form";
import {
  CustomerDialog,
  type CustomerValues,
} from "@/components/admin/orders/customer-dialog";
import { useToast } from "@/components/admin/toast";
import { formatWhatsApp } from "@/lib/admin/settings";

interface ListCustomer extends CustomerValues {
  orderCount: number;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function CustomerList({ initial }: { initial: ListCustomer[] }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const term = normalize(search.trim());
  const digits = search.replace(/\D/g, "");
  const customers = initial.filter(
    (customer) =>
      !term ||
      normalize(customer.name).includes(term) ||
      (digits.length >= 4 && customer.phone?.includes(digits)),
  );

  return (
    <>
      <div className="relative mb-4">
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
        />
      </div>

      {initial.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          Nenhum cliente ainda. Eles também podem ser cadastrados na hora de
          criar um pedido.
        </p>
      ) : customers.length === 0 ? (
        <p className="px-4 py-10 text-center text-base text-muted-foreground">
          Nenhum cliente encontrado.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/admin/clientes/${customer.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-medium">
                    {customer.name}
                  </span>
                  <span className="block text-base text-muted-foreground">
                    {[
                      customer.phone && formatWhatsApp(customer.phone),
                      customer.orderCount === 0
                        ? "nenhum pedido"
                        : customer.orderCount === 1
                          ? "1 pedido"
                          : `${customer.orderCount} pedidos`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <StickyActions>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <UserPlusIcon className="size-5" />
          Novo cliente
        </button>
      </StickyActions>

      {creating && (
        <CustomerDialog
          customer={null}
          initialName={digits ? "" : search.trim()}
          onClose={() => setCreating(false)}
          onSaved={(customer, message) => {
            setCreating(false);
            toast(message);
            router.push(`/admin/clientes/${customer.id}`);
          }}
        />
      )}
    </>
  );
}
