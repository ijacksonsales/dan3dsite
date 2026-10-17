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

## 2026-10-10 · AR de parede no iPhone: orientação e USDZ pré-gerado

- **Teste:** disco de 20 × 20 × 2,5 cm como "peça na parede" no iPhone: tamanho real dentro de ±2%. Numa porta lisa, o Quick Look levou 2–3 min para achar o plano, às vezes sem conseguir; numa parede comum funcionou.
- **Causa:** quem detecta a parede é o ARKit (Quick Look), fora do controle do site. Superfícies verticais lisas, de cor única ou brilhantes quase não têm pontos de referência para a câmera; iPhones sem LiDAR sofrem mais.
- **Decisão:** (1) fase 2: para peças de parede, mostrar uma orientação curta antes de abrir o AR (distância de ~1 m, boa luz, mover devagar, mirar perto de batente/quadro/tomada); (2) fase 3: gerar o USDZ no navegador durante o cadastro e servir via `ios-src`, para cortar a espera da conversão feita pelo model-viewer na hora do toque. O USDZ precisa levar a âncora vertical (peça de parede) ou horizontal, porque o `ar-placement` do model-viewer não altera um USDZ pronto.
- **Motivo:** a detecção do plano não pode ser acelerada pelo site; o que dá para fazer é orientar o cliente e eliminar a espera que depende de nós. A fase 1 (conversor) fica sem mudanças.

## 2026-10-10 · Fase 2: vitrine pública

- **Identidade visual:** logo da DAN3D (originais em `docs/brand/`) recortado em símbolo + nome (`public/brand/`, versões escura e clara), ícones do site e imagem padrão de compartilhamento. Paleta bege/café tirada do logo (`#20130A`, `#4D3827`, fundo `#FAF6F0`); títulos em Jost (letras geométricas como as do logo), texto em Geist.
- **Sem biblioteca de carrossel ou de zoom:** banners e galeria usam CSS scroll-snap; a foto em tela cheia tem pinça, arrasto e toque duplo próprios (`components/store/zoomable-image.tsx`). Menos JavaScript no celular.
- **Banners com `<picture>`** (imagem de celular e de computador) em vez de `next/image`, que não faz direção de arte e não otimiza nada com `images.unoptimized`. Proporções: celular 4:5, computador 5:2 (orientar o admin na fase 3).
- **Menu de categorias** como faixa de chips deslizável abaixo do cabeçalho, em vez de menu gaveta: um toque a menos no celular. A busca é uma página (`/busca?q=`) com formulário GET, que funciona antes do JavaScript carregar.
- **`ar_open` no toque em "Ver no meu espaço"**, não no evento `ar-status`: no iPhone o Quick Look abre fora da página e o `ar-status` não dispara, então a métrica perderia todos os iPhones.
- **Orientação de parede antes do AR:** o `ModelViewer` ganhou `beforeAr`, que intercepta o clique no botão de AR (ouvinte nativo no botão, que roda antes do ouvinte do model-viewer) e abre o AR depois, ainda dentro do toque do usuário (exigência do iOS). "Não mostrar de novo" fica no `localStorage` do aparelho.
- **Métricas direto para o REST do Supabase** (`fetch` com `keepalive`), sem `supabase-js` no navegador: menos JavaScript e o registro do clique no WhatsApp não se perde quando a página muda.
- **Desempenho:** o model-viewer (three.js, ~225 KB) só carrega quando a área do 3D chega perto da tela; `preconnect` para o Supabase (com e sem CORS: fotos vs. modelo/métricas); fonte mono sem preload. Lighthouse mobile no `npm run preview`: home 92–93, produto 88–92. O Worker foi de 1,29 para 1,57 MiB gzip (limite do plano gratuito: 3 MiB).
- **Dados de exemplo no Supabase (projeto de produção):** fotos e modelo 3D gerados para "Nossa Senhora Aparecida", um banner de exemplo e o produto "Placa Estrela (exemplo)" (`00000000-0000-4000-8000-000000000102`, parede, para testar a orientação). Tudo marcado como exemplo; apagar antes de abrir a loja (fase 4), junto com os arquivos em `models/` e `images/` dessas pastas e em `images/banners/`.

## 2026-10-10 · Worker rodando perto do Supabase (placement)

- **Decisão:** `placement: { mode: "targeted", region: "aws:us-west-2" }` no `wrangler.jsonc`, para o Worker rodar perto do Supabase (West US, Oregon).
- **Motivo:** no domínio publicado, o Lighthouse deu 81–89 em Performance (meta ≥ 90), com o HTML levando 0,4–1,4 s. Cada página faz várias consultas ao Supabase; com o Worker no Brasil (edge GIG), cada consulta cruzava o continente. Com o Worker no Oregon, só o HTML pronto faz essa viagem, uma vez. Arquivos estáticos (`/_next`, `/brand`) continuam servidos pela borda.
- **Se não bastar:** guardar em cache as consultas que se repetem em toda página (categorias e configurações) ou mudar o projeto Supabase para São Paulo (exige migrar o banco e o Storage).
- **Resultado (2026-10-10):** o HTML caiu de ~0,8 s para ~0,45 s (mediana, medida do Brasil; resposta com `cf-placement: remote-SEA`). O Lighthouse mobile ficou em 83–85, porque o gargalo passou a ser outro: na simulação de 4G lento, a imagem principal (banner/foto) vem do Supabase, outro domínio, e espera ~2 s para começar a baixar (abrir conexão nova). Tirar o preload das fontes não mudou a nota (mantido: não piora nada e alivia conexões lentas). Na prática, a imagem chega em ~1,5 s no navegador sem limitação.
- **Próximo passo possível (não feito):** servir fotos e banners pelo próprio `dan3d.jailabs.com.br` (mesma conexão do HTML). Pelo Worker é ruim: ele agora roda no Oregon, então as imagens ficariam mais lentas para o cliente no Brasil. Um subdomínio (R2 com domínio próprio, por exemplo) continua sendo outra origem e não resolve. Avaliar na fase 4, junto com o teste em aparelhos reais: a nota de laboratório não reflete o tempo real, que já é bom.

## 2026-10-13 · Testes de AR em aparelhos e ajustes adiados

- **iPhone:** as duas peças de exemplo abriram no AR e ficaram paradas no lugar. **Problema:** o Quick Look deixou mudar o tamanho com pinça, apesar de `ar-scale="fixed"`. Hipótese: o model-viewer manda `#allowsContentScaling=0` junto do USDZ gerado na hora (URL `blob:`), e o Quick Look ignora esse parâmetro nesse caso. A correção prevista é servir um USDZ pré-gerado no cadastro (fase 3, `ios-src`) e conferir de novo.
- **Android (POCO C71):** o 3D abre na página, mas o AR não abre. O "Google Play Services para AR" não aparece na Play Store desse aparelho, ou seja, ele não tem ARCore. Sem ARCore nenhuma solução web mostra a peça em tamanho real. Falta testar num Android compatível (confirmar na Play Store antes).
- **Sistemas de AR prontos:** avaliados e descartados. O AR em tamanho real no celular depende do ARKit/Quick Look (iPhone) e do ARCore (Android), que o model-viewer já usa. As plataformas prontas usam os mesmos recursos (no iPhone o Safari só permite o Quick Look) ou são pagas.
- **Adiado a pedido do dono do projeto (seguir com a fase 3 primeiro):** (1) GLB sem compressão meshopt, se o Scene Viewer não ler; (2) USDZ pré-gerado para travar o tamanho no iPhone; (3) botão "Encomendar pelo WhatsApp" dentro do AR (faixa do Quick Look no iPhone; parâmetros `title`/`link` do Scene Viewer no Android).

## 2026-10-13 · Fase 3: login e início do admin

- **Login no navegador** (`signInWithPassword` do `@supabase/ssr`), não por server action: a sessão fica em cookies persistentes e o middleware já a renova. Depois do login volta para a página pedida (`?next=`), aceitando só caminhos de `/admin` (`lib/admin/paths.ts`) para não virar redirecionamento aberto.
- **Telas do painel no grupo `app/admin/(panel)/`**, com cabeçalho (Ver loja, Sair); o login fica fora do grupo, sem cabeçalho.
- **Contas de admin por script** (`scripts/create-admin.mjs`, com a service role do `.dev.vars`): cria a conta já confirmada com senha provisória de 12 letras/números fáceis de digitar e insere em `admins`. Se a conta já existir, só a promove. Falta uma tela "Trocar senha" (entra junto com Configurações).

## 2026-10-13 · Fase 3: categorias, arrastar e avisos

- **`@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0` + `@dnd-kit/utilities@3.2.2`** (da stack do plano). A lista arrastável fica em `components/admin/sortable-list.tsx` para servir também a destaques e banners. Só a alça (⋮⋮, 48 px) inicia o arraste, então o resto da linha continua rolando a página no tablet; o teclado também funciona, com instruções em português para leitor de tela.
- **Ordem gravada logo ao soltar**, sem botão "Salvar": só as linhas que mudaram de posição são atualizadas (`lib/admin/reorder.ts`). Se falhar, a lista volta como estava e aparece o aviso de erro.
- **Avisos (toast) próprios** (`components/admin/toast.tsx`), sem biblioteca: uma mensagem por vez, acima da barra do rodapé; erros ficam 7 s.
- **Excluir categoria** é permitido, com confirmação que diz quantas peças ficam sem categoria (elas continuam na loja; `on delete set null`). Categoria não tem "arquivar", diferente dos produtos.
- **Escritas do painel verificam a linha de volta** (`.select("id")`): com RLS, um update bloqueado não dá erro, só não altera nada.

## 2026-10-13 · Fase 3: produtos (lista e cadastro)

- **Lista** (`/admin/produtos`): filtros na URL (`?q=&status=&categoria=`, `categoria=sem` = sem categoria) para "voltar" manter a busca; ordem por data de criação (não por última alteração, senão a linha pula ao tocar na estrela). Ações rápidas: estrela (destaque, entra no fim da ordem) e interruptor "Na loja/Rascunho". Não há excluir: tirar da loja é o "arquivar".
- **Cadastro em uma página com seções numeradas** (Fotos · Informações · Modelo 3D · Medidas · Imagem de espera), botões fixos no rodapé: "Salvar rascunho"/"Publicar" (ou "Tirar da loja"/"Salvar" se já publicado). Publicar exige ao menos uma foto.
- **O id do produto novo nasce no servidor da página** (`crypto.randomUUID()`), para os arquivos subirem em `{product_id}/…` antes de a linha existir.
- **Ordem do salvamento** (`lib/admin/save-product.ts`): confere o endereço → envia fotos, GLB, original e USDZ com nomes novos (timestamp) → grava a linha e as fotos → só então apaga os arquivos que nada mais usa. Uma falha no meio deixa no máximo arquivos órfãos, nunca um produto apontando para arquivo apagado.
- **Fotos:** `browser-image-compression@2.0.2` (da stack), WebP, ≤ 2000 px, qualidade inicial 85%, teto de 1,5 MB, em Web Worker. Galeria e câmera (`capture="environment"`) como botões separados.
- **USDZ (iPhone) gerado no salvamento**, com o `USDZExporter` do three a partir do GLB (`lib/model-converter/usdz.ts`, import dinâmico). Segue o que o model-viewer faz na hora e que já foi medido certo no iPhone: âncora horizontal no chão; **sem âncora** na parede (corrige a nota de 2026-10-10, que previa âncora vertical). Se falhar, salva sem USDZ e o model-viewer volta a gerar na hora. A coluna `model_usdz_path` vem da migration `20261013120000_product_usdz.sql`; a loja passa o arquivo em `ios-src`.
- **Trocar chão ↔ parede** reconverte: do arquivo aberto, ou baixando o original guardado (`model_source_path`). Sem original guardado, pede o arquivo de novo.
- **Imagem de espera (poster):** foto do 3D tirada da prévia (`toBlob`, WebP) ou a foto de capa. A prévia do admin carrega com `loading="eager"` para a foto sair mesmo fora da tela; se não estiver pronta, usa a capa.
- **Rascunho local:** só os campos de texto, a escolha chão/parede e as medidas ficam no `localStorage` (fotos e modelo, não: são grandes). Ao voltar, a tela oferece recuperar. Aviso do navegador ao sair com alterações não salvas.

## 2026-10-14 · Fase 3: destaques e banners

- **Destaques** (`/admin/destaques`): lista arrastável (`featured_order`), "Adicionar peça" abre uma busca entre as peças fora dos destaques; o X tira sem pedir confirmação (é só desmarcar). A tela avisa o que não aparece na loja: rascunhos e o que passa da 12ª peça publicada (limite de `getFeaturedProducts`).
- **Banners:** lista arrastável com a situação de cada um (No ar · No ar até dd/mm · Agendado · Encerrado · Desligado); cadastro numa página própria (não em janela, por causa das imagens): imagem de celular 4:5 (opcional) e larga 5:2 (obrigatória, `image_desktop_path not null`), título e texto menor, link (nenhum, peça, categoria ou endereço externo, com `https://` completado), período por dias inteiros, "Mostrar na loja" e prévia celular/computador. Excluir pede confirmação e sugere desligar como alternativa. Imagens em `images/banners/{banner_id}/{timestamp}-{mobile|desktop}.webp`.
- **Datas dos banners no horário de Brasília, fixo** (`America/Sao_Paulo`, UTC−3, sem horário de verão desde 2019): o painel é renderizado em parte no servidor (UTC), e usar o fuso do aparelho mostrava o dia errado. Primeiro dia começa 00:00; `ends_at` é a meia-noite seguinte ao último dia.
- **Correção na vitrine:** `getActiveBanners` passou a filtrar `active` e o período na própria consulta. Antes dependia só do RLS, e a dona, logada no painel, via na loja banners desligados ou agendados (a política de admin libera tudo). As consultas de produtos já filtravam `status = published`.

## 2026-10-14 · Fase 4: números da loja e páginas de erro

- **Números da loja** (`/admin/metricas`): três totais (visitas às peças, aberturas do AR, cliques no WhatsApp) e uma tabela das 20 peças mais vistas nos últimos 30 dias. Sem gráfico: são poucos números e uma classificação, que a tabela mostra melhor.
- **Contagem no banco** (`event_summary(since)`, migration `20261014120000_event_summary.sql`): a soma feita no navegador pararia nas 1.000 linhas que o PostgREST devolve por consulta. A função é `security invoker`, então o RLS de `events` continua valendo (só admin recebe linhas) e usa o índice `events_created_at_idx`.
- **Páginas de erro:** "não encontrado" da loja com cabeçalho e rodapé (peça, categoria e endereços inexistentes), erro da loja com "Tentar de novo", versões do painel com volta ao início e `global-error` para falha no layout raiz.
- **Ping do Supabase:** já existia desde a fase 0 e roda a cada 2 dias com sucesso; só marcado no plano.
- **Cloudflare Web Analytics com o snippet no código** (`components/store/web-analytics.tsx`): a injeção automática da Cloudflare não vale para respostas de Worker. O script entra só nas páginas da loja (as visitas da dona ao painel não contam), só em produção e com `strategy="lazyOnload"`, para não disputar com a imagem principal (LCP). O token é público por natureza.

## 2026-10-14 · Gestão do negócio no painel (fases 6 a 10)

- **Decisão:** ampliar o escopo com calculadora de custos, clientes e pedidos, financeiro, conversor de imagem para SVG e imagens com o Gemini, nessa ordem (pedidos usam a calculadora; o financeiro usa os pedidos). Fases e critérios em `PLAN.md`.
- **Motivo:** a dona usa planilhas e outros aplicativos para isso; no tablet, trocar de app a toda hora atrapalha.
- **Fórmula de preço:** materiais extras e embalagem são **repasse**: entram no preço pelo custo, sem margem. `preço = (impressão + falhas + acabamento) × (1 + margem) + extras + embalagem`, final ,90. A planilha antiga (`docs/Calculadora_Custos_DAN3D.xlsx`) chegava ao mesmo preço com margem de 100% por coincidência, mas mostrava um lucro maior que o real.
- **Dados de custo e finanças só para admin**, em tabelas próprias com RLS também no `select`. `settings` e `products` têm leitura pública e não podem guardar custos.
- **Pedidos guardam uma foto do cálculo** (preço, custo e repasse por item), para que mudar parâmetros depois não altere pedidos antigos.
- **Lucro do mês pelo regime de caixa** (recebido − contas pagas). A margem estimada dos pedidos aparece separada, para não contar o filamento duas vezes (ele já entra nas contas pagas).
- **"Mini Inkscape" fora:** vira só ajustes no conversor SVG (cores, suavização, fundo, apagar cor). Um editor completo daria muito trabalho para pouco uso.
- **Gemini:** há indícios de que a API deixou de ter cota gratuita para imagens em dez/2025; confirmar com a chave antes de construir a fase 10.

## 2026-10-14 · Fase 6: calculadora de custos

- **Percentuais guardados como percentual** (`failure_percent = 10`, `margin_percent = 100`), não como fração: é como a dona digita e lê.
- **Preço do filamento por peça:** a calculadora começa com o preço padrão, mas aceita outro só naquele cálculo (filamento seda, PETG etc.). Fica `null` no cálculo salvo quando é o padrão, para acompanhar mudanças no preço padrão.
- **Materiais iniciais vieram da aba Materiais da planilha.** A quantidade do "Suporte de chaveiro" estava 160 (provável erro de digitação) e entrou como 1.
- **Cálculo salvo na peça guarda só as entradas** (peso, tempo, acabamento, materiais), não o resultado: mudar a margem ou a energia atualiza o preço sugerido da próxima vez. Os pedidos (fase 7) é que vão guardar a foto do resultado.
- **Salvar na peça não muda o preço da loja sozinho:** depois de salvar, uma janela pergunta se a dona quer usar o preço sugerido.
- **Atalhos do painel agrupados** em "Loja" e "Gestão" ("Ferramentas" entra na fase 9).

## 2026-10-16 · Fase 7: clientes e pedidos

- **Pedido e itens salvos por uma função no banco** (`save_order`, `security invoker`): cria ou atualiza o pedido e troca os itens numa transação só, para uma queda de internet no meio não deixar pedido sem peças. O RLS continua valendo.
- **Situações:** Orçamento → Confirmado → Em produção → Pronto → Entregue, mais Cancelado. A tela mostra um botão grande com o próximo passo; "Voltar para…" corrige enganos. Pedidos entregues ou cancelados não editam peças (reabrir primeiro).
- **Item do catálogo:** preço da loja; custo do cálculo salvo na peça (fase 6), com os parâmetros de hoje. Sem cálculo salvo, o custo fica em branco e o lucro do pedido aparece como "—" até calcular.
- **Lucro estimado do pedido** = peças − desconto − custo. O frete fica de fora (vai para a transportadora).
- **Pagamentos** em tabela própria (sinal, restante, várias formas). Pedido com pagamento não pode ser excluído, só cancelado, para não sumir dinheiro recebido do financeiro.
- **Cliente com pedidos não pode ser excluído** (`on delete restrict`).
- **"Usar num pedido"** leva o cálculo da calculadora por `sessionStorage` (só precisa sobreviver a uma navegação na mesma aba).
- **Numeração:** `orders.number` é `identity`. Os testes consumiram números; a sequência foi reiniciada com a tabela vazia, para o primeiro pedido real ser o nº 1.

## 2026-10-16 · Fase 8: financeiro

- **Resumos calculados no banco** (`finance_months`, `finance_open`, `finance_top_items`, todas `security invoker`) em vez de um `finance_summary` único: cada bloco da tela tem uma pergunta diferente (por mês, agora, ranking) e a soma no navegador pararia nas 1.000 linhas do PostgREST.
- **Regime de caixa no "Resultado":** recebido (pagamentos de pedidos pela data do pagamento) − contas pagas (pela data em que foram pagas). A "margem estimada" dos pedidos entregues aparece à parte, como estimativa da calculadora, para não contar o filamento duas vezes.
- **Mês do pedido entregue** pela data de entrega no horário de Brasília (`delivered_at at time zone 'America/Sao_Paulo'`).
- **A receber** inclui pedidos confirmados, em produção, prontos e entregues com saldo; orçamentos e cancelados ficam de fora.
- **Conta de todo mês:** ao pagar pela primeira vez, `pay_expense` lança a do mês seguinte na mesma transação; pagar de novo não duplica. "Já está paga" no cadastro passa pela mesma função.
- **Gráfico sem biblioteca nova:** barras em HTML/CSS (recebido × contas pagas, 6 meses), tocar no mês mostra os valores (tablet não tem hover) e há "Ver em tabela". Cores: slots 1 e 2 da paleta de referência do skill de visualização (azul/laranja), validadas no fundo claro e escuro do painel; a escala marrom da marca é de um tom só e não separa duas séries.

## 2026-10-16 · Fase 9: imagem para SVG

- **Biblioteca `imagetracerjs` 1.2.6** (Unlicense, JS puro, várias cores), aprovada pelo dono do projeto. Sem tipos no npm: declarados só os usados em `types/imagetracerjs.d.ts`.
- **Só no cliente:** o traçado roda num Web Worker (`lib/vectorize/worker.ts`) e a tela é carregada com `dynamic(..., { ssr: false })`. Sem isso a biblioteca entrava no bundle do Worker da Cloudflare (conferido no `.open-next`).
- **Imagens grandes são reduzidas para 1000 px** no lado maior antes do traçado: o tempo cresce com a área e logos não precisam de mais.
- **SVG pensado para o Bambu Studio:** só preenchimentos, sem contorno (`stroke`), com `viewBox` e largura/altura. O fundo é a cor mais comum na borda da imagem; áreas transparentes do PNG já ficam de fora.
- **Esconder cores não refaz o traçado:** o SVG é remontado na hora a partir do resultado guardado. Mudar nº de cores, suavização ou manchas refaz o traçado (com uma pausa de 350 ms para não refazer a cada toque).
- **Prévia como imagem** (`<img src="data:image/svg+xml…">`), nunca inserida como HTML na página.
