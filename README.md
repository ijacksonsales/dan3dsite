# DAN3D

Catálogo de peças impressas em 3D com AR em tamanho real. Plano em [`PLAN.md`](PLAN.md), decisões em [`docs/decisions.md`](docs/decisions.md).

Stack: Next.js 16.3 (App Router) · Tailwind + shadcn/ui · Supabase · Cloudflare Workers via `@opennextjs/cloudflare`.

## Rodando localmente

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha a URL e a anon key do Supabase.
3. Copie `.dev.vars.example` para `.dev.vars` e preencha `SUPABASE_SERVICE_ROLE_KEY`.
4. `npm run dev` → http://localhost:3000

Antes de todo deploy: `npm run preview` (build OpenNext rodando no runtime do Workers, local).

## Banco de dados

Migrations em `supabase/migrations/`, dados de exemplo em `supabase/seed.sql`. Com a Supabase CLI ligada ao projeto:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
psql "<connection string>" -f supabase/seed.sql   # ou cole no SQL Editor
```

## Scripts

`dev` · `build` · `lint` · `typecheck` · `test` · `format` · `preview` · `deploy`
