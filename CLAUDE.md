# DAN3D — guia para o Claude Code

Catálogo de peças impressas em 3D com AR em tamanho real e painel admin usado em **tablet**. O plano completo, com fases e critérios de pronto, está em `PLAN.md`. Leia antes de começar qualquer tarefa e trabalhe **uma fase por vez**.

## Regras do projeto

- Stack fixa (ver PLAN.md §2): Next.js App Router + TS, Tailwind + shadcn/ui, Supabase, model-viewer, three.js + gltf-transform. Não troque bibliotecas sem perguntar.
- Hospedagem: **Cloudflare Workers via `@opennextjs/cloudflare`**. Nunca use `@cloudflare/next-on-pages` nem `export const runtime = 'edge'`.
- three.js, gltf-transform, meshoptimizer e o conversor ficam **só no cliente** (o Worker tem limite de tamanho e de CPU).
- `next/image` com `images.unoptimized: true`; segredos via `wrangler secret put` (local: `.dev.vars`).
- **Textos da interface em português do Brasil**, simples e sem jargão técnico. Código, nomes de variáveis e commits em inglês.
- **Mobile-first sempre.** O admin é usado num Galaxy Tab S9 FE+: alvos de toque ≥ 48 px, uma coluna, ação principal fixa no rodapé.
- Unidades: banco em **mm**, GLB em **metros**, interface em **cm**.
- Uploads vão direto do navegador para o Supabase Storage, nunca por rotas `/api`.
- Toda tabela nova tem RLS; escrita só via `is_admin()`. Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` ao cliente.
- Schema muda só por migration em `supabase/migrations/`. Não rode comandos destrutivos (reset, drop) sem confirmação.
- model-viewer só no cliente; o tipo JSX fica em `types/model-viewer.d.ts`.

## Fluxo de trabalho

- Antes de codar uma fase, liste os passos e confirme.
- Ao terminar, rode lint, typecheck e testes, e mostre como validar o critério de pronto (inclusive teste em dispositivo real quando houver AR).
- Marque os checkboxes do `PLAN.md` conforme concluir.
- Registre decisões novas ou desvios do plano em `docs/decisions.md` (data + decisão + motivo).

## Comandos

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`
- `npm run preview` (build OpenNext no runtime do Workers, local) — rode antes de todo deploy · `npm run deploy`
- Teste de AR no celular: URL de preview `*.workers.dev` do Workers Builds ou `next dev --experimental-https` pelo IP local.
