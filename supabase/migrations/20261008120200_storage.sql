-- Storage buckets (PLAN.md §4). Public read via public URLs; writes only for admins.
-- File names: {product_id}/{timestamp}.ext — never overwrite a path (cache safety).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- GLB (≤ 3 MB target) plus the original STL/3MF source (can be ~30 MB).
  -- No MIME allow-list: browsers report STL/3MF inconsistently.
  ('models', 'models', true, 52428800, null),
  -- Photos are compressed to WebP in the browser before upload.
  ('images', 'images', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Public buckets serve files by URL without a select policy, so anonymous users
-- get no listing access. Admins need select for update/delete/list in the panel.
create policy "storage: admin read" on storage.objects
  for select to authenticated
  using (bucket_id in ('models', 'images') and (select public.is_admin()));

create policy "storage: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('models', 'images') and (select public.is_admin()));

create policy "storage: admin update" on storage.objects
  for update to authenticated
  using (bucket_id in ('models', 'images') and (select public.is_admin()))
  with check (bucket_id in ('models', 'images') and (select public.is_admin()));

create policy "storage: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('models', 'images') and (select public.is_admin()));
