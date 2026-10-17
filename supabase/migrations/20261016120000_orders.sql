-- Customers and orders (PLAN.md §5, phase 7). Admin-only, reads included.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text check (phone is null or phone ~ '^55[0-9]{10,11}$'), -- 55DDDNUMBER
  notes text,
  created_at timestamptz default now()
);

create type public.order_status as enum (
  'quote', 'confirmed', 'in_production', 'ready', 'delivered', 'canceled'
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity unique, -- "Pedido nº 12"
  customer_id uuid not null references public.customers(id) on delete restrict,
  status public.order_status not null default 'quote',
  due_date date,
  discount_cents int not null default 0 check (discount_cents >= 0),
  shipping_cents int not null default 0 check (shipping_cents >= 0),
  notes text,
  delivered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_due_date_idx on public.orders (status, due_date);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- A snapshot of the price and cost when the item was added: changing the
-- calculator later does not change old orders.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  unit_cost_cents int check (unit_cost_cents >= 0), -- null = not calculated
  unit_pass_through_cents int not null default 0 check (unit_pass_through_cents >= 0),
  cost_inputs jsonb, -- calculator inputs used (lib/costs/calculate.ts)
  sort_order int not null default 0
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create type public.payment_method as enum ('pix', 'cash', 'card', 'other');

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  paid_on date not null default current_date,
  method public.payment_method not null default 'pix',
  note text,
  created_at timestamptz default now()
);

create index order_payments_order_id_idx on public.order_payments (order_id);
create index order_payments_paid_on_idx on public.order_payments (paid_on);

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

create policy "customers: admin read" on public.customers
  for select to authenticated using ((select public.is_admin()));
create policy "customers: admin insert" on public.customers
  for insert to authenticated with check ((select public.is_admin()));
create policy "customers: admin update" on public.customers
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "customers: admin delete" on public.customers
  for delete to authenticated using ((select public.is_admin()));

create policy "orders: admin read" on public.orders
  for select to authenticated using ((select public.is_admin()));
create policy "orders: admin insert" on public.orders
  for insert to authenticated with check ((select public.is_admin()));
create policy "orders: admin update" on public.orders
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "orders: admin delete" on public.orders
  for delete to authenticated using ((select public.is_admin()));

create policy "order_items: admin read" on public.order_items
  for select to authenticated using ((select public.is_admin()));
create policy "order_items: admin insert" on public.order_items
  for insert to authenticated with check ((select public.is_admin()));
create policy "order_items: admin update" on public.order_items
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "order_items: admin delete" on public.order_items
  for delete to authenticated using ((select public.is_admin()));

create policy "order_payments: admin read" on public.order_payments
  for select to authenticated using ((select public.is_admin()));
create policy "order_payments: admin insert" on public.order_payments
  for insert to authenticated with check ((select public.is_admin()));
create policy "order_payments: admin update" on public.order_payments
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "order_payments: admin delete" on public.order_payments
  for delete to authenticated using ((select public.is_admin()));

-- Creates (p_order_id null) or updates an order and replaces its items in
-- one transaction, so a dropped connection never leaves an order without
-- items. security invoker: the RLS above still decides who may write.
create function public.save_order(
  p_order_id uuid,
  p_customer_id uuid,
  p_due_date date,
  p_discount_cents int,
  p_shipping_cents int,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'an order needs at least one item';
  end if;

  if p_order_id is null then
    insert into public.orders (customer_id, due_date, discount_cents, shipping_cents, notes)
    values (p_customer_id, p_due_date, p_discount_cents, p_shipping_cents, p_notes)
    returning id into v_order_id;
  else
    update public.orders
    set customer_id = p_customer_id,
        due_date = p_due_date,
        discount_cents = p_discount_cents,
        shipping_cents = p_shipping_cents,
        notes = p_notes
    where id = p_order_id
    returning id into v_order_id;
    if v_order_id is null then
      raise exception 'order not found';
    end if;
    delete from public.order_items where order_id = v_order_id;
  end if;

  insert into public.order_items (
    order_id, product_id, description, quantity, unit_price_cents,
    unit_cost_cents, unit_pass_through_cents, cost_inputs, sort_order
  )
  select
    v_order_id,
    (item.value ->> 'product_id')::uuid,
    item.value ->> 'description',
    (item.value ->> 'quantity')::int,
    (item.value ->> 'unit_price_cents')::int,
    (item.value ->> 'unit_cost_cents')::int,
    coalesce((item.value ->> 'unit_pass_through_cents')::int, 0),
    nullif(item.value -> 'cost_inputs', 'null'::jsonb),
    (item.position - 1)::int
  from jsonb_array_elements(p_items) with ordinality as item(value, position);

  return v_order_id;
end;
$$;

revoke all on function public.save_order(uuid, uuid, date, int, int, text, jsonb) from public, anon;
grant execute on function public.save_order(uuid, uuid, date, int, int, text, jsonb) to authenticated;
