-- Row Level Security (PLAN.md §4). Every table has RLS; writes only via is_admin().

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.banners enable row level security;
alter table public.events enable row level security;
alter table public.settings enable row level security;

-- admins: readable by admins only; managed by SQL (service role), never from the app.
create policy "admins: admin read" on public.admins
  for select to authenticated using ((select public.is_admin()));

-- categories: public read, admin write.
create policy "categories: public read" on public.categories
  for select to anon, authenticated using (true);
create policy "categories: admin insert" on public.categories
  for insert to authenticated with check ((select public.is_admin()));
create policy "categories: admin update" on public.categories
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: admin delete" on public.categories
  for delete to authenticated using ((select public.is_admin()));

-- products: public sees published only; admin sees everything (drafts included).
create policy "products: public read published" on public.products
  for select to anon, authenticated using (status = 'published');
create policy "products: admin read all" on public.products
  for select to authenticated using ((select public.is_admin()));
create policy "products: admin insert" on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy "products: admin update" on public.products
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products: admin delete" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- product_images: public sees images of published products only.
create policy "product_images: public read of published" on public.product_images
  for select to anon, authenticated using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );
create policy "product_images: admin read all" on public.product_images
  for select to authenticated using ((select public.is_admin()));
create policy "product_images: admin insert" on public.product_images
  for insert to authenticated with check ((select public.is_admin()));
create policy "product_images: admin update" on public.product_images
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "product_images: admin delete" on public.product_images
  for delete to authenticated using ((select public.is_admin()));

-- banners: public sees active banners inside their display window.
create policy "banners: public read active" on public.banners
  for select to anon, authenticated using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );
create policy "banners: admin read all" on public.banners
  for select to authenticated using ((select public.is_admin()));
create policy "banners: admin insert" on public.banners
  for insert to authenticated with check ((select public.is_admin()));
create policy "banners: admin update" on public.banners
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "banners: admin delete" on public.banners
  for delete to authenticated using ((select public.is_admin()));

-- events: anyone can insert (only `type` and `product_id`), only admin reads.
revoke insert, update, delete on public.events from anon, authenticated;
grant insert (type, product_id) on public.events to anon, authenticated;

create policy "events: public insert" on public.events
  for insert to anon, authenticated with check (
    product_id is null
    or exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );
create policy "events: admin read" on public.events
  for select to authenticated using ((select public.is_admin()));

-- settings: public read, admin update (the single row already exists).
create policy "settings: public read" on public.settings
  for select to anon, authenticated using (true);
create policy "settings: admin update" on public.settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
