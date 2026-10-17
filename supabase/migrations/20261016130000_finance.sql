-- Finance (PLAN.md §5, phase 8): bills to pay and monthly summaries.
-- Admin-only, reads included. Summaries are SQL functions so the panel stays
-- right past PostgREST's 1,000-row limit; all are security invoker, so the
-- RLS of the tables they read still applies.

create type public.expense_category as enum (
  'filament', 'materials', 'packaging', 'energy', 'machine', 'other'
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(trim(description)) > 0),
  category public.expense_category not null default 'other',
  amount_cents int not null check (amount_cents > 0),
  due_date date not null,
  paid_on date, -- null = still to pay
  repeat_monthly boolean not null default false,
  notes text,
  created_at timestamptz default now()
);

create index expenses_paid_on_idx on public.expenses (paid_on);
create index expenses_unpaid_due_date_idx on public.expenses (due_date) where paid_on is null;

alter table public.expenses enable row level security;

create policy "expenses: admin read" on public.expenses
  for select to authenticated using ((select public.is_admin()));
create policy "expenses: admin insert" on public.expenses
  for insert to authenticated with check ((select public.is_admin()));
create policy "expenses: admin update" on public.expenses
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "expenses: admin delete" on public.expenses
  for delete to authenticated using ((select public.is_admin()));

-- Marks a bill as paid. A monthly bill paid for the first time creates the
-- next month's, in the same transaction.
create function public.pay_expense(p_expense_id uuid, p_paid_on date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense public.expenses;
begin
  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'expense not found';
  end if;

  update public.expenses set paid_on = p_paid_on where id = p_expense_id;

  if v_expense.paid_on is null and v_expense.repeat_monthly then
    insert into public.expenses (description, category, amount_cents, due_date, repeat_monthly, notes)
    values (
      v_expense.description, v_expense.category, v_expense.amount_cents,
      (v_expense.due_date + interval '1 month')::date, true, v_expense.notes
    );
  end if;
end;
$$;

-- Per month in [p_from, p_to] (first days of months): money received,
-- bills paid, and the orders delivered that month with their estimated cost.
-- Delivery dates are taken in Brasília time.
create function public.finance_months(p_from date, p_to date)
returns table (
  month date,
  received_cents bigint,
  expenses_paid_cents bigint,
  delivered_count bigint,
  delivered_revenue_cents bigint,
  delivered_cost_cents bigint,
  items_without_cost bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', p_from)::date,
      date_trunc('month', p_to)::date,
      interval '1 month'
    )::date as month
  ),
  received as (
    select date_trunc('month', paid_on)::date as month, sum(amount_cents) as total
    from public.order_payments
    where paid_on >= date_trunc('month', p_from)::date
      and paid_on < (date_trunc('month', p_to) + interval '1 month')::date
    group by 1
  ),
  paid as (
    select date_trunc('month', paid_on)::date as month, sum(amount_cents) as total
    from public.expenses
    where paid_on >= date_trunc('month', p_from)::date
      and paid_on < (date_trunc('month', p_to) + interval '1 month')::date
    group by 1
  ),
  delivered as (
    select
      o.id,
      date_trunc('month', (o.delivered_at at time zone 'America/Sao_Paulo'))::date as month,
      o.discount_cents,
      coalesce(sum(i.quantity * i.unit_price_cents), 0) as subtotal,
      coalesce(sum(i.quantity * i.unit_cost_cents), 0) as cost,
      count(*) filter (where i.unit_cost_cents is null) as missing
    from public.orders o
    left join public.order_items i on i.order_id = o.id
    where o.status = 'delivered'
      and o.delivered_at >= (date_trunc('month', p_from)::timestamp at time zone 'America/Sao_Paulo')
      and o.delivered_at < ((date_trunc('month', p_to) + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')
    group by o.id
  ),
  delivered_by_month as (
    select
      month,
      count(*) as orders,
      sum(subtotal - least(discount_cents, subtotal)) as revenue,
      sum(cost) as cost,
      sum(missing) as missing
    from delivered
    group by month
  )
  select
    m.month,
    coalesce(r.total, 0)::bigint,
    coalesce(p.total, 0)::bigint,
    coalesce(d.orders, 0)::bigint,
    coalesce(d.revenue, 0)::bigint,
    coalesce(d.cost, 0)::bigint,
    coalesce(d.missing, 0)::bigint
  from months m
  left join received r on r.month = m.month
  left join paid p on p.month = m.month
  left join delivered_by_month d on d.month = m.month
  order by m.month;
$$;

-- What is pending right now: money to receive from orders (confirmed or
-- later, delivered included, canceled and quotes left out) and bills to pay.
create function public.finance_open(p_today date)
returns table (
  receivable_cents bigint,
  receivable_orders bigint,
  payable_cents bigint,
  payable_count bigint,
  overdue_cents bigint,
  overdue_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with order_balance as (
    select
      o.id,
      greatest(
        coalesce((select sum(i.quantity * i.unit_price_cents) from public.order_items i where i.order_id = o.id), 0)
          - o.discount_cents + o.shipping_cents
          - coalesce((select sum(p.amount_cents) from public.order_payments p where p.order_id = o.id), 0),
        0
      ) as balance
    from public.orders o
    where o.status in ('confirmed', 'in_production', 'ready', 'delivered')
  ),
  bills as (
    select amount_cents, due_date from public.expenses where paid_on is null
  )
  select
    coalesce((select sum(balance) from order_balance), 0)::bigint,
    (select count(*) from order_balance where balance > 0)::bigint,
    coalesce((select sum(amount_cents) from bills), 0)::bigint,
    (select count(*) from bills)::bigint,
    coalesce((select sum(amount_cents) from bills where due_date < p_today), 0)::bigint,
    (select count(*) from bills where due_date < p_today)::bigint;
$$;

-- Best sellers among orders delivered in [p_from, p_to] (Brasília days).
create function public.finance_top_items(p_from date, p_to date, p_limit int default 5)
returns table (description text, quantity bigint, revenue_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(pr.name, i.description) as description,
    sum(i.quantity)::bigint,
    sum(i.quantity * i.unit_price_cents)::bigint
  from public.order_items i
  join public.orders o on o.id = i.order_id
  left join public.products pr on pr.id = i.product_id
  where o.status = 'delivered'
    and o.delivered_at >= (p_from::timestamp at time zone 'America/Sao_Paulo')
    and o.delivered_at < ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo')
  group by 1
  order by 3 desc, 2 desc
  limit p_limit;
$$;

revoke all on function public.pay_expense(uuid, date) from public, anon;
grant execute on function public.pay_expense(uuid, date) to authenticated;
revoke all on function public.finance_months(date, date) from public, anon;
grant execute on function public.finance_months(date, date) to authenticated;
revoke all on function public.finance_open(date) from public, anon;
grant execute on function public.finance_open(date) to authenticated;
revoke all on function public.finance_top_items(date, date, int) from public, anon;
grant execute on function public.finance_top_items(date, date, int) to authenticated;
