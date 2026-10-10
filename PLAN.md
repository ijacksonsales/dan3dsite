# DAN3D — Catálogo com AR · Plano de implementação

Este é o documento de referência do projeto. Ele foi escrito para ser executado **por fases**: cada fase termina com um critério de pronto testável. Uma fase só começa quando a anterior estiver validada. As decisões marcadas como **fixas** não devem ser trocadas sem conversar antes.

---

## 1. Objetivo

Um site-catálogo para um negócio de impressão 3D (nichos religioso e infantil), com:

- **Vitrine pública:** home com banners e destaques, navegação por categoria, página de produto com fotos, visualizador 3D e **AR em tamanho real**, e encomenda via WhatsApp.
- **Painel admin** para a dona do negócio. Ela usa **apenas um tablet Samsung Galaxy Tab S9 FE+**, sem computador. Pelo painel ela cadastra produtos, sobe o modelo 3D (STL/3MF), define destaques e banners.

**Público do admin:** uma pessoa não técnica, no tablet, muitas vezes com uma mão ocupada. A UX do admin tem a mesma prioridade da vitrine.

**Fora do escopo (por enquanto):** checkout ou pagamento online, estoque, múltiplos usuários admin com papéis diferentes, cores pintadas com o pincel da Bambu (ver fase 5).

---

## 2. Stack (fixa)

| Camada                      | Escolha                                                                    | Motivo                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                   | Next.js (App Router) + TypeScript                                          | SSR para SEO da vitrine. **Fixar uma versão do Next suportada pelo `@opennextjs/cloudflare`** (conferir a matriz de compatibilidade na doc do OpenNext antes de instalar) |
| Estilo                      | Tailwind CSS + shadcn/ui                                                   | Componentes acessíveis e touch-friendly, fáceis de customizar                                                                                                             |
| Backend                     | Supabase (Postgres + Auth + Storage)                                       | Um serviço para banco, login e arquivos; RLS para segurança                                                                                                               |
| Hospedagem                  | Cloudflare Workers via `@opennextjs/cloudflare` (painel "Workers & Pages") | Plano gratuito permite uso comercial. **Não usar `@cloudflare/next-on-pages`**: foi descontinuado em 2025 e a própria Cloudflare indica o adaptador OpenNext              |
| Deploy                      | Workers Builds conectado ao GitHub                                         | Deploy automático a cada push; versões de preview por branch                                                                                                              |
| 3D / AR na vitrine          | `@google/model-viewer`                                                     | Uma tag cobre Android (Scene Viewer), iOS (Quick Look, USDZ gerado a partir do GLB) e WebXR                                                                               |
| Conversão 3D                | three.js (loaders + GLTFExporter) + `@gltf-transform/*` + `meshoptimizer`  | **Tudo roda no navegador do tablet** — sem servidor de processamento                                                                                                      |
| Arrastar e soltar           | `@dnd-kit`                                                                 | Funciona bem com toque                                                                                                                                                    |
| Imagens                     | `browser-image-compression`                                                | Comprime fotos da câmera antes do upload                                                                                                                                  |
| QR code (desktop → celular) | `qrcode`                                                                   | Gerar QR da página do produto                                                                                                                                             |

**Domínio:** `dan3d.jailabs.com.br` como _Custom Domain_ do Worker. **Pré-requisito:** a zona `jailabs.com.br` precisa estar com o DNS na Cloudflare (trocar os nameservers no Registro.br para os da Cloudflare; o plano gratuito de DNS basta). Antes de trocar, recriar na Cloudflare todos os registros DNS atuais do jailabs (site, e-mail/MX, TXT) para nada sair do ar. Um domínio próprio entra depois, no mesmo Worker.

---

## 3. Arquitetura

```
Tablet (admin)                                   Supabase
┌──────────────────────────────┐                ┌───────────────────────┐
│ Upload STL/3MF               │                │ Postgres (RLS)        │
│   → conversor no navegador   │── GLB ────────▶│ Storage: models/      │
│     (escala, eixo, simplif., │── fotos ──────▶│ Storage: images/      │
│      cores, compressão)      │── dados ──────▶│ Auth (e-mail+senha)   │
│ Prévia 3D/AR antes de salvar │                └──────────┬────────────┘
└──────────────────────────────┘                           │ leitura pública
                                                           ▼
                                Next.js no Cloudflare Workers (OpenNext, vitrine SSR)
                                        model-viewer → AR no celular do cliente
```

**Uploads vão direto do navegador para o Supabase Storage.** Eles nunca passam pelo Worker: isso economiza CPU e requisições do plano gratuito e evita limites de corpo de requisição. As escritas usam a sessão autenticada da admin e são protegidas por RLS.

---

## 4. Modelo de dados

Migrations versionadas em `supabase/migrations/`.

```sql
-- Quem pode administrar
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create type ar_placement as enum ('floor', 'wall');
create type product_status as enum ('draft', 'published');

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  price_cents int,                 -- null = "sob consulta"
  height_mm numeric, width_mm numeric, depth_mm numeric,  -- medidas reais da peça impressa
  model_path text,                 -- caminho do GLB no bucket models
  model_source_path text,          -- arquivo original (STL/3MF), para reprocessar no futuro
  poster_path text,                -- imagem estática exibida enquanto o 3D carrega
  ar_placement ar_placement not null default 'floor',
  status product_status not null default 'draft',
  featured boolean not null default false,
  featured_order int,
  made_to_order boolean not null default true,  -- "sob encomenda"
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  path text not null,
  alt text,
  sort_order int not null default 0
);

create table banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_desktop_path text not null,
  image_mobile_path text,          -- se vazio, usa a desktop
  link_url text,                   -- produto, categoria ou externo
  starts_at timestamptz,
  ends_at timestamptz,             -- banner de Natal sai do ar sozinho
  active boolean not null default true,
  sort_order int not null default 0
);

-- Métricas simples (substitui analytics pago)
create table events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('product_view', 'ar_open', 'whatsapp_click')),
  product_id uuid references products(id) on delete cascade,
  created_at timestamptz default now()
);

create table settings (            -- linha única
  id int primary key default 1 check (id = 1),
  store_name text not null default 'DAN3D',
  whatsapp_number text,            -- formato 55DDDNUMERO
  instagram_url text,
  about_text text
);
```

**RLS (obrigatório em todas as tabelas):**

- `select` público: `products` apenas com `status = 'published'`; `banners` apenas ativos e dentro do período; `categories`, `product_images` (de produtos publicados) e `settings` liberados.
- `insert/update/delete`: só se `exists (select 1 from admins where user_id = auth.uid())`. Criar uma função `is_admin()` reutilizável.
- O admin lê tudo, inclusive rascunhos.
- `events`: `insert` liberado para anônimos (só as colunas `type` e `product_id`), `select` só para admin.

**Storage:**

- Buckets `models` e `images`, ambos com leitura pública e escrita só para admin (policies em `storage.objects` usando `is_admin()`).
- Nome dos arquivos: `{product_id}/{timestamp}.glb`. Não sobrescrever o arquivo antigo; apagar depois de salvar o novo, para não quebrar o cache.

---

## 5. Fases

### Fase 0 — Setup

- [x] Criar o projeto com o template oficial: `npm create cloudflare@latest -- dan3d --framework=next --platform=workers` (já traz `@opennextjs/cloudflare`, `wrangler` e `open-next.config.ts`) — _feito com `create-next-app` + `opennextjs-cloudflare migrate`; ver docs/decisions.md_
- [x] Tailwind + shadcn/ui, ESLint, Prettier
- [x] `wrangler.jsonc` com `nodejs_compat` nas compatibility flags; scripts `preview` (roda o build OpenNext localmente no runtime do Workers) e `deploy`
- [x] `next.config`: `images.unoptimized: true` (o otimizador padrão do Next não roda no Workers; as imagens já chegam comprimidas pelo admin)
- [x] Projeto Supabase; variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` (esta só no servidor, como _secret_ do Worker via `wrangler secret put`, nunca exposta ao cliente). Localmente, em `.dev.vars`
- [x] `@supabase/ssr` com clients separados para server components, client components e middleware
- [x] Migrations da seção 4 + seed com 2 categorias e 1 produto de exemplo — _aplicadas em 2026-10-09 com `supabase db push --include-seed`_
- [x] Repositório no GitHub conectado ao Workers Builds (deploy automático na `main`)
- [x] DNS do `jailabs.com.br` migrado para a Cloudflare (ver §2) + Custom Domain `dan3d.jailabs.com.br` no Worker — _em 2026-10-09; Custom Domain declarado em `wrangler.jsonc`_
- [x] Conferir o tamanho do bundle no `wrangler deploy` (ver armadilhas) — _fase 0: 1,15 MiB gzip_

**Pronto quando:** a página "hello" abre em `https://dan3d.jailabs.com.br` e lê o produto de exemplo do banco.

### Fase 1 — Conversor 3D no navegador (maior risco técnico; fazer primeiro)

Módulo isolado em `lib/model-converter/`, sem dependência de UI, com uma página de teste em `/dev/converter` (só em ambiente de desenvolvimento ou para admin).

**Entrada:** arquivo `.stl` ou `.3mf`. **Saída:** `Blob` GLB + metadados `{ heightMm, widthMm, depthMm, triangleCount, fileSizeBytes, warnings[] }`.

Pipeline:

1. **Carregar**
   - STL: `STLLoader` (three/examples/jsm).
   - 3MF: tentar o `ThreeMFLoader`. **Atenção:** arquivos do Bambu Studio usam a _production extension_. O `.model` principal referencia objetos em `3D/Objects/*.model` via `p:path`, e o loader do three pode não resolver isso. Se falhar, implementar um parser próprio com `jszip` + `fast-xml-parser` que leia o modelo principal, siga os `components`/`p:path` e aplique as matrizes `transform`.
   - Se o 3MF tiver vários objetos ou placas, a UI deixa escolher qual converter.
2. **Unidade e escala:** STL é assumido em **mm**. No 3MF, ler o atributo `unit` do `<model>` (padrão: millimeter). Converter tudo para **metros** (glTF), ou seja, ×0,001 para mm.
3. **Eixo:** STL e 3MF são Z-up; glTF é Y-up. Rotacionar −90° em X.
4. **Assentar no chão:** centralizar em X/Z e transladar para `minY = 0`, para a peça não "afundar" nem flutuar no AR.
   - Para `ar_placement = wall`, a face de trás da peça deve ficar no plano da parede. Documentar a convenção e testar com uma peça real.
5. **Cores (só 3MF, peças com partes por filamento):**
   - Cores dos filamentos: `Metadata/project_settings.config` (JSON, chave `filament_colour`, lista de hex).
   - Filamento de cada parte: `Metadata/model_settings.config` (XML, `<metadata key="extruder" value="N"/>` em objetos e partes; a parte herda do objeto se não tiver o seu).
   - Gerar um `MeshStandardMaterial` por cor (roughness ~0,6, metalness 0, que se aproxima de PLA fosco).
   - Triângulos com atributo `paint_color` (pintura com pincel): **ignorar nesta fase**, usar a cor do filamento base e adicionar um warning do tipo "esta peça usa pintura; o 3D aparecerá sem os detalhes de cor".
   - STL: material único, cor padrão configurável (bege claro).
6. **Exportar:** `GLTFExporter` → GLB binário.
7. **Otimizar** com `@gltf-transform` no navegador:
   - `weld` → `simplify` (com `MeshoptSimplifier`). Meta: **≤ 100k triângulos**, com ratio adaptativo para peças muito densas.
   - Compressão `EXT_meshopt_compression` com quantização. O model-viewer decodifica meshopt.
   - Meta de arquivo: **≤ 3 MB** (warning acima de 5 MB).
8. **Medir:** bounding box final → `heightMm/widthMm/depthMm`.
9. **Rodar em Web Worker** para não travar a UI do tablet, com barra de progresso por etapa.

**Pronto quando:**

- [ ] Um STL de referência com altura conhecida (ex.: 150 mm) gera um GLB cuja altura medida no AR, num Android e num iPhone, bate com a peça física (tolerância ±2%). — _iPhone ok (peça de parede, dentro de ±2%, 2026-10-10); falta Android_
- [ ] Um 3MF do Bambu Studio com partes em filamentos diferentes aparece com as cores corretas. — _ok com 3MF sintético no formato do Bambu; falta um arquivo real_
- [ ] A conversão de um arquivo de ~30 MB termina no Galaxy Tab S9 FE+ sem travar a interface. — _no PC: STL de 30 MB em ~3 s, sem travar (Web Worker); falta o tablet_
- [x] Testes unitários cobrem a escala, a rotação de eixo e o assentamento no chão (bbox antes e depois). — _`lib/model-converter/*.test.ts`_

### Fase 2 — Vitrine pública

Mobile-first. Desempenho alvo: Lighthouse mobile ≥ 90 em Performance nas páginas de home e produto.

- [ ] **Layout:** header com logo e busca simples; menu de categorias; footer com WhatsApp e Instagram (de `settings`).
- [ ] **Home:** carrossel de banners (respeitando datas, com imagem mobile quando houver, swipe por toque), faixa de destaques ordenada por `featured_order`, grade de categorias e produtos recentes.
- [ ] **Categoria** `/c/[slug]`: grade de produtos.
- [ ] **Produto** `/p/[slug]`:
  - galeria de fotos com swipe e zoom;
  - nome, preço ou "sob consulta", medidas em cm, selo "sob encomenda";
  - **visualizador 3D** (`model-viewer`), carregado só no cliente, com `poster`, `loading="lazy"`, `camera-controls`, `ar`, `ar-modes="webxr scene-viewer quick-look"`, **`ar-scale="fixed"`**, `ar-placement` vindo do produto;
  - botão customizado no slot `ar-button`: **"Ver no meu espaço"**;
  - **peça de parede:** antes de abrir o AR, uma tela curta de orientação ("Aponte para a parede a cerca de 1 metro, com boa luz, e mova o celular devagar de um lado para o outro. Paredes lisas e portas podem demorar; se não aparecer, mire perto de um quadro, tomada ou batente."), com opção de não mostrar de novo (ver `docs/decisions.md`, 2026-10-10);
  - no iPhone, usar o USDZ salvo no cadastro (`ios-src`) quando existir, em vez de gerar na hora;
  - no desktop (sem suporte a AR): QR code apontando para a URL da página, com o texto "Aponte a câmera do celular para ver em tamanho real";
  - botão **"Encomendar pelo WhatsApp"** → `https://wa.me/{numero}?text=` com nome, link e medidas da peça (encodeURIComponent).
- [ ] **SEO:** `generateMetadata` por produto, imagem OG a partir da primeira foto, `sitemap.xml`, `robots.txt`.
- [ ] **Renderização:** começar com **renderização dinâmica** (sem ISR) — as consultas ao Supabase são rápidas e a mudança feita no admin aparece na hora. ISR no OpenNext exige configurar cache incremental (R2) e cache de tags; só adotar se a CPU por requisição ou a latência virarem problema, e registrar a decisão em `docs/decisions.md`.
- [ ] **Métricas:** registrar `product_view`, `ar_open` (evento `ar-status` do model-viewer) e `whatsapp_click` na tabela `events`, sem bloquear a navegação (fire-and-forget).

**Pronto quando:** um produto publicado abre no celular, o AR funciona em Android e iPhone com tamanho fixo, e o botão do WhatsApp abre a conversa com a mensagem preenchida.

### Fase 3 — Painel admin (`/admin`)

**Diretrizes de UX** (valem para todo o painel):

- Projetado para **tablet em retrato e paisagem**: alvos de toque ≥ 48 px, formulários em uma coluna, botão principal fixo no rodapé ("Salvar").
- Linguagem simples, sem jargão: "Modelo 3D", e não "GLB"; "Rascunho / Publicado"; "Peça na parede / Peça no chão ou mesa".
- Upload de foto com opção de **tirar foto com a câmera** (`accept="image/*"` + `capture` opcional) e da galeria.
- Feedback sempre visível: progresso de upload e conversão, toast de sucesso, erros em português com orientação do que fazer.
- **Autosave de rascunho local** do formulário, para não perder nada se o app fechar.
- Nunca apagar sem confirmação; preferir "arquivar/despublicar" a excluir.

**Telas:**

- [ ] **Login:** e-mail + senha (magic link é ruim no tablet, porque abre em outro navegador), sessão persistente. Middleware protege `/admin/*` e verifica `is_admin()`.
- [ ] **Início do admin:** atalhos grandes (Novo produto · Produtos · Destaques · Banners · Categorias · Configurações) + contagem de rascunhos.
- [ ] **Produtos:** lista com busca, filtro por categoria e status, miniatura; ações rápidas (publicar/despublicar, destacar).
- [ ] **Novo/editar produto:**
  1. Fotos (várias, reordenar arrastando, a primeira é a capa)
  2. Nome (slug gerado automaticamente, editável), categoria, descrição, preço (opcional)
  3. **Modelo 3D:** escolher STL/3MF → conversor da fase 1 com progresso → exibe **"Altura detectada: 15,2 cm · Largura: 8,0 cm — confere com a peça?"**, com opção de corrigir a altura real (reescala uniforme) → visualizador 3D de prévia → botão **"Testar no meu espaço"** (AR no próprio tablet) antes de salvar
  4. Tipo de exibição no AR: chão/mesa ou parede
  5. Poster: gerado automaticamente via `toDataURL()` do model-viewer, com opção de usar a capa
  6. **USDZ para iPhone:** gerado no navegador junto com o GLB (`USDZExporter` do three, com âncora horizontal ou vertical conforme o tipo de exibição) e salvo no bucket `models`; exige a coluna `model_usdz_path` (nova migration). Tira a espera da geração na hora em que o cliente toca em "Ver no meu espaço".
  7. Salvar como rascunho ou publicar
- [ ] **Destaques:** lista dos produtos destacados, reordenáveis com `@dnd-kit` (toque), e botão para adicionar a partir da lista de produtos.
- [ ] **Banners:** CRUD com upload de imagem desktop e mobile, título e subtítulo opcionais, link (seletor de produto/categoria ou URL), período de exibição, ativo/inativo, ordem arrastável. Prévia de como fica no celular.
- [ ] **Categorias:** CRUD + ordem arrastável.
- [ ] **Configurações:** nome da loja, número de WhatsApp (com validação e botão "testar"), Instagram, texto "sobre".
- [ ] **Imagens:** comprimir no cliente antes do upload (WebP, máx. 2000 px no lado maior, ~85% de qualidade).

**Pronto quando:** a dona do negócio, sozinha no tablet e sem instruções além de uma conversa curta, cadastra um produto completo com 3D e AR, cria um banner e reordena os destaques.

### Fase 4 — Produção e testes

- [x] Domínio `dan3d.jailabs.com.br` com HTTPS no Worker (certificado é automático no Custom Domain) — _feito na fase 0_
- [ ] Criar a usuária admin (inserir o `user_id` em `admins` via SQL/seed; **não existe cadastro público**)
- [ ] Checklist em dispositivos reais:
  - Galaxy Tab S9 FE+ (admin completo + AR)
  - um Android intermediário (AR via Scene Viewer)
  - um iPhone com Safari (AR via Quick Look; conferir a geração automática do USDZ pelo model-viewer)
  - desktop (3D + QR code)
- [ ] Teste de escala com 3 peças reais de tamanhos diferentes (fita métrica vs AR)
- [ ] Páginas de erro (404/500) amigáveis
- [ ] Cloudflare Web Analytics (gratuito) para visitas gerais
- [ ] No admin, um painel simples a partir da tabela `events`: peças mais vistas, aberturas de AR e cliques no WhatsApp nos últimos 30 dias
- [ ] Ping agendado para o Supabase não pausar (ver armadilhas)

### Fase 5 — Futuro (não implementar agora)

- Decodificar a pintura com pincel da Bambu (`paint_color`, formato herdado do PrusaSlicer) → vertex colors ou textura
- Domínio próprio da marca
- Páginas de série/coleção (ex.: presépio anual) e certificado de autenticidade com link via NFC/QR na embalagem
- Catálogo em PDF gerado automaticamente para enviar no WhatsApp

---

## 6. Armadilhas conhecidas

1. **Escala mm × m:** sem o ×0,001 a peça aparece 1000× maior no AR. Sempre exibir as medidas detectadas para conferência.
2. **Eixo Z-up × Y-up:** sem a rotação a peça aparece deitada.
3. **`ar-scale="fixed"`** é obrigatório. Sem ele o cliente redimensiona a peça e o propósito do AR se perde.
4. **AR exige HTTPS.** Para testar no celular, usar as URLs de preview do Workers Builds (`*.workers.dev`) ou `next dev --experimental-https` acessando pelo IP da rede local. Antes de cada deploy, rodar `npm run preview` para pegar incompatibilidades do runtime do Workers que o `next dev` não mostra.
5. **model-viewer é Web Component:** importar só no cliente (`dynamic(..., { ssr: false })` ou `useEffect`) e declarar o tipo JSX em `types/model-viewer.d.ts`.
6. **Uploads fora do Worker:** nunca subir arquivos por rotas `/api` ou server actions; o upload vai direto ao Supabase Storage.
7. **3MF da Bambu** usa _production extension_ (objetos em arquivos separados) — ver fase 1.
8. **Peso no tablet:** conversão em Web Worker, liberar memória entre etapas e evitar manter várias cópias da geometria.
9. **Supabase no plano gratuito pausa projetos inativos** depois de alguns dias sem atividade. Resolver com um ping agendado (GitHub Actions com `schedule` fazendo uma consulta leve à API do Supabase), ou fazer o upgrade.
10. **Limites do plano gratuito do Workers:** o tamanho do Worker comprimido tem teto baixo no plano gratuito (maior no pago) e o tempo de CPU por requisição também é curto. Por isso:
    - three.js, gltf-transform, meshoptimizer e o conversor só podem ser importados em código cliente (`"use client"`/Web Worker), **nunca** em server components, route handlers ou middleware;
    - conferir o tamanho informado pelo `wrangler deploy` a cada fase;
    - se estourar CPU ou tamanho mesmo assim, o plano pago do Workers (US$ 5/mês) é a saída — registrar a decisão.
11. **OpenNext não roda o runtime "edge" do Next:** não usar `export const runtime = 'edge'` (sobra de tutoriais do next-on-pages).
12. **Imagens:** com `images.unoptimized`, o `next/image` serve o arquivo original — por isso a compressão no cliente (fase 3) é obrigatória, não opcional.
13. **Cache de imagens/modelos:** como os nomes de arquivo levam timestamp, nunca sobrescrever o mesmo caminho.

---

## 7. Estrutura de pastas sugerida

```
app/
  (store)/            # vitrine pública
    page.tsx
    c/[slug]/page.tsx
    p/[slug]/page.tsx
  admin/
    login/page.tsx
    page.tsx
    produtos/ destaques/ banners/ categorias/ configuracoes/
  dev/converter/page.tsx
components/
  store/  admin/  ui/   # ui = shadcn
  model-viewer/ModelViewer.tsx
lib/
  supabase/ (server.ts, client.ts, middleware.ts)
  model-converter/ (index.ts, worker.ts, stl.ts, threemf.ts, bambu.ts, optimize.ts, measure.ts)
  images/compress.ts
  whatsapp.ts
supabase/
  migrations/  seed.sql
types/
  model-viewer.d.ts
open-next.config.ts
wrangler.jsonc
.dev.vars              # segredos locais (no .gitignore)
.github/workflows/supabase-ping.yml
```
