-- Custom quote requests sent by visitors from /orcamento (PLAN.md §5, phase 11).
-- The first table visitors write to besides `events`: they never read it, and
-- they only write through submit_quote_request(), which validates every field
-- and rate-limits by phone. Reference photos live in the private bucket
-- `quotes`, at {request_id}/{n}.webp; only admins can see them.

create type public.quote_request_status as enum ('new', 'answered', 'archived');

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity unique, -- "Pedido de orçamento nº 7"
  name text not null check (length(trim(name)) between 1 and 100),
  phone text not null check (phone ~ '^55[0-9]{10,11}$'), -- 55DDDNUMBER
  city text check (city is null or length(city) <= 100),
  -- [{description, quantity, height_mm, width_mm}], normalized by the function.
  items jsonb not null check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 10
  ),
  needed_by date,
  notes text check (notes is null or length(notes) <= 2000),
  -- "I want something like this piece": the product page the visitor came from.
  product_id uuid references public.products(id) on delete set null,
  status public.quote_request_status not null default 'new',
  order_id uuid references public.orders(id) on delete set null,
  archived_at timestamptz,
  photos_removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index quote_requests_status_created_at_idx
  on public.quote_requests (status, created_at desc);
create index quote_requests_phone_created_at_idx
  on public.quote_requests (phone, created_at desc);
create index quote_requests_product_id_idx on public.quote_requests (product_id);
create index quote_requests_order_id_idx on public.quote_requests (order_id);

create trigger quote_requests_set_updated_at
  before update on public.quote_requests
  for each row execute function public.set_updated_at();

alter table public.quote_requests enable row level security;

-- No insert policy: visitors go through submit_quote_request() below.
create policy "quote_requests: admin read" on public.quote_requests
  for select to authenticated using ((select public.is_admin()));
create policy "quote_requests: admin update" on public.quote_requests
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "quote_requests: admin delete" on public.quote_requests
  for delete to authenticated using ((select public.is_admin()));

-- Validates and stores a request. security definer because visitors have no
-- insert or select on the table; everything they send is checked here and
-- the items are rebuilt from known keys only. Returns the id (for the photo
-- folder) and the number (for the WhatsApp message).
create function public.submit_quote_request(
  p_name text,
  p_phone text,
  p_city text,
  p_items jsonb,
  p_needed_by date,
  p_notes text,
  p_product_id uuid
)
returns table (id uuid, number int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_item jsonb;
  v_description text;
  v_quantity int;
  v_height numeric;
  v_width numeric;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 10 then
    raise exception 'between 1 and 10 items' using errcode = '22023';
  end if;

  -- At most 3 requests per phone per hour, and 30 per hour overall.
  if (select count(*) from public.quote_requests q
      where q.phone = p_phone and q.created_at > now() - interval '1 hour') >= 3
    or (select count(*) from public.quote_requests q
      where q.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many quote requests' using errcode = 'P0429';
  end if;

  v_items := '[]'::jsonb;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'invalid item' using errcode = '22023';
    end if;
    v_description := trim(v_item ->> 'description');
    v_quantity := coalesce((v_item ->> 'quantity')::int, 1);
    v_height := (v_item ->> 'height_mm')::numeric;
    v_width := (v_item ->> 'width_mm')::numeric;
    if coalesce(length(v_description), 0) not between 1 and 500
      or v_quantity not between 1 and 999
      or (v_height is not null and v_height not between 1 and 10000)
      or (v_width is not null and v_width not between 1 and 10000) then
      raise exception 'invalid item' using errcode = '22023';
    end if;
    v_items := v_items || jsonb_build_object(
      'description', v_description,
      'quantity', v_quantity,
      'height_mm', v_height,
      'width_mm', v_width
    );
  end loop;

  if p_needed_by is not null and p_needed_by < current_date - 1 then
    raise exception 'needed_by in the past' using errcode = '22023';
  end if;

  return query
  insert into public.quote_requests as q (
    name, phone, city, items, needed_by, notes, product_id
  )
  values (
    trim(p_name),
    p_phone,
    nullif(trim(p_city), ''),
    v_items,
    p_needed_by,
    nullif(trim(p_notes), ''),
    -- Only published products: a draft id must not leak into the request.
    (select p.id from public.products p
     where p.id = p_product_id and p.status = 'published')
  )
  returning q.id, q.number;
end;
$$;

revoke all on function public.submit_quote_request(text, text, text, jsonb, date, text, uuid) from public;
grant execute on function public.submit_quote_request(text, text, text, jsonb, date, text, uuid) to anon, authenticated;

-- Private bucket for reference photos, compressed to WebP in the browser.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quotes', 'quotes', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- A visitor may add photos to a request only right after sending it: the
-- folder must be a request created in the last 30 minutes, still new, with
-- fewer than 5 photos, and the file named {request_id}/{0-4}.webp.
create function public.can_upload_quote_photo(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-4]\.webp$' then
    return false;
  end if;
  v_id := split_part(p_name, '/', 1)::uuid;
  return exists (
    select 1 from public.quote_requests q
    where q.id = v_id
      and q.status = 'new'
      and q.created_at > now() - interval '30 minutes'
  )
  and (
    select count(*) from storage.objects o
    where o.bucket_id = 'quotes' and o.name like v_id::text || '/%'
  ) < 5;
end;
$$;

revoke all on function public.can_upload_quote_photo(text) from public;
grant execute on function public.can_upload_quote_photo(text) to anon, authenticated;

-- No select/update policy for visitors: they cannot list, read or overwrite.
create policy "storage: quote photo upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'quotes' and public.can_upload_quote_photo(name));

create policy "storage: admin read quotes" on storage.objects
  for select to authenticated
  using (bucket_id = 'quotes' and (select public.is_admin()));

create policy "storage: admin delete quotes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'quotes' and (select public.is_admin()));
