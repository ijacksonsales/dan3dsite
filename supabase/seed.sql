-- Sample data for development / first deploy (PLAN.md §5, phase 0).

insert into public.categories (id, name, slug, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Religioso', 'religioso', 1),
  ('00000000-0000-4000-8000-000000000002', 'Infantil', 'infantil', 2)
on conflict (id) do nothing;

insert into public.products (
  id, name, slug, description, category_id, price_cents,
  height_mm, width_mm, depth_mm, ar_placement, status, featured, featured_order
) values (
  '00000000-0000-4000-8000-000000000101',
  'Nossa Senhora Aparecida',
  'nossa-senhora-aparecida',
  'Imagem de Nossa Senhora Aparecida impressa em 3D, com acabamento fosco.',
  '00000000-0000-4000-8000-000000000001',
  8900,
  150, 60, 45,
  'floor', 'published', true, 1
)
on conflict (id) do nothing;

update public.settings
set store_name = 'DAN3D'
where id = 1;

-- To create the admin user (phase 4): create the user in Supabase Auth, then
--   insert into public.admins (user_id) values ('<auth user uuid>');
