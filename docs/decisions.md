# Decisões e desvios do plano

Formato: data · decisão · motivo.

## 2026-10-08 · Projeto criado com `create-next-app` + `opennextjs-cloudflare migrate`

- **Decisão:** em vez de `npm create cloudflare@latest -- --framework=next --platform=workers`, o projeto foi criado com `create-next-app` (depois fixado em 16.3.8, ver abaixo) e convertido com `npx opennextjs-cloudflare migrate`.
- **Motivo:** o template do C3 (create-cloudflare 2.73) passou a gerar um projeto **vinext** (Vite + `@vinext/cloudflare`), não Next.js com `@opennextjs/cloudflare`. Isso quebraria a stack fixa (PLAN.md §2). O `migrate` é o caminho documentado pelo OpenNext e produz o mesmo resultado: `wrangler.jsonc`, `open-next.config.ts`, scripts `preview`/`deploy`.

## 2026-10-08 · Versões fixadas

- **Decisão:** `next@16.3.8` (exata, com `eslint-config-next@16.3.8`) e `@opennextjs/cloudflare@1.20.9` (exata), `wrangler@4`.
- **Motivo:** PLAN.md §2 exige uma versão de Next suportada pelo adaptador. O peer do OpenNext aceita `>=16.3.8`, mas o **Next 16.4.0 quebra em runtime**: ele lê `.next/server/preview-props.json`, que o patch `inline-load-manifest` do OpenNext 1.20.9 não embute, e toda rota dinâmica responde 500 (`Unexpected loadManifest(/.next/server/preview-props.json) call!`). Com 16.3.8 o `npm run preview` funciona. Só subir o Next depois de confirmar no `preview`.
- **`esbuild` na raiz (`^0.27`):** o `@opennextjs/cloudflare` importa `esbuild` sem declará-lo e esperava o do `@opennextjs/aws` (0.25.4) içado; o `vite` do Vitest exige `^0.27 || ^0.28`. A 0.27 na raiz atende os dois e o build do OpenNext passa.

## 2026-10-08 · `middleware.ts` em vez de `proxy.ts`

- **Decisão:** manter o arquivo `middleware.ts` (runtime edge), apesar de o Next 16 o marcar como depreciado em favor de `proxy.ts`.
- **Motivo:** o `proxy.ts` roda no runtime Node.js, que o `@opennextjs/cloudflare` 1.20.9 trata como **experimental e sem suporte oficial** no Workers. Reavaliar quando o OpenNext suportar oficialmente.
- O middleware só roda em `/admin/*`: a vitrine não precisa de sessão, e isso economiza CPU do Worker.

## 2026-10-08 · Sem `cacheComponents` / `partialPrefetching`

- **Decisão:** removidas as flags que o `create-next-app` 16.4 liga por padrão.
- **Motivo:** o plano pede renderização dinâmica simples (PLAN.md §5, fase 2), sem ISR nem cache incremental. `cacheComponents` muda o modelo de renderização (exige `Suspense`/`"use cache"`) e depende de cache no OpenNext.

## 2026-10-08 · Sem cache incremental (R2) e sem binding `IMAGES`

- **Decisão:** `open-next.config.ts` sem `incrementalCache`; removido o binding `IMAGES` do `wrangler.jsonc`.
- **Motivo:** renderização dinâmica (sem ISR) e `images.unoptimized: true`, conforme o plano.

## 2026-10-08 · Variáveis públicas em `.env.local`, segredos em `.dev.vars`

- **Decisão:** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` ficam em `.env.local` (local) e como _build variables_ no Workers Builds. `SUPABASE_SERVICE_ROLE_KEY` fica em `.dev.vars` (local) e via `wrangler secret put` (produção).
- **Motivo:** variáveis `NEXT_PUBLIC_*` são embutidas no bundle durante o `next build`, então precisam existir no build, não só no runtime do Worker.

## 2026-10-08 · Detalhes do schema além do PLAN.md §4

- `events`: insert anônimo limitado às colunas `type` e `product_id` por _column grant_, e só para produtos publicados (ou sem produto).
- `settings`: a linha única é criada na migration; o admin só faz `update`.
- `whatsapp_number` validado no banco (`^55[0-9]{10,11}$`); `price_cents`/medidas não negativos; banner com `starts_at < ends_at`.
- Trigger `set_updated_at` em `products`.
- Buckets: `models` até 50 MB (o STL/3MF original pode ter ~30 MB), sem lista de MIME (navegadores informam STL/3MF de forma inconsistente); `images` até 10 MB, só WebP/JPEG/PNG. Sem policy de `select` pública em `storage.objects`: arquivos públicos são servidos por URL, e anônimos não conseguem listar o bucket.

## 2026-10-08 · Testes com Vitest

- **Decisão:** Vitest para testes unitários (confirmado com o dono do projeto).
