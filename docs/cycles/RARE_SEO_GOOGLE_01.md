# RARE-SEO-GOOGLE-01 — SEO técnico, Search Console, dados estruturados e Merchant Center

- Base: `origin/main@35c741623fe706843661c83693667658b46e497e` (produção conhecida).
- Branch: `cycle/rare-seo-google-01` (worktree isolado; ciclo paralelo a `RARE-COOKIE-PUBLIC-HARDENING-01` e `RARE-IOS-SALES-PUSH-01`).
- Escopo: código de SEO/Google apenas. **Sem** deploy, merge, migration, alteração de banco, pagamentos, checkout,
  estoque, cupons, frete, RBAC, MFA, arquivos do ciclo Cookie ou do ciclo iOS Push.
- Fontes (consultadas em 2026-11-17): Google Search Central (merchant listing, product variants, faceted navigation,
  pagination, canonical, sitemaps, robots.txt, Search Console), Merchant Center Help (product data specification,
  RSS 2.0, scheduled fetch) e Merchant API / sunset da Content API.
- Evidências pesadas (fora do Git): `output/seo-google-01/` (`prod/` auditoria pública, `lab/` runtime local,
  `cwv/` Lighthouse, `build.log`).

### Status de ativação (revisão final do PR #10)

```
FEED_ROUTE_READY=YES
MERCHANT_SOURCE_ACTIVATION=HOLD_ATTRIBUTE_GAPS
SEARCH_CONSOLE=MANUAL_PENDING (independe do Merchant)
```

- A rota `/feeds/google-products.xml` **pode ser deployada** com esta branch (noindex, só dados públicos, 503 em erro).
- **Não cadastrar ainda a fonte no Merchant Center**: o catálogo de vestuário não tem `color`, `gender` e `age_group`
  (obrigatórios para vestuário no Brasil) e há produtos sem `brand`. Cadastrar agora só geraria itens reprovados/
  limitados. A ativação fica em espera até um ciclo próprio (com migration e preenchimento no Admin) fechar os
  gaps — ver `MERCHANT_ATTRIBUTE_GAPS` e a seção 8.
- Nenhum desses atributos é inventado ou assumido globalmente (`gender=unisex`, `age_group=adult`, `condition=new`
  **não** são enviados sem confirmação do dado real).
- O Search Console **não depende** do Merchant: verificação, sitemap e inspeção de URL seguem normalmente após o deploy.

## 1. Auditoria do código existente (antes do ciclo)

| Item | Arquivo | Classificação | Achado |
|---|---|---|---|
| robots.txt | `src/app/robots.ts` | **FIX** | `Disallow: /conta` é prefixo e **bloqueava `/contato`** (página pública no sitemap). `host:` é ignorado pelo Google. Corrigido para `/conta$` + `/conta?` + `/conta/`. |
| Staging noindex/disallow | `src/lib/seo.ts`, `robots.ts` | KEEP | Correto (`isPublicIndexingEnabled`). |
| sitemap.xml | `src/app/sitemap.ts` | IMPROVE | Conteúdo correto; home, `/categoria/tudo`, `/destaques` sem `lastmod`; categoria com `lastmod` só da própria linha (não muda quando os produtos mudam). Não usava `new Date()` (bom). |
| Canonical / metadataBase | `src/lib/seo.ts` | KEEP + **FIX** | Sempre `https://raredept.com.br`, nunca localhost/www/railway. **Paginação `?page=N` canonicalizava para a página 1.** |
| Filtros / busca / ordenação | categoria, coleção, home | **FIX** | `?brand=`, `?size=`, `?price=`, `?available=`, `?promo=`, `?sort=`, `?q=` eram **indexáveis** (canonical sem parâmetro, mas sem `noindex`); `/?q=` tinha o mesmo title/description da home. |
| Titles | páginas | KEEP + IMPROVE | Naturais e únicos; páginas 2+ repetiam o title da página 1. |
| Descriptions de categoria | `storefront.ts` | IMPROVE | Todas as categorias reais tinham a mesma description genérica. |
| H1 | `src/app/(store)/loading.tsx` | **FIX** | O fallback de streaming tinha um `<h1>` ("Carregando conteúdo da RARE"): o HTML inicial de toda página do storefront tinha **dois H1**. |
| Organization / WebSite | `structured-data.tsx`, home | KEEP | Corretos. O `SearchAction` não gera mais sitelinks search box (descontinuado pelo Google em 2024-11), mas é inofensivo e a busca `/?q=` existe. |
| BreadcrumbList | PDP, categoria, coleção | KEEP | Correto. |
| Product / Offer | PDP | IMPROVE | Preço/moeda/disponibilidade corretos e InStock atrás da flag de checkout (KEEP). Faltavam: preço riscado real da promoção, `category`, variantes por tamanho; `description` usava só a curta. `brand`/`sku` ausentes na maioria por falta de dado. |
| ProductGroup | — | MISSING | Implementado neste ciclo. |
| Merchant Center | — | MISSING | Implementado (feed). |
| Smoke público | `src/lib/public-site-smoke.ts` | IMPROVE | Sem checagens de indexação; adicionadas. |

## 2. Auditoria da produção pública (somente leitura, 2026-11-17)

Detalhe por rota em `output/seo-google-01/prod/routes.json` e `routes-2.json`.

| Rota | HTTP | robots | canonical | title | H1 (HTML) | JSON-LD |
|---|---|---|---|---|---|---|
| `/` | 200 | index | `https://raredept.com.br` | RARE — Streetwear importado e drops selecionados | 2 (loading + real) | Organization, WebSite |
| `/categoria/tudo` | 200 | index | próprio | Catálogo completo \| RARE | 2 | BreadcrumbList |
| `/categoria/destaques` | 200 | index | próprio | Destaques da loja \| RARE | 2 | BreadcrumbList |
| `/categoria/camisetas` (e demais) | 200 | index | próprio | Camisetas \| RARE | 2 | BreadcrumbList |
| `/categoria/camisetas?page=2` | 200 | index | **página 1** | igual à página 1 | 2 | BreadcrumbList |
| `/categoria/camisetas?brand=Supreme` | 200 | **index** | sem parâmetro | igual | 2 | BreadcrumbList |
| `/categoria/tudo?sort=price-asc` | 200 | **index** | sem parâmetro | igual | 2 | BreadcrumbList |
| `/?q=supreme` | 200 | **index** | home | igual à home | 2 | — |
| PDPs (camiseta-supreme, jaqueta-corteiz, bone-sup, meia-fire, bag-trapstar-2, calca-jeans-fire) | 200 | index | próprio | `<produto> \| RARE` | 2 | Product, BreadcrumbList |
| 3 coleções `/colecao/black-friday-sale{,-10,-30}` | 200 | **index** | próprio | Black 10/15/30% OFF \| RARE | 1 | BreadcrumbList |
| Institucionais (sobre, contato, suporte, envio, privacidade, trocas, cookies) | 200 | index | próprio | únicos | 2 | — |
| `/produto/nao-existe`, `/categoria/nao-existe` | 404 | `x-robots-tag: noindex` | — | — | — | — |
| `/nonexistent-page`, `/colecao/nao-existe` | 404 | — | — | — | — | — |

- **robots.txt** de produção = bloco gerenciado pela **Cloudflare** (Content-Signal + bloqueio de crawlers de IA,
  inclusive `Google-Extended` e `GoogleOther`) **+** o robots do app. `Googlebot`, `Storebot-Google` e
  `AdsBot-Google` não são bloqueados (requisito do Merchant Center). O bloco Cloudflare é infraestrutura, fora do código.
- **sitemap.xml**: 97 URLs (home, 7 institucionais, `tudo`, `destaques`, 14 categorias, 75 produtos), sem rotas privadas.
- **WWW / HTTP / Railway**: `http://raredept.com.br` → 301 `https://raredept.com.br/`; `https://www.raredept.com.br` →
  301 apex; `http://www` → 301 `https://www` → 301 apex (duas etapas, aceitável); `rare-production.up.railway.app` → **404**.
  Sem conteúdo duplicado indexável. Nada alterado em DNS.
- **ORPHAN_PRODUCTS = 0**: crawl de home + todas as categorias (seguindo `rel="next"`) + coleções alcança os 75 produtos do
  sitemap. **7 camisetas só são alcançáveis pela `/categoria/camisetas?page=2`** — exatamente as que o canonical antigo
  da página 2 → página 1 prejudicava. 2 produtos sem categoria (`gorro-supreme-s-logo-preto`, `calca-stussy`) só aparecem
  em `/categoria/tudo` ("Outras peças").

## 3. O que mudou

### Robots (`src/app/robots.ts`)
- `/conta` → `/conta$` (caminho exato) + `/conta?` (o mesmo caminho com qualquer query string, ex.
  `/conta?tab=perfil`, `/conta?redirect=/pedidos` — `$` sozinho é o fim absoluto da URL e deixaria essas abertas) +
  `/conta/` (filhos). `/contato` e `/contato?utm_source=x` continuam liberados. **Nunca voltar ao `/conta` sem âncora.**
  O resto dos bloqueios privados preservado: `/admin`, `/api`, `/checkout`,
  `/finalizar-compra`, `/cart`, `/minha-conta`, `/entrar`, `/cadastro`, `/pedido`, `/pedidos`, `/_next/data`).
- Linha `Host:` removida (ignorada pelo Google). CSS/JS/imagens (`/_next/static`, `/_next/image`, R2) continuam liberados.
- Staging/preview/dev: `Disallow: /` + metadata `noindex, nofollow` (inalterado).

### Estratégia de URLs de listagem (`src/lib/seo.ts`)
| URL | robots | canonical |
|---|---|---|
| `/categoria/<slug>` | index, follow | própria |
| `/categoria/<slug>?page=N` (sem filtros) | index, follow | **própria** (`?page=N`), title "… — página N" |
| qualquer `q`, `brand`, `size`, `price`, `available`, `promo`, `sort` (com ou sem `page`) | **noindex, follow** | categoria sem parâmetros |
| `/?q=` | **noindex, follow** | home; title "Busca: …" |
| `/colecao/<slug>` (+ página/filtros) | **noindex, follow** | própria (página) / sem filtros |
| utm_*, fbclid etc. | inalterado | descartados no canonical |

Racional (Google): paginação deve ter canonical próprio e nunca apontar para a página 1; variações de filtro/ordenação
devem ser bloqueadas por `noindex` ou robots.txt. Escolhido `noindex, follow` (e não `Disallow`) para os links dos produtos
continuarem rastreáveis e o Google conseguir ler o `noindex`. Nada disso entra no sitemap.

### Coleções (Black Friday)
`/colecao/<slug>` = Promotion. Hoje as 3 promoções **não têm data de fim** e viram 404 real quando pausadas/encerradas.
Decisão: **`noindex, follow`, fora do sitemap, canonical próprio**, metadata completa (title = rótulo, description = copy
da promoção ou "<rótulo>: peças da RARE com preço promocional por tempo limitado."). Os produtos seguem indexados pelas
categorias. Lógica de Promotion intocada. Se no futuro existir uma coleção perene, reavaliar (bastaria outro robots em
`buildCollectionMetadata`).

### Sitemap (`src/app/sitemap.ts`)
Mesmo conteúdo, `lastmod` só real: home/`tudo` = produto atualizado mais recentemente; `destaques` = destaque mais recente;
categoria = max(categoria, produtos dela); produto = `updatedAt`; institucionais **sem** `lastmod` (sem data de edição
rastreada). Nunca: Admin, API, checkout, carrinho, conta, busca, filtros, paginação, login, 404, coleções, feed.

### Titles / descriptions
- Páginas 2+: "Camisetas — página 2".
- Categorias reais: "<Nome> na RARE. <frase da categoria já usada na home> <descrição padrão da loja>" — só copy existente.
- Produtos: inalterados (title do produto; description = `shortDescription`, depois `description`). Sem atributos inventados.
- **Conteúdo insuficiente** (não corrigido no código — é cadastro): 46 de 75 produtos com descrição curta < 40 caracteres
  (lista em `output/seo-google-01/prod/feed-estimate.json`), 7 produtos sem marca (`camiseta-gotham`, `camiseta-angel`,
  `bone-sup`, `camiseta-supreme`, `astro-boy-t-shirt`, `hellstar-camiseta`, `conjunto-trapstar`), 2 sem categoria.

### H1
`src/app/(store)/loading.tsx`: texto do fallback virou `<p className="sr-only">` (continua com `role="status"`). Agora
cada página tem um único H1 no HTML.

### Structured data
Novo `src/lib/product-offer.ts`: **um único snapshot** da oferta (nome, URL, imagens, marca, categoria, preço pago,
preço de catálogo, promoção, disponibilidade por tamanho) usado pelo JSON-LD **e** pelo feed.

- **Product** (1 tamanho ativo): `name`, `description` (longa, senão curta), `image`, `url`, `sku` (só se existir),
  `brand` (só se existir), `category` (taxonomia real), `offers`.
- **ProductGroup** (2+ tamanhos ativos): `productGroupID` (id do produto), `variesBy: [schema.org/size]`, `hasVariant[]`
  com `name` "<produto> - Tamanho X", `size`, `sku` real, `offers` por tamanho com `url` `?size=X`.
  A PDP agora pré-seleciona o tamanho de `?size=` (somente tamanhos ativos; valor desconhecido é ignorado; o canonical
  continua sem parâmetro).
- **Offer**: `price` = `pricing.finalPriceInCents` (exatamente o mostrado; sem cupom, frete ou acréscimo de
  parcelamento), número com 2 casas; `priceCurrency: BRL`; `availability` = OutOfStock se esgotado, InStock **somente**
  com checkout ligado (guard estático de release preservado), omitido se checkout pausado.
- **Promoção**: `priceSpecification` `UnitPriceSpecification` + `priceType: StrikethroughPrice` com o preço de catálogo
  (o mesmo `<s>` do PriceTag). `priceValidUntil` só quando a promoção tem `endsAt` real (último dia em America/Sao_Paulo);
  as 3 promoções atuais não têm datas → nada é inventado. `validFrom` não é publicado (a data de início não chega ao
  preço do storefront sem mexer no motor de promoções).
- **Product.category**: caminho "Categoria > Subcategoria" com nomes reais; categorias inativas ou de slug promocional
  (`sale`, `black`, `promo`, `oferta`, `outlet`…) ficam de fora.
- Contrato de release (`src/lib/product-offer-contract.ts` + `tests/e2e/release-smoke.spec.ts`) agora lê também as
  ofertas de `ProductGroup.hasVariant`.

### MERCHANT_ATTRIBUTE_GAPS (sem migration neste ciclo)
| Atributo | Situação | Impacto |
|---|---|---|
| `color` | não existe no catálogo | **Obrigatório para vestuário com público no Brasil** — itens de roupa tendem a ser reprovados/limitados até existir |
| `gender` | não existe | idem (obrigatório vestuário BR) |
| `age_group` | não existe | idem (obrigatório vestuário BR) |
| `gtin` / `mpn` | não existem | desempenho limitado; não enviados (nem `identifier_exists=no`, que só é correto em casos específicos) |
| `condition` | não existe | não enviado; **não** assumir `new` globalmente sem confirmar que todo o catálogo é novo |
| `google_product_category` | não mapeado | opcional (Google infere) |
| `brand` | 7 produtos sem marca | obrigatório para produtos novos; preencher no Admin |
| `sale_price_effective_date` | promoções sem início/fim | omitido |
| `shipping`, `installment` | não enviados | configurar frete na conta do Merchant Center; parcelamento é opcional |

Para fechar os gaps é preciso um ciclo próprio com migration (ex.: `Product.color`, `Product.gender`,
`Product.ageGroup`, `ProductVariant.gtin`) e preenchimento no Admin. **Nenhuma migration foi criada aqui.**
Enquanto `color`/`gender`/`age_group` faltarem no vestuário e houver produto sem `brand`:
**`MERCHANT_SOURCE_ACTIVATION=HOLD_ATTRIBUTE_GAPS`** (a rota do feed fica pronta, mas a fonte não é cadastrada).

## 4. Merchant Center

- **Status**: `FEED_ROUTE_READY=YES` · `MERCHANT_SOURCE_ACTIVATION=HOLD_ATTRIBUTE_GAPS` (ver seção 8).
- **Content API for Shopping: NÃO usada** (sunset 2026-08-18; falhas 410 desde 2026-09-01).
- **Estratégia**: feed RSS 2.0 (`xmlns:g`) gerado no servidor em **`/feeds/google-products.xml`**
  (`src/app/feeds/google-products.xml/route.ts`, `src/lib/google-merchant-feed.ts`), consumido por uma fonte de dados
  **"busca programada" (scheduled fetch)** do Merchant Center. Merchant API fica como evolução futura
  (`buildGoogleMerchantFeedItems` é reaproveitável; exige conta/credenciais → `MANUAL_PENDING`).
- Um item por **tamanho ativo**: `g:id` = id da variante (estável, ≤ 50), `g:item_group_id` = id do produto (2+ tamanhos),
  `title` "<produto> - Tamanho X", `description`, `link` (`?size=X`), `image_link` + até 10 `additional_image_link`
  (só JPEG/PNG/WebP), `availability` (`in_stock` só com estoque **e** checkout ligado), `price` (catálogo) + `sale_price`
  (preço pago, só com promoção real), `brand`, `product_type` (taxonomia real), `size`.
- Exclui (e reporta) produto sem imagem aceita, sem tamanho ativo ou com preço ≤ 0. Só dados públicos: nenhuma quantidade
  de estoque, custo, fornecedor, nota interna ou dado de cliente.
- Só responde no build de produção indexável; staging/preview/dev = 404. Falha de leitura do catálogo = **503** (nunca um
  200 vazio, que o Merchant leria como "remover tudo"). `X-Robots-Tag: noindex`, fora do sitemap, não bloqueado no robots.
- **Volume esperado em produção** (estimado pelas PDPs públicas em 2026-11-17): **75 produtos / 213 itens** (48 produtos
  com 2+ tamanhos, 27 com 1); 76 itens em estoque; 24 produtos em promoção; 0 sem imagem aceita.
- **Consistência Merchant × site**: `src/lib/google-merchant-feed.test.ts` (título, preço pago = Offer.price = PriceTag,
  preço riscado, disponibilidade, marca, imagem, link) e verificação em runtime no lab (`output/seo-google-01/lab/
  consistency.txt`: 9/9 itens OK contra o JSON-LD de cada PDP, com tamanho pré-selecionado).

## 5. Imagens

- Schema/feed usam a mídia original (máxima resolução; Google recomenda alta resolução; Merchant exige ≥ 500×500 a partir
  de 2027-01-31). `og:image` continua usando a variante média (`-v1-medium.webp`).
- Originais pesados: PNGs `-rare-v1-original.png` ≈ 2,2–2,5 MB; `bag-supreme.png` 2,8 MB sem variantes; banner da home
  `nv-banner-2.png` **2,2 MB** sem variantes (é o LCP da home mobile).
- 0 imagens quebradas nas PDPs auditadas; `alt` presente (do cadastro).
- `media:variants:backfill` **não** foi executado. `media:variants:audit` não roda sem acesso ao banco de produção
  (não usado neste ciclo) → `MANUAL_PENDING` para o operador.

## 6. Core Web Vitals — baseline (Lighthouse lab, produção, 2026-11-17)

PageSpeed Insights público retornou 429 (cota diária); medido com Lighthouse local (throttling simulado). INP exige dados
de campo (CrUX) → usar Search Console › Core Web Vitals após verificação; TBT como proxy de laboratório.

| Página | Perfil | Perf | LCP | CLS | TBT | Elemento LCP |
|---|---|---|---|---|---|---|
| Home | mobile | 73 | **17,7 s** | 0 | 90 ms | banner `nv-banner-2.png` (2,2 MB PNG) |
| Home | desktop | 99 | 0,8 s | 0 | 0 ms | texto |
| Categoria (camisetas) | mobile | 84 | 4,2 s | 0 | 30 ms | imagem de produto |
| Categoria | desktop | 92 | 1,8 s | 0 | 0 ms | imagem de produto |
| PDP (jaqueta-corteiz) | mobile | 74 | 5,4 s | 0 | 80 ms | texto |
| PDP | desktop | 96 | 1,4 s | 0 | 0 ms | imagem principal |

Findings (sem refactor neste ciclo): (1) banner da home sem variantes responsivas → gerar WebP/AVIF responsivos no
upload de banners; (2) produtos legados sem variantes (`bag-supreme.png`) → backfill controlado de mídia pelo runbook;
(3) CLS = 0 em todas as páginas.

## 7. Search Console (MANUAL_PENDING — nenhum acesso autenticado usado, nenhum DNS alterado)

Independe do Merchant Center: pode (e deve) ser feito logo após o deploy, mesmo com o Merchant em espera.

Estado: `raredept.com.br` **não tem** registro TXT `google-site-verification` (consulta pública em 2026-11-17; só SPF).

1. **Propriedade de domínio**: https://search.google.com/search-console → Adicionar propriedade → **Domínio** →
   `raredept.com.br` (sem `https://`, sem `www`).
2. **Verificação DNS TXT**: copiar o valor `google-site-verification=…` mostrado (não colar no Git nem em chat). No
   provedor de DNS (Cloudflare): DNS › Records › Add record › Tipo **TXT**, Nome **`@`**, Conteúdo = valor copiado,
   TTL Auto → Salvar. Voltar ao Search Console → **Verificar** (pode levar de minutos a 2–3 dias). **Nunca remover** o
   registro depois de verificado.
3. **Sitemap** (após o deploy desta branch): Search Console › Sitemaps › `https://raredept.com.br/sitemap.xml` › Enviar.
   (O robots.txt também já declara o sitemap.) Não enviar o feed Merchant como sitemap.
4. **Inspeção de URL** (após o deploy): inspecionar e "Solicitar indexação" de `https://raredept.com.br/`,
   `/categoria/tudo`, `/categoria/camisetas?page=2`, `/contato` (era bloqueada pelo robots) e uma PDP com tamanhos
   (ex.: `/produto/camiseta-supreme`); conferir "Página com rich results › Listagens do comerciante / Snippets de
   produto" e "Variantes do produto". Validar também no Rich Results Test.
5. Acompanhar: Indexação › Páginas (as URLs filtradas devem aparecer como "Excluída pela tag noindex"), Experiência ›
   Core Web Vitals (INP de campo) e Shopping › Listagens do comerciante.

## 8. Merchant Center (HOLD_ATTRIBUTE_GAPS)

`FEED_ROUTE_READY=YES` · `MERCHANT_SOURCE_ACTIVATION=HOLD_ATTRIBUTE_GAPS`

**Agora (após o deploy desta branch)** — só verificação, sem cadastrar nada no Merchant Center:
1. Conferir `https://raredept.com.br/feeds/google-products.xml` (200, XML, `X-Robots-Tag: noindex`, ~213 itens) —
   o smoke (`seo:merchant-feed`) já faz isso.

**Não fazer ainda**: criar a fonte de dados no Merchant Center. Vestuário sem `color`/`gender`/`age_group` (obrigatórios
no Brasil) e produtos sem `brand` seriam reprovados/limitados; não há valor seguro para preencher globalmente.

**Pré-requisitos para liberar a ativação** (ciclo próprio):
- Migration + campos no Admin para `color`, `gender`, `age_group` (e, se houver, `gtin`/`mpn`), preenchidos com o dado
  real de cada peça; `condition` só se confirmado.
- `brand` preenchida em todos os produtos (hoje 7 sem marca) e categoria nos 2 sem categoria.
- Feed atualizado para exportar esses campos + testes de consistência estendidos.

**Quando liberado** (só então):
1. Merchant Center (conta da RARE, país **Brasil**, idioma **português**, moeda **BRL**) → Produtos › Fontes de dados ›
   Adicionar fonte de produtos › **Adicionar produtos de um arquivo** › **Inserir um link para o arquivo** →
   `https://raredept.com.br/feeds/google-products.xml` → frequência **Diária** (horário de baixo tráfego). Sem autenticação.
2. Verificar/reivindicar o site `raredept.com.br` no Merchant Center (pode reaproveitar a verificação do Search Console).
3. Configurar **frete** e **política de devolução** na conta (não vão no feed).
4. Marcas de terceiros podem passar por revisão de política de marca registrada/autenticidade do Google — manter
   comprovação de procedência disponível.

## 9. Testes e verificação

- Unit: `seo-listing.test.ts`, `product-offer.test.ts`, `google-merchant-feed.test.ts` (inclui consistência Merchant × site),
  `feeds/google-products.xml/route.test.ts`, `robots.test.ts` (matcher no padrão Google — prefixo, query string, `*`, `$` — com `/conta`, `/conta?tab=perfil`,
  `/conta?redirect=x`, `/conta/dados` bloqueados e `/contato`, `/contato?utm_source=x` liberados),
  `sitemap.test.ts` (lastmod real; sem filtros/coleções/feed), `structured-data.test.ts`, PDP/categoria/home page tests,
  `public-site-smoke.test.ts` (checagens SEO).
- Smoke: `npm run smoke -- https://raredept.com.br` agora inclui checagens de indexação (`--no-seo` desliga).
  Contra a produção atual (antes do deploy) elas **falham de propósito** em `seo:robots-public` (`/contato`) e
  `seo:filtered-listing`, e avisam `seo:merchant-feed` 404 — os três são corrigidos por esta branch.
- Runtime: build de produção standalone contra um Postgres local **descartável** (criado, migrado, semeado e removido no
  ciclo) — rotas, robots, sitemap, feed e consistência verificados (`output/seo-google-01/lab/`).

## 10. Fora do escopo / deferido

- Política de cookies: metadata correta (title/description/canonical próprios) — nada a deferir para o ciclo Cookie.
- `src/app/manifest.ts`, Web Push/VAPID, arquivos de push do Admin: intocados.
- Prisma/schema/migrations, Asaas, checkout, webhooks, parcelamento, estoque, reservas, cupons, frete, RBAC, MFA: intocados.
