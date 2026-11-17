# RARE-UIUX-AUDIT-01 — Backlog de UI/UX

Base `main@2adec1a`. Nada aqui foi implementado. Cada item aguarda aprovação do operador para o
`RARE-UIUX-REFINE-01`. "Evidence" aponta para arquivos em `output/uiux-audit-01/` (fora do Git; ver
[SCREENSHOT_GALLERY.md](./SCREENSHOT_GALLERY.md)). `(OP)` = achado do operador.

Regra transversal do REFINE: **nenhum item pode alterar cálculo, taxas, `installmentCount`, snapshot,
total, Asaas, webhook, estoque, reservas, cupons, frete ou RBAC.** Onde um item toca uma tela
financeira, a mudança é só de apresentação e a regressão deve ser provada com os specs existentes
(`tests/e2e/card-installments.spec.ts`, `order-item-sku.spec.ts`, `bf-mfa-*`).

Índice: [P1](#p1) (9) · [P2](#p2) (19) · [P3](#p3) (7)

---

## P1

### UIUX-NAV-001 (OP) — Navegação de categorias mal distribuída e duplicada no catálogo
- **ID:** UIUX-NAV-001
- **Priority:** P1
- **Type:** UX (também UI, CONSISTENCY)
- **Route:** header global (≥ 1024 px); `/categoria/[slug]`; `/?q=`
- **Viewport:** 1024, 1280, 1440, 1920 (header); todas (atalhos do catálogo)
- **Problem:** a barra de categorias do header usa 863 px fixos alinhados à esquerda (sobram 537 px em 1440). O catálogo repete 8 atalhos, 7 idênticos ao header, ocupando o topo da página (cabeçalho do catálogo com 285 px). O botão "Acessórios ▾" tem peso de fonte diferente dos links (UIUX-GLOBAL-001).
- **Impact:** duas navegações concorrentes; o cliente não sabe qual é a principal; espaço nobre do catálogo gasto com repetição em vez de produto/filtros.
- **Evidence:** `layout-probe.json` (nav: `navUsedPx=863`, `emptyRightPx` 129/377/537/777; `duplicated=7`); `gallery/storefront/desktop/chromium-1440-categoria-camisetas-full.png`; `gallery/storefront/desktop/chromium-1440-menu-acessorios.png`.
- **Recommended fix:** (1) header ≥ 1024 px: uma única barra alinhada ao grid do conteúdo (`store-shell`), itens distribuídos (centralizada ou `justify-between` dentro do container), sem aumentar os botões; (2) catálogo: trocar a fileira de atalhos por uma toolbar "N produtos · [Filtrar] [Ordenar]" (UIUX-CATALOG-001); (3) **< 1024 px** (onde a barra do header não aparece): manter navegação rápida — barra horizontal rolável no topo do catálogo **ou** seletor de categoria no painel de filtros. Não remover os atalhos do mobile sem substituto.
- **Dependencies:** UIUX-CATALOG-001 (a toolbar ocupa o lugar dos atalhos); UIUX-GLOBAL-001.
- **Regression risk:** médio — `category-nav.tsx` tem menu de Acessórios com teclado (setas, Esc) e testes; preservar `aria-current`, `aria-expanded` e o fechamento por Esc. SEO: os links de categoria continuam no header.

### UIUX-CATALOG-001 (OP) — Catálogo sem filtros nem ordenação
- **ID:** UIUX-CATALOG-001
- **Priority:** P1
- **Type:** UX (CONVERSION)
- **Route:** `/categoria/[slug]`, `/categoria/tudo`, `/categoria/destaques`, `/?q=`
- **Viewport:** todas
- **Problem:** só é possível navegar por categoria. Não há controle de filtro/ordenação. O filtro por marca existe apenas pela URL (`?brand=`), sem interface. A contagem mostra "24 produtos nesta página · Página 1", não o total.
- **Impact:** com o catálogo crescendo (75 PDPs no sitemap, 18 marcas), achar um tamanho ou faixa de preço exige rolar páginas inteiras.
- **Evidence:** `report.json` (`sortOrFilterControls=0` em todas as rotas de catálogo); `gallery/storefront/*/chromium-*-categoria-tudo*.png`; dados reais levantados em `prisma/schema.prisma` (Product/ProductVariant/PromotionProduct).
- **Recommended fix:** toolbar `N produtos  [Filtrar] [Ordenar ▾]`; Filtrar abre **drawer lateral** no desktop e **bottom sheet** no mobile. Filtros somente com dado real: Marca, Categoria/Subcategoria, Tamanho (normalizar P/M/G/GG/Único a partir de `ProductVariant.size`), Faixa de preço, Disponível agora, Em promoção. Ordenação fase 1 (servidor): Destaques, Mais recentes, Menor preço, Maior preço — definir se "preço" é o **final** (com promoção, calculado na aplicação) e documentar; "Maior desconto" só se calculado pelo motor de promoções. Estado na URL (`?brand=corteiz&size=G&sort=price-asc`), com `noindex`/canonical tratados no ciclo de SEO. Mostrar total real ("32 produtos").
- **Dependencies:** UIUX-NAV-001; decisão sobre preço final vs base; ciclo de SEO para indexação de filtros.
- **Regression risk:** médio — paginação (`CATALOG_PAGE_SIZE=24`), ordenação disponível/esgotado e JSON-LD de breadcrumb atuais; o motor de promoções não pode ser alterado, só consultado.

### UIUX-ORDERS-001 (OP, conhecido) — "Meus pedidos" sem identificação visual e sem foto do item
- **ID:** UIUX-ORDERS-001
- **Priority:** P1
- **Type:** UX (UI)
- **Route:** `/minha-conta/pedidos`, `/minha-conta/pedidos/[id]`
- **Viewport:** todas
- **Problem:** lista em formato de tabela administrativa (pedido, data, status, total, itens, Ver), status só em texto, sem parcelamento; no celular vira blocos sem rótulo ("20" sem dizer "itens") e a forma de pagamento aparece depois do botão "Ver". O detalhe lista itens **sem foto e sem SKU**. Produtos parecidos (ex.: duas "Camiseta Corteiz" diferentes no catálogo) ficam indistinguíveis.
- **Impact:** cliente não reconhece a compra; aumenta contato no suporte.
- **Evidence:** produção, pedido real `RARE-20261117-XQQJL7` (0 `<img>` na lista e no detalhe); `lab/account/minha-conta_pedidos-390.png`, `lab/account/pedido-{1,2,5,10,20}-itens-*-{390,1440}.png`; `lab/metrics.json` (`imagesInMain=0`; pedido de 20 itens = 5.607 px em 390); `gallery/storefront/desktop/chromium-1440-busca-corteiz-full.png` (nomes repetidos).
- **Recommended fix:** lista em **cards horizontais**: miniaturas (até 3 + "+N"), número, data, status com ícone + texto (não só cor), "Cartão · 8x" / "Pix", total, "N itens", [Ver pedido]. Detalhe: miniatura por item com prioridade `imageUrlSnapshot` → imagem atual do produto (pedido legado) → placeholder; nome, tamanho/variação, SKU (quando houver), quantidade, preço. Reaproveitar o padrão do Admin (`order-item-thumbnail.tsx`/`order-item-row.tsx`). Pedido histórico continua usando snapshot.
- **Dependencies:** nenhuma de dados (snapshot já gravado desde o PR #4); UIUX-ORDERS-002/003.
- **Regression risk:** baixo — leitura apenas; garantir escopo por `customerId` (sem IDOR) e que imagens do snapshot passem pelo otimizador como no Admin.

### UIUX-CHECKOUT-001 (OP) — Parcelamento 1x–12x ocupa a coluna inteira
- **ID:** UIUX-CHECKOUT-001
- **Priority:** P1
- **Type:** UX (RESPONSIVE, CONVERSION)
- **Route:** `/finalizar-compra`
- **Viewport:** todas (pior em 360–430 e 1024–1440)
- **Problem:** 12 radios empilhados (852 px de altura; o celular de 390 tem 844 px de tela). A lista vem **depois** do Total e da forma de pagamento; no desktop a página vai de 1.842 px (Pix) para 2.686 px (cartão) e o CTA desce para ~1.870 px.
- **Impact:** cliente perde o total final de vista enquanto escolhe; operador precisou de zoom 50% para ver o conjunto.
- **Evidence:** `lab/checkout/checkout-cartao-12x-{390,768,1440}.png` e `*-viewport.png`; `lab/metrics.json` (`installmentFieldsetHeight=852`); evidência do ciclo 02 (`checkout-12x-mobile-375.png`).
- **Recommended fix:** seletor compacto `Parcelamento no cartão [8x de R$ 10,49 ▾]` que abre listbox acessível (popover no desktop, bottom sheet no mobile, altura máxima com rolagem própria) agrupado em **Sem juros** (1x–3x) e **Com acréscimo** (4x–12x, cada linha com "Total R$ …"). Depois da escolha, só a opção selecionada + linhas "Acréscimo" e "Total no cartão" ocupam espaço. Usar `describeCardInstallmentPlan` sem mudar texto financeiro. Teclado: setas, Home/End, Enter, Esc; touch: alvos ≥ 44 px.
- **Dependencies:** UIUX-CHECKOUT-005 (ordem do resumo); UIUX-CHECKOUT-006.
- **Regression risk:** **alto (tela financeira)** — não tocar `listCardInstallmentPlans`, `installmentChoice`, payload `installmentCount`, `payableTotalInCents`. Rodar `card-installments.spec.ts` (espera `input[name="card-installments"]` ×12 — o spec precisará seguir a nova interação sem mudar as asserções de valores).

### UIUX-PDP-001 (OP) — Área vazia entre o bloco comercial e "Detalhes do produto"
- **ID:** UIUX-PDP-001
- **Priority:** P1
- **Type:** UI (LAYOUT)
- **Route:** `/produto/[slug]`
- **Viewport:** 1024–1920
- **Problem:** "Detalhes do produto" é uma linha própria do grid (`lg:col-span-2`) e só começa depois da coluna mais alta. Em 1440 a galeria termina em ~1.265 px, o bloco comercial em ~1.450 px e os detalhes começam em 1.502 px, numa coluna de texto estreita; o lado vazio troca conforme número/proporção das fotos.
- **Impact:** página parece incompleta; a descrição fica longe da decisão de compra; mais rolagem.
- **Evidence:** `gallery/product/desktop/chromium-1440-pdp-vazio-full.png`; `gallery/product/desktop/chromium-{1024,1280,1920}-pdp-vazio-full.png`.
- **Recommended fix:** mover a descrição para a coluna direita, logo abaixo do bloco comercial, como acordeões ("Detalhes do produto", "Envio", "Trocas e devoluções") — o primeiro aberto. Mobile: galeria → nome/preço → variação → CTA → frete → detalhes → confiança. Avaliar se o painel continua `sticky` (com acordeões, sticky só se couber na altura da tela).
- **Dependencies:** UIUX-PDP-003 (CTA no mobile).
- **Regression risk:** médio — preservar `h1`, JSON-LD Product/Offer, `aria-labelledby="product-details-title"`, galeria/zoom, estoque por variação, frete, WhatsApp e o texto de parcelamento.

### UIUX-ADMIN-PROMO-001 (conhecido) — "Falha temporária" ao editar promoção — POTENTIAL FUNCTIONAL BUG
- **ID:** UIUX-ADMIN-PROMO-001
- **Priority:** P1
- **Type:** BUG (POTENTIAL FUNCTIONAL)
- **Route:** `/admin/promotions/[id]/edit` (e qualquer formulário do Admin)
- **Viewport:** todas
- **Problem:** "Falha temporária / Não foi possível carregar esta área." é o `error.tsx` do Admin (`src/app/admin/(protected)/error.tsx`). Ele aparece quando um Server Action **lança** em vez de devolver erro. No lab: edição com página atual **salva normalmente** (10% → 15%, redireciona para os detalhes); a **mesma edição numa página aberta antes de um deploy** (Next responde "Server action not found") mostra exatamente a tela relatada. A loja tem tratamento próprio para isso ("Esta página pertence a uma versão anterior", `shouldOfferServerActionRefresh`), mas o boundary do Admin **não usa** e ainda diz "carregar esta área" quando a falha foi ao **salvar**; "Tentar novamente" só re-renderiza (a ação continua desatualizada).
- **Impact:** o vendedor não sabe se salvou; tende a repetir ou desistir. PR #4 e #5 foram implantados em 2026-11-17 — abas abertas antes disso caem exatamente nesse caminho.
- **Evidence:** `lab/admin/promocao-editada-ok-1440.png`, `lab/admin/promocao-acao-desatualizada-1440.png`; `lab/metrics.json` (`promotion edit (stale action).temporaryFailure=1`, `fresh page=0`); código `savePromotionAction` só lança fora do `try` (auth, leitura, `findInvalidTargets`).
- **Classificação:** **erro de UI + mensagem ruim confirmados**; **erro real de backend: não comprovado** (sem acesso aos logs de produção nesta sessão — a conta Railway conectada não lista o projeto RARE). Pedir ao operador horário aproximado da ocorrência para cruzar com o log `admin_route_error` (digest).
- **Recommended fix:** (1) `error.tsx` do Admin: usar `shouldOfferServerActionRefresh` → "Esta tela foi atualizada. Recarregue para continuar; o que não foi salvo precisa ser refeito." + botão "Recarregar página" (`location.reload()`), sem reenviar dados; (2) texto genérico "Não foi possível concluir esta ação. Nada foi alterado/Verifique antes de repetir." quando a falha vem de ação; (3) mostrar o `digest` para o operador citar no suporte. Não alterar a lógica de promoções.
- **Dependencies:** logs de produção (opcional, para fechar a causa).
- **Regression risk:** baixo — só o boundary; manter `console.error("admin_route_error", { digest })`.

### UIUX-PDP-002 — "ou até 12x no cartão" aparece mesmo quando 12x é impossível
- **ID:** UIUX-PDP-002
- **Priority:** P1
- **Type:** COPY (TRUST)
- **Route:** `/produto/[slug]`
- **Viewport:** todas
- **Problem:** `buildCardInstallmentHint` calcula o "sem juros" respeitando a parcela mínima, mas o "ou até 12x no cartão" usa o máximo configurado, sem olhar o preço. Em produção, **7 de 75 produtos** anunciam 12x e não chegam lá só com o item (mínimo R$ 10,00 por parcela): Meia FiRE R$ 42,21 → máx. 4x; cinco camisetas FiRE/Graffiti R$ 72,00 → máx. 8x; Bape Ape Head Socks R$ 89,10 → máx. 10x. No lab, um item de R$ 30,00 mostra "até 12x" e o checkout oferece só 1x–3x.
- **Impact:** promessa que o checkout não cumpre; quebra de confiança no momento de pagar.
- **Evidence:** `pdp-installments.json` (varredura de todas as PDPs do sitemap); `lab/product/pdp-meia-r30-1440.png`, `lab/checkout/checkout-meia-r30-1440.png`; `lab/metrics.json` (`pdp cheap R$30`).
- **Recommended fix (somente texto):** usar o maior número de parcelas viável para o preço do item (`listCardInstallmentPlans(preço).at(-1)`) e redigir "ou até Nx no cartão" com N real, **ou** "parcelamento no cartão conforme o total do pedido" quando N < máximo. Manter a regra "sem valor com acréscimo na PDP".
- **Dependencies:** nenhuma.
- **Regression risk:** baixo — `card-installments.spec.ts` verifica o texto "ou em até 3x sem juros · ou até 12x no cartão" para R$ 600 (continua verdadeiro).

### UIUX-HOME-001 — Arte do banner com texto e "botão" embutidos colide com o texto do site
- **ID:** UIUX-HOME-001
- **Priority:** P1
- **Type:** UI
- **Route:** `/` (hero)
- **Viewport:** todas (pior em 320–430)
- **Problem:** o banner Black Friday ativo tem texto e um botão "COMPRAR AGORA" desenhados na imagem. O carrossel sobrepõe eyebrow ("SALE BLACK FRIDAY"), subtítulo e indicadores em cima dessa arte; no celular o texto do site cruza "ATÉ 30% OFF" e os indicadores ficam sobre o falso botão (cinza escuro sobre preto, ilegível). O botão real do site não aparece (o banner inteiro é o link).
- **Impact:** primeira dobra da loja com texto sobre texto e um CTA que parece desabilitado.
- **Evidence:** `gallery/storefront/mobile/chromium-{320,390}-home*.png`, `gallery/storefront/desktop/chromium-1440-home-full.png`.
- **Recommended fix:** (conteúdo + UI) no Admin de banners: opção "a arte já contém texto" que oculta eyebrow/título/subtítulo do site e reposiciona os indicadores para fora da arte; guia de "área segura" no preview desktop/mobile; recomendação de arte sem botão desenhado quando houver CTA. No storefront: indicadores abaixo da mídia no mobile.
- **Dependencies:** `home-banner-form.tsx` (campo novo exige migration → avaliar no REFINE; alternativa sem migration: ocultar overlay quando título/subtítulo vazios e orientar o operador).
- **Regression risk:** baixo/médio — preservar crop desktop/mobile, contraste do scrim (teste numérico existente) e alvos de 44 px dos indicadores.

### UIUX-CHECKOUT-002 — Falha temporária é exibida como "checkout pausado"
- **ID:** UIUX-CHECKOUT-002
- **Priority:** P1
- **Type:** BUG (COPY)
- **Route:** `/finalizar-compra`
- **Viewport:** todas
- **Problem:** quando o servidor cai no erro genérico ("Checkout temporariamente indisponível. Tente novamente em alguns minutos." — qualquer exceção não mapeada, ex.: provedor fora), o cliente reescreve qualquer texto que **contenha** "Checkout temporariamente indisponível" para "O checkout está temporariamente pausado. Consulte a RARE para verificar disponibilidade." (`formatCheckoutMessage`, `cart-page-client.tsx:174`).
- **Impact:** uma falha momentânea parece loja fechada; o cliente desiste em vez de tentar de novo.
- **Evidence:** código (`src/app/api/checkout/route.ts:74` + `cart-page-client.tsx:175`); não provocado em produção (exigiria falha real).
- **Recommended fix:** comparar a mensagem exata da pausa (`checkoutUnavailableMessage`) e deixar a genérica passar; texto proposto para a genérica: "Não conseguimos iniciar o pagamento agora. Seu carrinho foi mantido — tente de novo em alguns instantes."
- **Dependencies:** nenhuma.
- **Regression risk:** baixo — só mapeamento de texto; teste unitário de `formatCheckoutMessage`.

---

## P2

### UIUX-SUPPORT-001 (OP) — Estado pós-envio do suporte básico demais
- **ID:** UIUX-SUPPORT-001
- **Priority:** P2
- **Type:** UI (UX, TRUST)
- **Route:** `/suporte` (e `/contato`)
- **Viewport:** todas
- **Problem:** cartão dentro de cartão; protocolo no meio da frase; um único botão; introdução do formulário continua acima; WhatsApp só aparece se configurado; sem atalhos de assunto nem ligação com pedidos.
- **Impact:** confirmação parece improvisada; cliente não guarda o protocolo.
- **Evidence:** `lab/storefront/suporte-recebido-{390,1440}.png`, `lab/storefront/suporte-form-logado-*.png`; `gallery/institutional/*/chromium-*-suporte*.png`, `*-contato*.png`.
- **Recommended fix:** estado "Solicitação recebida" substituindo o formulário (sem cartão aninhado): protocolo em destaque com botão **Copiar** (feedback "Copiado"), "A resposta será enviada para o e-mail informado." (sem prazo), [Ver meus pedidos] (logado) / [Voltar para a loja], "Prefere falar diretamente?" [WhatsApp] [Instagram]. Antes do envio: atalhos de assunto (pré-selecionam `categoria`, que já existe na URL) e cabeçalho mais enxuto. Não inventar SLA.
- **Dependencies:** nenhuma.
- **Regression risk:** baixo — `support.spec.ts` (honeypot, limites, teclado) e idempotência por `submissionKey`.

### UIUX-BRANDS-001 (OP) — Faixa de marcas parada para quem já clicou no hero
- **ID:** UIUX-BRANDS-001
- **Priority:** P2
- **Type:** BUG (UI)
- **Route:** `/`
- **Viewport:** todas
- **Problem:** hero e faixa compartilham `rare:home-motion-paused`. Um clique numa seta/indicador do hero (`select()` → `setPaused(true)`) pausa a faixa **para sempre** naquele navegador. O "Retomar animações" fica no bloco "Drop RARE". Marcas não são clicáveis. A lista já é automática (catálogo), não hardcoded.
- **Impact:** a faixa parece quebrada para o próprio operador e para clientes recorrentes.
- **Evidence:** `brands-marquee.json` (novo visitante −131 px/2 s; após clique na seta 0 px e `storedPaused=true`; após reload continua 0 px; reduced-motion parado de propósito).
- **Recommended fix:** desacoplar: interação no hero pausa só o hero (estado em memória); a faixa obedece apenas `prefers-reduced-motion`, visibilidade da aba e hover/foco **nela**. Cada marca como link para `/categoria/tudo?brand=<marca>` (rota real). Loop sem salto (duas cópias já existem). Configuração "Faixa de marcas: Automático/Manual" no Admin fica para depois (exige modelo novo; sem HTML livre).
- **Dependencies:** UIUX-CATALOG-001 (destino do link vira filtro com interface). Corrigir "Trasher" → "Thrasher" no cadastro (dado).
- **Regression risk:** baixo — `home-motion.test.ts` (nunca autoplay vazio), reduced motion.

### UIUX-GLOBAL-001 — `font: inherit` global anula as classes de fonte de botões e campos
- **ID:** UIUX-GLOBAL-001
- **Priority:** P2
- **Type:** CONSISTENCY
- **Route:** global (loja e Admin)
- **Viewport:** todas
- **Problem:** `src/app/globals.css:44-49` (`button, input, select, textarea { font: inherit; }`) fica fora das camadas do Tailwind v4 e vence `font-black`, `text-sm` etc. Medido em produção: "Acessórios", "Preferências de Cookies", tamanhos P/M/G, "ADICIONAR AO CARRINHO", "Calcular frete", busca — todos declaram peso/tamanho e renderizam **400 / 16 px**. No Admin: "Duplicar/Ativar/Encerrar" (botões) leves ao lado de "Editar/Pré-visualizar" (links) em negrito.
- **Impact:** hierarquia tipográfica inconsistente em CTAs e navegação; aparência de componente "quebrado".
- **Evidence:** saída de `tests/uiux-audit/font-inherit-probe.mjs`; prints da home, PDP e `lab/admin/promocao-editada-ok-1440.png`.
- **Recommended fix:** mover a regra para `@layer base` (ou `:where(button, input, select, textarea)`), para que utilitários vençam. **Manter 16 px nos inputs no mobile** (evita zoom automático do iOS) — revisar cada `text-sm`/`text-xs` em campo.
- **Dependencies:** nenhuma; fazer antes dos itens visuais para não ajustar duas vezes.
- **Regression risk:** médio — muda a aparência de todos os botões de uma vez; exige rodada de screenshots (matriz `tests/visual-storefront` + Admin).

### UIUX-CHECKOUT-003 — Erro não-JSON vira mensagem técnica para o cliente
- **ID:** UIUX-CHECKOUT-003
- **Priority:** P2
- **Type:** BUG
- **Route:** `/finalizar-compra` (iniciar checkout, calcular frete, salvar CPF)
- **Viewport:** todas
- **Problem:** `const data = await response.json()` antes de checar `response.ok` (`cart-page-client.tsx` ~389 e ~556). Se a resposta for HTML (502 do proxy, página de erro), o cliente mostra o texto do parser (ex.: "Unexpected token '<' …").
- **Impact:** mensagem técnica em português/inglês misturado no momento mais sensível.
- **Evidence:** código; não provocado em produção.
- **Recommended fix:** ler `response.json().catch(() => null)` e cair em mensagem humana ("Não conseguimos falar com o servidor. Tente de novo."). Nunca expor `error.message` de parser/rede.
- **Dependencies:** UIUX-CHECKOUT-004 (textos).
- **Regression risk:** baixo.

### UIUX-CHECKOUT-004 — Mensagens de erro genéricas ou sem a informação que resolve
- **ID:** UIUX-CHECKOUT-004
- **Priority:** P2
- **Type:** COPY
- **Route:** `/finalizar-compra`, `/api/checkout`, `/api/shipping/quote`
- **Viewport:** todas
- **Problem:** inventário (texto atual → problema → proposta):
  - "Produto indisponível." → não diz qual → "**{Produto} (tam. {G})** acabou de esgotar. Remova para continuar."
  - "Estoque insuficiente para finalizar este carrinho." → não diz qual nem quantas → "Só restam **N** unidades de {Produto}. Ajustamos a quantidade."
  - "Variação inválida." → técnico → "Esse tamanho não está mais disponível. Escolha outro."
  - "Revise os dados do checkout." → vago → apontar o campo.
  - "Falha ao iniciar checkout." / "Checkout temporariamente indisponível. Tente novamente em alguns minutos." → genérico → ver UIUX-CHECKOUT-002.
  - "Frete indisponível." / "Frete indisponível no momento. Tente novamente em alguns instantes." → ok, mas sem ação → acrescentar "ou fale com a RARE pelo WhatsApp".
  - "Muitas tentativas. Aguarde um instante." → ok.
  - "Você já tem um checkout em andamento…" → ok, mas oferecer o link "Continuar pagamento".
  - "O valor mínimo para pagamento é de R$ 10,00…" → claro (manter).
  - "Não foi possível salvar o CPF." → sem motivo → diferenciar CPF inválido/indisponível.
  - Sessão expirada: não há mensagem própria (o fluxo redireciona para login) → avisar "Sua sessão expirou; seu carrinho foi mantido".
- **Impact:** cliente não sabe o que fazer; contato no suporte.
- **Evidence:** `src/app/api/checkout/route.ts` (`publicCheckoutErrors`), `src/lib/checkout.ts:70-78`, `src/lib/shipping-errors.ts`, `cart-page-client.tsx:161-180`.
- **Recommended fix:** catálogo de mensagens com ação; quando a mensagem citar produto, o servidor devolve código + `variantId` (não texto livre) e o cliente monta o texto. Mudança de contrato de erro: avaliar no REFINE.
- **Dependencies:** UIUX-CHECKOUT-002/003.
- **Regression risk:** médio — o servidor hoje usa a própria mensagem como contrato (`publicCheckoutErrors`); testes de rota cobrem as strings.

### UIUX-CHECKOUT-005 — Composição do checkout no desktop e ordem do resumo
- **ID:** UIUX-CHECKOUT-005
- **Priority:** P2
- **Type:** UI
- **Route:** `/finalizar-compra`
- **Viewport:** 1024–1920
- **Problem:** a coluna esquerda (itens, contato, entrega) termina cedo e deixa um grande vazio, enquanto pagamento, parcelamento, avisos e CTA se acumulam na direita. O "Total" aparece antes da escolha de pagamento/parcelamento. O aviso "Sua reserva está em andamento" usa largura diferente do container da página.
- **Impact:** decisão de pagamento espremida numa coluna longa; leitura do total confusa.
- **Evidence:** `lab/checkout/checkout-cartao-12x-1440.png`, `lab/checkout/checkout-pix-1440.png`.
- **Recommended fix:** passos na coluna esquerda (1 Contato · 2 Entrega · 3 Pagamento e parcelamento); coluna direita só com resumo + total final + CTA, sticky. Alinhar o aviso de reserva ao container.
- **Dependencies:** UIUX-CHECKOUT-001.
- **Regression risk:** alto (tela financeira) — só layout; mesmos estados (`needsCpf`, `belowMinimumPayment`, frete obrigatório, botão desabilitado).

### UIUX-PDP-003 — No celular, título e "Adicionar ao carrinho" ficam fora da primeira tela
- **ID:** UIUX-PDP-003
- **Priority:** P2
- **Type:** RESPONSIVE (CONVERSION)
- **Route:** `/produto/[slug]`
- **Viewport:** 360, 390, 430
- **Problem:** galeria + miniaturas ocupam a primeira tela; em 390 px o `h1` começa em y≈803 e o botão em y≈1.192 (tela de 800 px).
- **Impact:** o cliente não vê nome/preço/CTA sem rolar.
- **Evidence:** saída de `tests/uiux-audit/mobile-pdp-probe.mjs`; `gallery/product/mobile/chromium-*-pdp-*.png`.
- **Recommended fix:** reduzir a altura da galeria no mobile (miniaturas em faixa rolável ou pontos) e/ou barra fixa inferior com preço + CTA que aparece quando o botão principal sai da tela (somente quando o checkout está habilitado e a variação está selecionada/disponível).
- **Dependencies:** UIUX-PDP-001.
- **Regression risk:** médio — não duplicar CTA quando compras pausadas; foco/teclado do zoom.

### UIUX-ORDERS-002 — Detalhe do pedido: hierarquia e vazio
- **ID:** UIUX-ORDERS-002
- **Priority:** P2
- **Type:** UX
- **Route:** `/minha-conta/pedidos/[id]`
- **Viewport:** 1024–1920 (vazio); todas (hierarquia)
- **Problem:** o cartão "Itens" estica até a altura da coluna direita (grande área branca com 1 item); o resumo mistura dinheiro e logística ("Método", "CEP entrega" entre "Frete" e "Acréscimo"); sem data/hora do pedido nem do pagamento; pedido "Aguardando pagamento" não oferece "Continuar pagamento" enquanto a janela está aberta; sem link para o produto.
- **Impact:** densidade baixa e informação importante dispersa.
- **Evidence:** produção (`RARE-20261117-XQQJL7`, Chrome do operador); `lab/account/pedido-1-itens-awaiting_payment-1440.png`.
- **Recommended fix:** `items-start` no grid; cabeçalho com status (ícone + texto), data e forma de pagamento; resumo em blocos: Valores (subtotal, cupom, frete, acréscimo, total) · Pagamento (método, parcelas) · Entrega (método, prazo, endereço, CEP); CTA "Continuar pagamento" (mesmo link/prazo que o aviso do checkout já usa) só quando `awaiting_payment` e dentro do prazo.
- **Dependencies:** UIUX-ORDERS-001.
- **Regression risk:** baixo — leitura; o CTA usa o fluxo existente.

### UIUX-ACCOUNT-001 — Abas da conta cortam a aba ativa no celular
- **ID:** UIUX-ACCOUNT-001
- **Priority:** P2
- **Type:** RESPONSIVE
- **Route:** `/minha-conta/*`
- **Viewport:** 320–430
- **Problem:** Resumo/Dados/Endereços/Pedidos numa linha rolável; em 390 a aba ativa "Pedidos" fica cortada na borda sem indicação de rolagem.
- **Impact:** o cliente não vê onde está.
- **Evidence:** `lab/account/minha-conta_pedidos-390.png`.
- **Recommended fix:** grade 2×2 ou rótulos curtos no mobile; ou rolar a aba ativa para a vista + degradê de borda.
- **Dependencies:** nenhuma.
- **Regression risk:** baixo — manter `aria-current` (corrigido no ciclo pré-launch).

### UIUX-IMG-001 — Quase metade das imagens do catálogo ainda é o arquivo original (PNG de ~2 MB)
- **ID:** UIUX-IMG-001
- **Priority:** P2
- **Type:** PERFORMANCE
- **Route:** `/categoria/*`, home, busca (cards); PDP (miniaturas)
- **Viewport:** todas (pior no mobile em rede móvel)
- **Problem:** revalidação do item "produtos sem thumbnail": em `/categoria/tudo` (produção), 101 `<img>` de produto, todas servidas direto do R2 (sem otimizador): **22 de 51 imagens principais** e **28 de 49 imagens de hover** apontam para o arquivo original, sem variante `rare-v1` — ex.: `…-bape2.png` 2,48 MB, `…-supreme-new-shit.png` 2,39 MB (1086×1448), `…-pallll.png` 2,18 MB. No tablet (768/820) a miniatura da PDP usa a variante de 92–98 px exibida a 128–138 px (fica borrada).
- **Impact:** rolar o catálogo no celular baixa dezenas de MB; cards aparecem cinza por mais tempo (UIUX-PERF-001).
- **Evidence:** análise do HTML de `/categoria/tudo` (contagem por tipo de URL); `report.json` (`lowResImages`: PDP 768/820, banner do login 430).
- **Recommended fix:** rodar `npm run media:variants:audit` (somente leitura) e, com autorização, `media:variants:backfill` — **não executado neste ciclo**; usar variante maior para miniaturas ≥ 120 px; banner do login com `sizes` correto em 430 px.
- **Dependencies:** autorização operacional para o backfill (escreve no storage/banco).
- **Regression risk:** baixo para UI; o backfill é operação de dados (fora do REFINE visual).

### UIUX-FORMS-001 — Endereço e cadastro sem autopreenchimento e com estilo do Admin
- **ID:** UIUX-FORMS-001
- **Priority:** P2
- **Type:** UX
- **Route:** `/minha-conta/enderecos` (também usado no checkout via "Cadastrar ou editar"), `/minha-conta/dados`, `/cadastro`
- **Viewport:** todas (pior no mobile)
- **Problem:** os 10 campos do endereço não têm `autocomplete` (0 ocorrências) — o navegador/gerenciador não preenche; não há busca de endereço pelo CEP; "Telefone" fica entre CEP e Rua; os campos usam a classe `admin-input` (estilo do Admin) dentro da loja; o formulário "Novo endereço" vem antes da lista de endereços salvos; o texto "Usado como referência do pedido até a ativação do frete real." está desatualizado (o frete real está ativo). No cadastro, telefone sem `inputMode="tel"`.
- **Impact:** mais digitação e erro no passo que antecede o pagamento.
- **Evidence:** `lab/account/minha-conta_enderecos-{390,1440}.png`; `src/components/store/customer-addresses.tsx:39-88`; `customer-auth-forms.tsx:121`.
- **Recommended fix:** `autocomplete` (`name`, `postal-code`, `address-line1`, `address-line2`, `address-level2`, `address-level1`, `tel`); preencher rua/bairro/cidade/UF a partir do CEP (somente sugestão editável, com serviço já usado no frete ou ViaCEP — decidir no REFINE); ordem CEP → Rua → Número → Complemento → Bairro → Cidade/UF → Destinatário/Telefone; lista salva primeiro e "Adicionar endereço" recolhido; classe `store-input`; texto atualizado.
- **Dependencies:** UIUX-GLOBAL-001 (tamanho de fonte dos campos).
- **Regression risk:** baixo/médio — validação `customerAddressSchema` e ownership não mudam; a consulta de CEP não pode bloquear o envio.

### UIUX-A11Y-001 — Tabelas roláveis da Política de Cookies sem acesso por teclado
- **ID:** UIUX-A11Y-001
- **Priority:** P2
- **Type:** ACCESSIBILITY
- **Route:** `/politica-de-cookies`
- **Viewport:** 320–430
- **Problem:** axe `scrollable-region-focusable` (serious), 2 nós: os contêineres `overflow-x-auto` das tabelas Essenciais e Análise não recebem foco.
- **Impact:** quem usa teclado não consegue rolar a tabela no celular.
- **Evidence:** `report.json` (rota `cookies`, 390); `gallery/institutional/mobile/chromium-390-cookies-full.png`.
- **Recommended fix:** `tabIndex={0}` + `role="region"` + `aria-labelledby` no contêiner, ou layout em cartões abaixo de 640 px.
- **Dependencies:** nenhuma.
- **Regression risk:** baixo — `cookie-policy` gera a página do mesmo catálogo (testes).

### UIUX-A11Y-002 — Foco escondido atrás do header fixo
- **ID:** UIUX-A11Y-002
- **Priority:** P2
- **Type:** ACCESSIBILITY (WCAG 2.4.11)
- **Route:** PDP, home, catálogo
- **Viewport:** 390 e 1440 (Chromium e WebKit)
- **Problem:** ao navegar com Tab, alguns elementos recebem foco por baixo do header sticky (136–158 px): WebKit — "Ir para slide 4", "Próxima imagem" (390), tamanho "G" e "Imagem anterior" (1440); Chromium — 1 parada no catálogo. Não há `scroll-padding-top`.
- **Impact:** usuário de teclado perde o elemento focado.
- **Evidence:** `keyboard.json` (`underStickyHeader`).
- **Recommended fix:** `html { scroll-padding-top: <altura do header> }` (variável por breakpoint).
- **Dependencies:** nenhuma.
- **Regression risk:** baixo — âncoras (`#store-main`) também passam a compensar o header (desejável).

### UIUX-COOKIES-001 — Painel "Configurar" mostra nomes técnicos internos
- **ID:** UIUX-COOKIES-001
- **Priority:** P2
- **Type:** COPY
- **Route:** banner/painel de cookies (global), `/politica-de-cookies`
- **Viewport:** todas
- **Problem:** cada cookie aparece pelo nome técnico em fonte mono (`rare_cookie_consent`, `rare_customer_session`, **`rare_admin_session`**, **`rare_admin_mfa_pending`**, `rare_store_cart`, `rare:home-motion-paused`…), inclusive os do painel administrativo, que nunca existem no navegador do cliente.
- **Impact:** painel técnico demais para o comprador; expõe detalhes internos do Admin.
- **Evidence:** `src/lib/cookie-consent.ts:94-120`; `src/components/store/cookie-consent.tsx`.
- **Recommended fix:** no painel: só categoria, finalidade em linguagem simples e duração; nomes técnicos ficam na Política de Cookies (detalhe expansível). Avaliar com o jurídico se os cookies do Admin precisam constar na política pública ou em seção "equipe da loja".
- **Dependencies:** revisão jurídica (texto); não alterar a lógica de consentimento.
- **Regression risk:** baixo — o teste que compara catálogo × armazenamento continua valendo (não remover entradas, só a apresentação).

### UIUX-404-001 — Páginas 404 fora da identidade da loja
- **ID:** UIUX-404-001
- **Priority:** P2
- **Type:** UX
- **Route:** URL inexistente (ex.: `/esta-pagina-nao-existe`) e produto inexistente (`/produto/<slug-inexistente>`)
- **Viewport:** todas
- **Problem:** (a) 404 geral (`src/app/not-found.tsx`): página branca, sem logo/header/rodapé/busca; só dois botões. (b) 404 de produto: cabeçalho mínimo diferente (73 px, "RARE" em texto, fundo branco), **fonte do sistema** em vez da Geist da loja, sem rodapé/busca. Ambos em 3 motores e 11 larguras.
- **Impact:** parece outro site justamente para quem chega por link antigo de produto (anúncio, Instagram, Google).
- **Evidence:** `gallery/storefront/{mobile,desktop}/chromium-{390,1440}-404-full.png`; `gallery/product/{mobile,desktop}/chromium-{390,1440}-pdp-404-full.png`; `report.json` (`headerHeight` = null no 404 geral e 73 no de produto, contra 136/158 na loja).
- **Recommended fix:** renderizar o 404 dentro do layout da loja (header, busca, rodapé), manter "Ir para a Home" / "Ver catálogo" e acrescentar busca ou destaques.
- **Dependencies:** nenhuma.
- **Regression risk:** baixo — status HTTP 404 e `noindex` devem continuar.

### UIUX-ADMIN-001 — Admin: textos sem acento e jargão técnico
- **ID:** UIUX-ADMIN-001
- **Priority:** P2
- **Type:** COPY
- **Route:** `/admin/settings`, `/admin/orders/[id]`, `/admin/notifications`, `/admin/customers/[id]`, `/admin/promotions/[id]`
- **Viewport:** todas
- **Problem:** "Notificacoes", "Metodo", "Endereco de entrega", "Nenhum endereco…", "Exigir endereco no checkout", "FRETE GRATIS ACIMA DE", "INSTRUCOES DE FRETE"; opções "Correios via env", "Melhor Envio automático via env", "Frenet via env", "Legado: futuro provedor real", rótulo "PROVIDER ATIVO", "O checkout recalcula o frete no backend"; no pedido "Método: card", "Cobrança: -"; histórico da promoção "updated/created" em inglês; texto da Prontidão ainda cita "payload Stripe".
- **Impact:** aparência de ferramenta inacabada; risco de erro humano em configuração de frete (opções técnicas no mesmo menu da opção de produção).
- **Evidence:** grep no código (ver relatório); `lab/admin/*.png`; Admin de produção (Configurações, Prontidão).
- **Recommended fix:** revisar acentuação; traduzir códigos (card → Cartão de crédito; created/updated → Criada/Editada); separar opções de homologação em grupo "Avançado/Legado" com aviso.
- **Dependencies:** nenhuma.
- **Regression risk:** baixo — testes que procuram strings exatas precisam acompanhar.

### UIUX-ADMIN-002 — Configurações: dois "Salvar" na mesma página e nenhum aviso de alteração não salva
- **ID:** UIUX-ADMIN-002
- **Priority:** P2
- **Type:** UX (risco operacional)
- **Route:** `/admin/settings` (SYSTEM_ADMIN)
- **Viewport:** todas
- **Problem:** "Salvar configurações" (loja/frete/reserva) e "Salvar parcelamento" (máximo, mínimo, % por parcela) são formulários independentes na mesma rolagem. Alterar campos dos dois e clicar só um descarta o outro em silêncio; não há `beforeunload` em nenhum formulário do Admin.
- **Impact:** campos financeiros (parcelamento, frete grátis, valor fixo) podem ficar diferentes do que o operador acredita ter salvo.
- **Evidence:** Admin de produção (Chrome do operador, leitura); `grep beforeunload src` = 0.
- **Recommended fix:** indicador "alterações não salvas" por seção + aviso ao sair; confirmação com resumo antes de salvar o parcelamento ("4x passa a 9%…"). O exemplo de R$ 600,00 já existente é bom — manter.
- **Dependencies:** nenhuma.
- **Regression risk:** baixo (só UI); não mudar validação (`parsePercentToBps`, piso de R$ 10,00).

### UIUX-ADMIN-003 — Prontidão diz "bloqueado para venda aberta" com a loja no ar
- **ID:** UIUX-ADMIN-003
- **Priority:** P2
- **Type:** UX
- **Route:** `/admin/readiness`
- **Viewport:** todas
- **Problem:** o painel mostra "Pronto para homologação; bloqueado para venda aberta" (1 bloqueio, 9 evidências pendentes) enquanto a produção vende desde 2026-11-16.
- **Impact:** sinal operacional desatualizado ensina o operador a ignorar o painel.
- **Evidence:** Admin de produção (Chrome do operador, leitura).
- **Recommended fix:** revisar as evidências marcadas como pendentes (processo, não código) e/ou rótulo que diferencie "checklist histórico" de "estado atual".
- **Dependencies:** operador.
- **Regression risk:** nenhum (conteúdo).

### UIUX-ADMIN-004 — Admin no celular: utilizável, mas páginas muito longas e "Salvar" só no fim
- **ID:** UIUX-ADMIN-004
- **Priority:** P2
- **Type:** RESPONSIVE
- **Route:** `/admin/products`, `/admin/products/[id]/edit`, `/admin/products/new`, `/admin`
- **Viewport:** 390, 768
- **Problem:** sem overflow horizontal em nenhuma das 16 telas (390/768/1440). Porém: lista de produtos com 11.120 px (390) / 9.818 px (768) para 25 produtos; edição de produto com 4.176 px e o único "Salvar produto" no fim; visão geral 7.149 px. Pedido de 20 itens: 3.791 px, legível. Nenhuma tela inviável.
- **Impact:** operação pelo celular lenta e sujeita a perder edição.
- **Evidence:** `lab/metrics.json` (`admin * 390/768`); `lab/admin/*-390.png`, `*-768.png`.
- **Recommended fix:** lista de produtos em linhas compactas no mobile; barra de ação fixa ("Salvar") no formulário; seções recolhíveis (Mídia, Frete, Variações).
- **Dependencies:** UIUX-ADMIN-002 (aviso de não salvo).
- **Regression risk:** baixo.

---

## P3

### UIUX-CHECKOUT-006 — Radios de parcelamento com tamanhos diferentes
- **Priority:** P3 · **Type:** UI · **Route:** `/finalizar-compra` · **Viewport:** 320–430 (e onde o texto quebra)
- **Problem:** o `input` (`h-4 w-4`) dentro do `label` flex encolhe quando o texto quebra em duas linhas; 4x–12x ficam menores que 1x–3x.
- **Impact:** aparência descuidada numa tela financeira.
- **Evidence:** `lab/checkout/checkout-cartao-12x-390-viewport.png`.
- **Recommended fix:** `shrink-0` no input (resolvido de vez por UIUX-CHECKOUT-001).
- **Dependencies:** UIUX-CHECKOUT-001. **Regression risk:** nenhum.

### UIUX-A11Y-003 — Alvos de toque abaixo de 44 px
- **Priority:** P3 · **Type:** ACCESSIBILITY · **Route:** catálogo, PDP, home, login/cadastro · **Viewport:** mobile
- **Problem:** atalhos do catálogo 40 px de altura; "Mostrar senha" 40×40; logo 86×32; breadcrumbs 16 px de altura; "Ver acessórios" (home) 16 px; "Ver política de envio" e "Troca e devolução em até 7 dias" (PDP) 20 px. Os de 16 px ficam abaixo do mínimo AA de 24 px (2.5.8) se não houver espaçamento suficiente.
- **Impact:** toque impreciso no celular.
- **Evidence:** `report.json` (`small24`, `small44`).
- **Recommended fix:** `min-h-11` (ou padding vertical) nesses links/botões; manter visual.
- **Dependencies:** UIUX-NAV-001 (os atalhos podem sair). **Regression risk:** baixo.

### UIUX-ORDERS-003 — Itens do pedido sem ordem definida
- **Priority:** P3 · **Type:** BUG · **Route:** `/minha-conta/pedidos/[id]`, `/admin/orders/[id]` · **Viewport:** todas
- **Problem:** `include: { items: true }` sem `orderBy`; no lab o pedido de 20 itens aparece 01, 02, 11, 12 … 20, 03 … 10. Em produção os ids são `cuid` (quase sempre em ordem), mas o Postgres não garante.
- **Impact:** ordem diferente entre cliente, Admin e e-mail.
- **Evidence:** `lab/account/pedido-20-itens-refunded-1440.png`, `lab/admin/admin_orders_pedido-20-itens-390.png`.
- **Recommended fix:** `orderBy: { createdAt: "asc" }, id` nas duas telas.
- **Dependencies:** nenhuma. **Regression risk:** nenhum.

### UIUX-CATALOG-002 — Contagem "nesta página" e busca sem contagem
- **Priority:** P3 · **Type:** COPY · **Route:** `/categoria/*`, `/?q=` · **Viewport:** todas
- **Problem:** "24 produtos nesta página · Página 1" em vez do total; a busca não mostra quantos resultados.
- **Impact:** cliente não sabe o tamanho da seleção.
- **Evidence:** prints de catálogo e busca.
- **Recommended fix:** total real ("32 produtos") — junto com UIUX-CATALOG-001.
- **Dependencies:** UIUX-CATALOG-001. **Regression risk:** baixo (consulta de contagem).

### UIUX-COOKIES-002 — Banner de cookies ocupa ~metade da tela no celular
- **Priority:** P3 · **Type:** UX · **Route:** global · **Viewport:** 320–430
- **Problem:** texto de 5 linhas + três botões de largura total empilhados cobrem ~45% da tela na primeira visita.
- **Impact:** primeira impressão encoberta.
- **Evidence:** `gallery/storefront/mobile/chromium-{320,360,375,390}-_cookie-banner.png`.
- **Recommended fix:** texto de 2 linhas; "Aceitar" e "Recusar" lado a lado (mesmo peso — requisito já testado), "Configurar" como link.
- **Dependencies:** nenhuma; não alterar a lógica de consentimento. **Regression risk:** baixo (teste compara cores dos botões).

### UIUX-TYPE-001 — Texto de 10–11 px em uso amplo
- **Priority:** P3 · **Type:** UI · **Route:** cards (categoria, "DISPONÍVEL"), home (contagens), PDP · **Viewport:** mobile
- **Problem:** 121 elementos de texto com 10 px no catálogo completo em 390 px (rótulo de categoria e disponibilidade dos cards), em caixa alta com espaçamento largo.
- **Impact:** legibilidade baixa em telas pequenas; esforço para ler disponibilidade.
- **Evidence:** `report.json` (`tinyText`).
- **Recommended fix:** mínimo de 11–12 px no mobile para informação (não decorativa).
- **Dependencies:** UIUX-GLOBAL-001. **Regression risk:** baixo.

### UIUX-PERF-001 — Layout shift intermitente em páginas curtas e cards cinza até carregar
- **Priority:** P3 · **Type:** PERFORMANCE · **Route:** `/?q=<sem resultado>`, `/categoria/*?brand=<sem resultado>`, `/finalizar-compra` (vazio) · **Viewport:** 320, 430, 768, 820, 1280 (Chromium)
- **Problem:** CLS 0 em 311 das 319 medições Chromium (2 abaixo de 0,05); nas páginas curtas de estado vazio apareceram picos de **0,10–0,44** (busca sem resultado 768 = 0,38; carrinho vazio 820 = 0,44) — provavelmente o rodapé se reposicionando quando o conteúdo/fonte termina de carregar; não reproduz em todas as larguras. LCP local ≤ 1,26 s. Cards abaixo da dobra ficam como blocos cinza lisos até a imagem chegar (sem skeleton/LQIP), agravado por UIUX-IMG-001.
- **Impact:** baixo (páginas de pouco tráfego); salto visível no estado vazio.
- **Evidence:** `report.json` (`vitals`).
- **Recommended fix:** reservar altura mínima do conteúdo (`min-h` no `main`) nos estados vazios; placeholder com cor dominante/blur nas miniaturas quando houver variante.
- **Dependencies:** `media:variants` (backfill fora do escopo). **Regression risk:** baixo.
