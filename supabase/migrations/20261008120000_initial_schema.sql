-- DAN3D initial schema (PLAN.md §4).
-- Units: database in millimetres, GLB in metres, UI in centimetres.

-- Who can administrate. Rows are inserted manually (SQL/seed); there is no public sign-up.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create type public.ar_placement as enum ('floor', 'wall');
create type public.product_status as enum ('draft', 'published');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  price_cents int check (price_cents is null or price_cents >= 0), -- null = "sob consulta"
  height_mm numeric check (height_mm is null or height_mm > 0),   -- real printed size
  width_mm numeric check (width_mm is null or width_mm > 0),
  depth_mm numeric check (depth_mm is null or depth_mm > 0),
  model_path text,          -- GLB path in the `models` bucket
  model_source_path text,   -- original STL/3MF, kept for future reprocessing
  poster_path text,         -- static image shown while the 3D loads
  ar_placement public.ar_placement not null default 'floor',
  status public.product_status not null default 'draft',
  featured boolean not null default false,
  featured_order int,
  made_to_order boolean not null default true, -- "sob encomenda"
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index products_status_idx on public.products (status);
create index products_category_idx on public.products (category_id);
create index products_featured_idx on public.products (featured_order) where featured;
create index products_created_at_idx on public.products (created_at desc);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  alt text,
  sort_order int not null default 0
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_desktop_path text not null,
  image_mobile_path text,   -- falls back to the desktop image when empty
  link_url text,            -- product, category or external URL
  starts_at timestamptz,
  ends_at timestamptz,      -- e.g. a Christmas banner goes offline by itself
  active boolean not null default true,
  sort_order int not null default 0,
  check (starts_at is null or ends_at is null or starts_at < ends_at)
);

-- Simple metrics (replaces paid analytics).
create table public.events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('product_view', 'ar_open', 'whatsapp_click')),
  product_id uuid references public.products (id) on delete cascade,
  created_at timestamptz default now()
);

create index events_created_at_idx on public.events (created_at desc);
create index events_product_idx on public.events (product_id, created_at desc);

-- Single-row settings.
create table public.settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'DAN3D',
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^55[0-9]{10,11}$'), -- 55DDDNUMBER
  instagram_url text,
  about_text text
);

insert into public.settings (id) values (1);

-- Keep products.updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();
