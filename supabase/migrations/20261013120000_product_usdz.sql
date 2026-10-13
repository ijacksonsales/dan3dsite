-- iPhone AR file (USDZ) generated in the admin's browser next to the GLB, so
-- Quick Look opens it directly (`ios-src`) instead of converting on the
-- customer's phone. Path in the `models` bucket; null = let model-viewer
-- generate it on the fly (PLAN.md §5, phase 3).
alter table public.products add column model_usdz_path text;
