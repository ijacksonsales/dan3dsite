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

## 2026-10-09 · Variáveis públicas em `.env` (não `.env.local`)

- **Decisão:** localmente, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` ficam em `.env` (ignorado pelo git, assim como `.env.local`). O `.env.example` mantém só placeholders.
- **Motivo:** foi onde o dono do projeto configurou; o Next lê os dois arquivos.

## 2026-10-09 · Migrations aplicadas com `supabase db push --db-url`

- **Decisão:** `SUPABASE_DB_URL` (string de conexão do Postgres, com a senha do banco) fica em `.dev.vars`, e as migrations são aplicadas com `npx supabase db push --db-url "$SUPABASE_DB_URL"`, que registra o histórico em `supabase_migrations.schema_migrations`.
- **Motivo:** a autorização OAuth do MCP do Supabase falhou ("Unrecognized client_id"); o CLI com a URL do banco não exige login nem `supabase link`.

## 2026-10-09 · `.com.br` na Cloudflare: só DNS, sem transferência

- **Decisão:** adicionar `jailabs.com.br` à Cloudflare com "Add site anyway" (zona DNS no plano Free) e trocar os nameservers no Registro.br, que continua sendo o registrador.
- **Motivo:** a Cloudflare não aceita transferir registro de `.com.br`, mas o plano só precisa do DNS na Cloudflare para o Custom Domain do Worker.

## 2026-10-09 · Fase 1: conversor 3D

- **`three@0.183.2` fixo (não a 0.186):** o `@google/model-viewer@4.4.0` declara `three@^0.183.0` (em 0.x isso aceita só 0.183.\*). Com a mesma versão, há uma cópia só do three no navegador. Subir o three junto com o model-viewer.
- **GLB montado com `@gltf-transform`, sem `GLTFExporter`:** o STL é lido com o `STLLoader` do three, mas a cena glTF é criada direto no `@gltf-transform/core` (um material por cor de filamento). Assim o pipeline inteiro roda em Node nos testes e evita uma cópia extra da geometria no tablet.
- **3MF com parser próprio desde o início:** o `ThreeMFLoader` não segue `p:path` (production extension) do Bambu Studio. A malha é lida com um tokenizador por regex, em vez de árvore XML, porque o XML de um 3MF grande tem centenas de MB; o `fast-xml-parser` fica para os `.config` pequenos do Bambu. Partes com `subtype` diferente de `normal_part` (modificadores, bloqueadores) são ignoradas.
- **Texto do zip com `TextDecoder`:** a decodificação UTF-8 do JSZip é JS puro e era a parte mais lenta no navegador (3,9 s → 2,4 s num 3MF de 620 mil triângulos).
- **Convenção da parede:** peças de parede (placas, relevos) são impressas deitadas de costas. Para `ar_placement = wall` não há rotação: o +Z do fatiador vira a frente (glTF +Z, para fora da parede) e o +Y vira o topo; o modelo fica centrado em X/Y com as costas em z = 0. Para `floor`: rotação −90° em X, centrado em X/Z, base em y = 0. **Validar com uma peça real.** Como a orientação depende disso, a escolha chão/parede precisa ser feita antes de converter (ou converter de novo; o arquivo lido fica em memória no worker).
- **Normais com ângulo de vinco (40°):** curvas suaves, arestas vivas (base reta, quinas) continuam marcadas. Os vértices só são duplicados nos vincos, então a malha continua indexada.
- **Simplificação:** só quando passa de 100 mil triângulos; tenta erros crescentes (0,1% → 10% do tamanho) até caber.
- **Compressão meshopt opcional (`compress`, padrão ligado):** não encontrei confirmação de que o Scene Viewer (AR do Android quando não há WebXR) lê `EXT_meshopt_compression`. Testar no Android; se falhar, salvar o GLB sem compressão (fica ~3× maior, ainda bem abaixo de 3 MB com 100 mil triângulos).
- **`meshoptDecoderLocation` do model-viewer:** sem ele o model-viewer não decodifica meshopt. Ele só carrega a URL como script e usa o decodificador que já vem embutido, então a URL aponta para um arquivo local quase vazio (`public/model-viewer/meshopt-decoder.js`), sem depender de CDN.
- **model-viewer via `next/dynamic` com `ssr: false`** (`components/model-viewer/index.tsx`): um `import()` dentro de `useEffect` ainda punha o model-viewer (com o three) no bundle do servidor (+0,5 MB gzip). `lib/model-converter/index.ts` também não pode importar o pipeline (só `constants.ts`/tipos). Worker: 1,18 MB → 1,29 MB gzip.
- **`/dev/converter`:** liberada em `next dev`; em produção, só para admin logado (`is_admin()`), senão 404. Para testar no tablet/celular antes do login do admin (fase 3): `next dev --experimental-https` pelo IP da rede local.
