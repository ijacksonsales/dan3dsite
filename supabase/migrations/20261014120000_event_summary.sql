-- Per-product counts for the admin metrics panel (PLAN.md §5, phase 4).
-- Aggregating in SQL keeps the panel right past PostgREST's row limit.
-- security invoker: the events RLS still applies, so only admins get rows
-- (anyone else gets an empty result). Uses events_created_at_idx.
create function public.event_summary(since timestamptz)
returns table (
  product_id uuid,
  product_views bigint,
  ar_opens bigint,
  whatsapp_clicks bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.product_id,
    count(*) filter (where e.type = 'product_view'),
    count(*) filter (where e.type = 'ar_open'),
    count(*) filter (where e.type = 'whatsapp_click')
  from public.events e
  where e.created_at >= since
  group by e.product_id;
$$;

revoke all on function public.event_summary(timestamptz) from public, anon;
grant execute on function public.event_summary(timestamptz) to authenticated;
