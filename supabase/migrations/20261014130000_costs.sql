-- Cost calculator (PLAN.md §5, phase 6), replacing docs/Calculadora_Custos_DAN3D.xlsx.
-- Everything here is admin-only, reads included: costs and margins are not
-- for customers. That is why none of it lives in `settings` or `products`,
-- which are publicly readable.

-- Single-row parameters, defaults taken from the spreadsheet.
create table public.cost_settings (
  id int primary key default 1 check (id = 1),
  filament_price_per_kg_cents int not null default 12000 check (filament_price_per_kg_cents >= 0),
  energy_price_per_kwh_cents int not null default 100 check (energy_price_per_kwh_cents >= 0),
  printer_power_w int not null default 150 check (printer_power_w >= 0),
  machine_price_cents int not null default 320000 check (machine_price_cents >= 0),
  machine_life_hours int not null default 5000 check (machine_life_hours > 0),
  maintenance_cents int not null default 100000 check (maintenance_cents >= 0),
  failure_percent numeric not null default 10 check (failure_percent >= 0 and failure_percent <= 100),
  labor_rate_per_hour_cents int not null default 1500 check (labor_rate_per_hour_cents >= 0),
  margin_percent numeric not null default 100 check (margin_percent >= 0 and margin_percent <= 1000),
  updated_at timestamptz default now()
);

insert into public.cost_settings (id) values (1);

create trigger cost_settings_set_updated_at
  before update on public.cost_settings
  for each row execute function public.set_updated_at();

-- Bought items charged at cost (no margin): extras such as keyring hooks,
-- and packaging.
create type public.material_category as enum ('extra', 'packaging');

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  pack_units numeric not null check (pack_units > 0),
  pack_price_cents int not null check (pack_price_cents >= 0),
  category public.material_category not null,
  default_quantity numeric not null default 1 check (default_quantity > 0),
  used_by_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Items from the spreadsheet's "Materiais" tab.
insert into public.materials
  (name, pack_units, pack_price_cents, category, default_quantity, used_by_default, sort_order)
values
  ('Saco plástico', 100, 1490, 'packaging', 1, true, 0),
  ('Etiqueta adesiva', 92, 6500, 'packaging', 1, true, 1),
  ('Sacola kraft', 30, 3600, 'packaging', 1, true, 2),
  ('Plástico bolha', 10, 2511, 'packaging', 1, false, 3),
  ('Caixa dos Correios', 50, 5000, 'packaging', 1, false, 4),
  ('Hidrocor', 24, 1200, 'extra', 1, false, 5),
  ('Suporte de chaveiro', 100, 5000, 'extra', 1, false, 6);

-- What the calculator needs to price a catalog product again: weight, print
-- time, finishing time and materials (shape in lib/costs/calculate.ts).
create table public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  inputs jsonb not null,
  updated_at timestamptz default now()
);

create trigger product_costs_set_updated_at
  before update on public.product_costs
  for each row execute function public.set_updated_at();

alter table public.cost_settings enable row level security;
alter table public.materials enable row level security;
alter table public.product_costs enable row level security;

create policy "cost_settings: admin read" on public.cost_settings
  for select to authenticated using ((select public.is_admin()));
create policy "cost_settings: admin update" on public.cost_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "materials: admin read" on public.materials
  for select to authenticated using ((select public.is_admin()));
create policy "materials: admin insert" on public.materials
  for insert to authenticated with check ((select public.is_admin()));
create policy "materials: admin update" on public.materials
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "materials: admin delete" on public.materials
  for delete to authenticated using ((select public.is_admin()));

create policy "product_costs: admin read" on public.product_costs
  for select to authenticated using ((select public.is_admin()));
create policy "product_costs: admin insert" on public.product_costs
  for insert to authenticated with check ((select public.is_admin()));
create policy "product_costs: admin update" on public.product_costs
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "product_costs: admin delete" on public.product_costs
  for delete to authenticated using ((select public.is_admin()));
