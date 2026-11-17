# RARE-UIUX-AUDIT-01 — Auditoria de UI/UX (storefront, conta, checkout, Admin)

Data: 2026-11-17 (UTC). Branch: `audit/rare-uiux-01`. Somente auditoria: nenhuma tela, regra ou
configuração foi alterada; nada foi implantado.

```text
BASE_SHA=2adec1a4b54b22a86b7a537460ba9d6332a2af00   (origin/main = HEAD da branch no início)
WORKTREE_CLEAN=YES
PRODUCTION_SHA=2adec1a (último merge implantado: PR #5; deploy automático da main)
PRODUCTION_CHANGED=NO
OPERATOR_FINDINGS_RECEIVED=7
```

Documentos: [UIUX_BACKLOG.md](./UIUX_BACKLOG.md) (todos os itens com problema/impacto/evidência/correção),
[OPERATOR_FINDINGS.md](./OPERATOR_FINDINGS.md), [SCREENSHOT_GALLERY.md](./SCREENSHOT_GALLERY.md).

## Executive Summary

A loja está **tecnicamente sólida**: nenhuma rolagem horizontal, corte ou elemento fora da tela em
493 páginas medidas (29 rotas × 11 larguras no Chromium + 3 larguras no WebKit e no Firefox),
layout shift zero em 311 de 319 medições, foco visível em todos os controles percorridos, armadilha de
foco e Esc corretos no menu e no carrinho, axe limpo exceto um caso. Os problemas estão em **hierarquia,
densidade e clareza** — exatamente o que o operador relatou — e em alguns pontos de **texto
financeiro e mensagens de erro**.

Os 7 achados do operador foram **reproduzidos**. Dois corrigem a premissa:
- a faixa de marcas **já é automática** (vem do catálogo); ela para porque um clique no hero grava
  uma pausa permanente no navegador (provado);
- a fileira de categorias do catálogo é a **única navegação rápida no mobile** (o header só mostra a
  barra a partir de 1024 px) — não pode simplesmente sumir.

Achados novos de maior peso:
1. **"ou até 12x no cartão" é exibido em 100% das PDPs**, e em 7 de 75 produtos o preço não comporta
   12x com a parcela mínima de R$ 10 (UIUX-PDP-002).
2. **Falha temporária de checkout aparece como "checkout pausado"** por um mapeamento de texto no
   cliente (UIUX-CHECKOUT-002).
3. **"Falha temporária" no Admin** é o error boundary; reproduzido no lab pela ação desatualizada após
   deploy (aba aberta antes do deploy de 2026-11-17). Backend real não comprovado (UIUX-ADMIN-PROMO-001).
4. Uma regra global de CSS (`font: inherit` fora das camadas do Tailwind 4) **anula o peso/tamanho de
   todos os botões e campos** — origem de várias "inconsistências" visuais (UIUX-GLOBAL-001).
5. Banner do hero com texto e botão desenhados colide com o texto do site (UIUX-HOME-001).
6. 43% das imagens principais do catálogo (e 57% das de hover) ainda são o PNG original de ~2 MB,
   sem variante otimizada (UIUX-IMG-001).

| Prioridade | Itens |
| --- | --- |
| P0 | 0 |
| P1 | 9 |
| P2 | 19 |
| P3 | 7 |
| **Total** | **35** |

| Tipo | Itens |
| --- | --- |
| BUG | 5 |
| UX | 10 |
| UI | 6 |
| ACCESSIBILITY | 3 |
| RESPONSIVE | 3 |
| COPY | 5 |
| PERFORMANCE | 2 |
| CONSISTENCY | 1 |

Nenhum P0: nada impede comprar ou operar hoje. Pagamento, parcelamento, SKU e foto no Admin
(entregas recentes) funcionam como provado nos ciclos anteriores; este ciclo não os tocou.

## Método e cobertura

| Frente | Como | Resultado |
| --- | --- | --- |
| Matriz responsiva (produção, só leitura) | `tests/uiux-audit/production-audit.mjs`: 29 rotas públicas; Chromium em 320/360/375/390/430/768/820/1024/1280/1440/1920; WebKit e Firefox em 375/768/1440; scroll completo antes de medir; banner respondido com "Recusar não essenciais" | ver [Responsive](#responsive) |
| Axe (WCAG 2.0/2.1/2.2 A+AA) | 29 rotas em 390 e 1440 no Chromium (58 execuções) | 1 violação (cookies) |
| Teclado | `keyboard-smoke.mjs`: Tab/Enter/Esc em home, PDP, catálogo, menu mobile, menu Acessórios, carrinho; Chromium + WebKit, 390 e 1440 | foco visível 100%; 1 problema (foco sob header) |
| Parcelamento na PDP | `pdp-installments.mjs`: todas as PDPs do sitemap | 7/75 prometem 12x impossível |
| Faixa de marcas | `brands-marquee-probe.mjs` | causa provada |
| Medidas de layout | `layout-probe.mjs`, `mobile-pdp-probe.mjs`, `font-inherit-probe.mjs` | números nos itens |
| Conta, checkout 1x–12x, suporte enviado, Admin SELLER, edição de promoção | Lab local (`scripts/qa-staging-lab.ts` + `tests/e2e/uiux-audit-lab.spec.ts`): build de produção, Postgres descartável, chave Asaas falsa, e-mail desligado; pedidos sintéticos de 1/2/5/10/20 itens | 6/6 cenários capturados |
| Minha Conta real e Admin SYSTEM | Chrome do operador (sessões já abertas), **somente leitura**: nenhum clique em ação, nenhum formulário enviado | pedido real sem foto confirmado |
| Estados visuais legados | `tests/visual-storefront/states.config.ts` (fixture) | 3/8 — ver Limitações |

Rotas auditadas: **47** (29 públicas em produção; 5 da conta autenticada; checkout autenticado com
cartão e Pix; `/suporte` pós-envio; 16 telas do Admin SELLER no lab; Admin SYSTEM em produção:
Usuários, Configurações, Prontidão). Navegadores: Chromium, WebKit, Firefox.

## P0

Nenhum.

## P1

| ID | Resumo | Tipo |
| --- | --- | --- |
| UIUX-NAV-001 (OP) | Header com 537 px vazios em 1440; catálogo repete 7 categorias | UX |
| UIUX-CATALOG-001 (OP) | Sem filtros/ordenação; `?brand=` só pela URL | UX |
| UIUX-ORDERS-001 (OP) | Pedidos sem foto/identificação visual (lista e detalhe) | UX |
| UIUX-CHECKOUT-001 (OP) | 12 opções de parcela = 852 px; total longe da escolha | UX |
| UIUX-PDP-001 (OP) | Vazio entre bloco comercial e "Detalhes do produto" | UI |
| UIUX-ADMIN-PROMO-001 | "Falha temporária" = boundary do Admin; ação desatualizada após deploy | BUG |
| UIUX-PDP-002 | "até 12x no cartão" incondicional (7/75 impossível) | COPY |
| UIUX-HOME-001 | Texto da arte do banner colide com texto/indicadores do site | UI |
| UIUX-CHECKOUT-002 | Falha momentânea mostrada como "checkout pausado" | BUG |

## P2

UIUX-SUPPORT-001 (OP), UIUX-BRANDS-001 (OP), UIUX-GLOBAL-001, UIUX-CHECKOUT-003, UIUX-CHECKOUT-004,
UIUX-CHECKOUT-005, UIUX-PDP-003, UIUX-ORDERS-002, UIUX-ACCOUNT-001, UIUX-IMG-001, UIUX-FORMS-001, UIUX-A11Y-001, UIUX-A11Y-002,
UIUX-COOKIES-001, UIUX-404-001, UIUX-ADMIN-001, UIUX-ADMIN-002, UIUX-ADMIN-003, UIUX-ADMIN-004.

## P3

UIUX-CHECKOUT-006, UIUX-A11Y-003, UIUX-ORDERS-003, UIUX-CATALOG-002, UIUX-COOKIES-002, UIUX-TYPE-001,
UIUX-PERF-001.

## Storefront

**Header.** Altura estável (136 px no mobile, 158 px no desktop, igual ao registro do pré-launch).
Mobile: ☰, logo central, conta, carrinho e busca em linha própria — limpo. Desktop: a barra de
categorias usa 863 px e deixa a direita vazia (UIUX-NAV-001); "Acessórios ▾" com peso diferente
(UIUX-GLOBAL-001). Menu de Acessórios: abre com seta, foca o primeiro item, Esc devolve o foco
(Chromium e WebKit). Menu mobile: foco vai para "Fechar menu", Tab não escapa, Esc devolve a "Abrir
menu". Header fixo encobre o foco em alguns casos (UIUX-A11Y-002).

**Home.** Hero com arte que já contém texto e um falso botão: sobreposição de texto e indicadores
(UIUX-HOME-001). Faixa de marcas automática, mas pausada para sempre depois de um clique no hero e
sem links (UIUX-BRANDS-001); "Trasher" é dado do cadastro. Seções "Destaques do mês", "Chegou agora",
"Drop RARE", "Escolha por categoria" e faixa de confiança com ritmo consistente; textos de 10 px em
contagens e rótulos (UIUX-TYPE-001). Link "Ver acessórios" com 16 px de altura (UIUX-A11Y-003).

**Busca.** Campo óbvio em todas as larguras (placeholder "Buscar peças, marcas ou categorias");
resultado em grade com título "Resultado para "…""; vazio com "Nada encontrado por aqui." + CTA ao
catálogo — bom. Falta contagem de resultados e ordenação (UIUX-CATALOG-002/001). Sem sugestões ao
digitar (não é defeito; avaliar depois). O h1 repete a busca entre aspas retas.

**Categorias.** Grade 2/3/4/5 colunas conforme a largura, imagens 4:5 sem distorção, preço com
promoção (riscado + selo) e disponibilidade em todos os cards. Estados vazios (categoria vazia,
filtro sem resultado, página além do fim) existem e têm CTA. Problemas: atalhos duplicados
(UIUX-NAV-001), sem filtros/ordenação (UIUX-CATALOG-001), contagem por página (UIUX-CATALOG-002).
Nomes repetidos no catálogo (duas "Camiseta Corteiz") reforçam a necessidade de foto nos pedidos.

**Footer.** Quatro colunas organizadas (marca, categorias, atendimento, institucional), Instagram e
WhatsApp, "Preferências de Cookies" acessível — este último com peso de fonte diferente dos links
(UIUX-GLOBAL-001). Sem problemas de responsividade.

**404.** O 404 geral não tem header/rodapé; o 404 de produto usa um cabeçalho mínimo diferente
(73 px, "RARE" em texto) e fonte do sistema em vez da Geist (UIUX-404-001). Ambos respondem HTTP 404
e oferecem dois caminhos de volta. Nenhuma página de erro expôs stack trace, Prisma, ids internos ou
erro cru de provedor nas rotas visitadas.

## Product

PDP com breadcrumb, galeria com setas, miniaturas, zoom ("Passe o mouse para ampliar · clique para
abrir"), tamanhos com riscado nos esgotados ("GG, esgotado" no nome acessível), quantidade com
"1 unidade disponível", "Adicionar ao carrinho", WhatsApp, cálculo de frete e bloco de confiança.

- Texto de parcelamento: "ou em até 3x sem juros · ou até 12x no cartão" em **todas** as 75 PDPs.
  O "3x" respeita a parcela mínima; o "12x" não (UIUX-PDP-002).
- Vazio entre o bloco comercial e os detalhes (UIUX-PDP-001).
- No celular, nome e CTA fora da primeira tela (UIUX-PDP-003).
- Botões de tamanho e CTAs renderizam 400/16 px apesar de `font-black` (UIUX-GLOBAL-001).
- Galeria: setas e miniaturas com alvos ≥ 44 px; imagens com proporção preservada; nenhuma imagem
  quebrada. No tablet (768/820) as miniaturas usam a variante de 92–98 px exibida a 128–138 px
  (borradas) — UIUX-IMG-001. Vídeo: nenhum produto público com vídeo foi encontrado nas PDPs
  amostradas — playback continua **não verificado**.
- 404 de produto fora da identidade da loja (UIUX-404-001).

## Cart

Drawer: abre pelo ícone, foco vai para "Fechar carrinho", Tab circula dentro do drawer (Finalizar
compra → Continuar comprando → Fechar), Esc fecha e devolve o foco ao ícone (Chromium e WebKit).
Os pontos antigos de contraste/alvo do drawer (preço `text-success`, quantidade 40 px) **não se
reproduzem**: preço `text-emerald-400`, botões de quantidade 44 px (axe limpo). `/cart` redireciona
para `/finalizar-compra` (fluxo único). Página vazia: "Sua seleção ainda está vazia." + CTA — ok.

## Checkout

Autenticado (lab) com cartão 1x–12x e Pix:
- 12 opções empilhadas (UIUX-CHECKOUT-001) e radios com tamanhos diferentes (UIUX-CHECKOUT-006).
- O total exibido ao escolher parcelas é o do plano ("No cartão: 12x de … · Total no cartão R$ 708,00")
  e o "Acréscimo do parcelamento" entra como linha própria — **transparente**; 1x–3x dizem "sem juros".
- Mínimo R$ 10: mensagem clara e botão desabilitado (`ASAAS_MINIMUM_PAYMENT_MESSAGE`).
- Mínimo por parcela: opções inviáveis simplesmente não aparecem (R$ 30 → só 1x–3x); falta dizer
  por quê ("parcelas a partir de R$ 10,00") — incluído na proposta de UIUX-CHECKOUT-001.
- Composição desktop e ordem do resumo (UIUX-CHECKOUT-005).
- Mensagens: inventário completo e propostas em UIUX-CHECKOUT-004; falha momentânea vista como pausa
  (UIUX-CHECKOUT-002); erro não-JSON vira texto técnico (UIUX-CHECKOUT-003).

**Pix (apresentação).** Página `/pedido/pix/[orderId]` com QR, copia e cola e status não foi
re-capturada neste ciclo (o Pix do Sandbox está bloqueado por `AWAITING_ACTIVATION` e em produção
exigiria criar cobrança real). Registro: **NOT VERIFIED neste ciclo**.

**Cartão/Asaas (apresentação).** Seleção "Cartão de crédito — Pagamento na página segura do Asaas",
nota "Cartão processado na página segura do Asaas" sob o CTA; o retorno cai em
`/minha-conta/pedidos/<id>` com o aviso "Se você acabou de pagar… Atualize esta página em seguida"
(confirmado no pedido real). Redirect ao Asaas não foi executado.

## Account

`/minha-conta`, `/dados`, `/enderecos`, `/pedidos`, `/pedidos/[id]` (lab e produção). Abas com estado
ativo correto (`aria-current`), formulários com labels e mensagens; endereço sem `autocomplete`, sem busca por CEP e com estilo do Admin (UIUX-FORMS-001); no celular a aba
ativa fica cortada (UIUX-ACCOUNT-001). Login/cadastro: labels visíveis, "Mostrar senha" (40×40),
`autocomplete` de e-mail/senha presentes; recuperação de senha **não existe** (pendência antiga do
backlog de frontend — não é UI nova a criar neste ciclo).

## Orders

- Lista: tabela no desktop, blocos sem rótulo no celular, status só texto, sem parcelamento, sem
  miniaturas (UIUX-ORDERS-001). **Miniaturas fazem sentido**: o catálogo tem nomes repetidos e peças
  da mesma marca muito parecidas; com até 3 miniaturas + "+N" a lista continua compacta.
- Detalhe: **UIUX-ORDERS-001 PRESENT** — 0 imagens no pedido real `RARE-20261117-XQQJL7` e nos 5
  pedidos do lab; SKU também ausente. Hierarquia e vazio em UIUX-ORDERS-002.
- Muitos itens: 1, 2, 5, 10 e 20 itens sem quebra; 20 itens = 2.460 px (1440) e 5.607 px (390);
  ordem dos itens não definida (UIUX-ORDERS-003). Recomendação: a partir de ~6 itens, lista compacta
  com miniatura de 48 px e totais agrupados no topo.
- Parcelamento no detalhe: "8x de R$ 10,49 (última R$ 10,53) com acréscimo" + "Acréscimo do
  parcelamento + R$ 10,31" + total — correto e legível.

## Institutional

`/sobre`, `/contato`, `/suporte`, `/politica-de-envio`, `/trocas-e-devolucoes`,
`/privacidade-e-termos`, `/politica-de-cookies`: coluna de leitura limitada (`max-w-3xl`), títulos
grandes, sem overflow de 320 a 1920. Suporte pós-envio básico (UIUX-SUPPORT-001). Tabelas da
política de cookies sem foco por teclado no mobile (UIUX-A11Y-001). Contato: link "Ver meus pedidos"
com 20 px de altura (UIUX-A11Y-003).

**Cookies.** Banner com "Aceitar" / "Recusar não essenciais" (mesmo peso) / "Configurar" — ocupa
~45% da tela no celular (UIUX-COOKIES-002). **O painel "Configurar" ainda expõe nomes técnicos
internos**, inclusive cookies do Admin (UIUX-COOKIES-001). Lógica de consentimento não foi tocada.

## Admin

Separação STORE × ADMIN: tudo acima é STORE; abaixo, ADMIN.

- **Login** (`/admin/login`, produção): axe limpo, sem overflow.
- **SYSTEM_ADMIN (produção, leitura)**: Usuários, Configurações (frete + parcelamento), Prontidão.
  Parcelamento: tabela 1x–12x com exemplo de R$ 600,00 — claro; risco de dois "Salvar" na mesma
  página e nenhum aviso de alteração não salva (UIUX-ADMIN-002). Jargão "via env", acentos ausentes
  (UIUX-ADMIN-001). Prontidão diz "bloqueado para venda aberta" com a loja no ar (UIUX-ADMIN-003).
  Observação: o Chrome do operador está com **zoom de 50%** (devicePixelRatio 0,5) — isso explica a
  evidência de checkout vista "a 50%", mas não muda o achado UIUX-CHECKOUT-001 (medido a 100%).
- **SELLER_ADMIN (lab)**: Visão geral, Pedidos, Pedido (1 e 20 itens), Produtos, Editar/Novo produto,
  Promoções, Nova promoção, Clientes, Analytics, Suporte, Banners, Categorias, Notificações. Sem
  overflow em 390/768/1440. `/admin/settings` → "sem acesso" para SELLER (RBAC correto).
- **Pedidos (pós PR #4 e parcelamento)**: foto, SKU, tamanho, quantidade, preço, parcelamento,
  acréscimo e total presentes no desktop e no celular — **sem regressão**. Copy: "Metodo", "Método:
  card", "Cobrança: -", "Endereco de entrega" (UIUX-ADMIN-001).
- **Produtos**: formulário em duas colunas (dados/mídia à esquerda; preço, categoria, frete, estoque,
  variações/SKU à direita) — longo mas organizado; único "Salvar produto" no fim (4.176 px no celular)
  e nenhum aviso de não salvo (UIUX-ADMIN-004/002). Botões com peso inconsistente (UIUX-GLOBAL-001).
- **Promoções**: criação → edição → salvar funciona; "Falha temporária" reproduzida pela ação
  desatualizada (UIUX-ADMIN-PROMO-001). Histórico mostra "updated/created" em inglês.
- **Admin mobile**: nenhuma tela inviável; páginas muito longas (produtos 11.120 px em 390).

## Accessibility

- Axe: **1 violação** em toda a matriz — `scrollable-region-focusable` (serious, 2 nós) em
  `/politica-de-cookies` no mobile (UIUX-A11Y-001). Nenhuma violação crítica.
- Landmarks: `main`, `nav`, `footer` em todas as rotas da loja; um `h1` por página; nenhum salto de
  nível de heading detectado.
- Teclado: skip link é a primeira parada (Chromium); foco visível (outline 2 px) em 100% das paradas
  medidas; menu, drawer e menu de Acessórios com trap/Esc/retorno de foco corretos. WebKit não leva
  Tab a links por padrão do Safari (comportamento do navegador, não defeito).
- Foco sob header fixo (UIUX-A11Y-002). Alvos < 44 px listados em UIUX-A11Y-003.
- `prefers-reduced-motion`: faixa de marcas e carrosséis param; controle mostra "Movimento reduzido".

## Responsive

Matriz de produção (`output/uiux-audit-01/report.json`, 493 páginas, 0 erros de navegação):

| Verificação | Chromium (11 larguras) | WebKit (375/768/1440) | Firefox (375/768/1440) |
| --- | --- | --- | --- |
| Rolagem horizontal | 0 / 319 | 0 / 87 | 0 / 87 |
| Elemento fora da tela | 0 (só o honeypot do suporte, oculto de propósito) | 0 (idem) | 0 (idem) |
| Texto cortado (`overflow` sem reticências) | 0 | 0 | 0 |
| CTA escondido / modal fora da tela | 0 (menu, drawer e painel de cookies dentro da viewport) | 0 | 0 |
| Imagem quebrada | 0 | 0 | 0 |
| Imagem abaixo da resolução exibida | miniaturas da PDP em 768/820; banner do login em 430 | miniaturas em 768 | miniaturas em 768 |

- Header: 136 px (< 1024) e 158 px (≥ 1024) em todas as rotas da loja; 404 geral sem header e 404 de
  produto com 73 px (UIUX-404-001).
- Mobile (320–430): grade de 2 colunas sem quebra; busca em linha própria; menu ☰ acessível; drawer
  com largura adequada. Problemas: PDP com CTA fora da primeira tela (UIUX-PDP-003), abas da conta
  (UIUX-ACCOUNT-001), parcelamento (UIUX-CHECKOUT-001), banner de cookies alto (UIUX-COOKIES-002).
- Tablet (768/820): ainda sem a barra de categorias do header (aparece em 1024); catálogo em 3
  colunas; miniaturas da PDP borradas (UIUX-IMG-001).
- Desktop (1024–1920): container máximo de 1440 px centralizado; barra de categorias desalinhada do
  conteúdo e com sobra à direita (UIUX-NAV-001); vazio na PDP (UIUX-PDP-001).
- Admin: sem overflow em 16 telas × 390/768/1440 (lab); nenhuma tela inviável (UIUX-ADMIN-004).
- Navegadores: nenhuma diferença de layout relevante entre Chromium, WebKit e Firefox nas larguras
  comparadas. Diferença de teclado do WebKit (Tab não para em links) é padrão do Safari.

## Copy

Inventário e propostas: UIUX-CHECKOUT-004 (erros do checkout), UIUX-CHECKOUT-002 (pausa × falha),
UIUX-PDP-002 (12x), UIUX-ADMIN-001 (Admin), UIUX-COOKIES-001 (painel técnico), UIUX-CATALOG-002
(contagem). Exemplos de textos citados no prompt:

| Texto atual | Onde | Problema | Proposta |
| --- | --- | --- | --- |
| "Falha temporária / Não foi possível carregar esta área." | Admin, qualquer erro | genérico; diz "carregar" quando falhou ao salvar | "Esta tela foi atualizada. Recarregue para continuar." (ação desatualizada) / "Não foi possível concluir esta ação. Confira antes de repetir." |
| "O checkout está temporariamente pausado…" | checkout, em falha genérica | transforma falha em pausa | "Não conseguimos iniciar o pagamento agora. Seu carrinho foi mantido — tente de novo em instantes." |
| "Produto indisponível." / "Estoque insuficiente para finalizar este carrinho." | checkout/frete | não diz qual item | citar produto, tamanho e quantidade restante |
| "Variação inválida." | checkout/frete | técnico | "Esse tamanho não está mais disponível." |
| "Frete indisponível." | checkout | sem saída | + "ou fale com a RARE pelo WhatsApp" |
| "Processando" | — | não encontrado como texto visível; loading usa ícone + rótulo do botão | — |

## Performance Perception

CLS 0 em 311 de 319 medições Chromium; picos de 0,10–0,44 só em páginas curtas de estado vazio
(busca sem resultado, filtro vazio, carrinho vazio) em algumas larguras (UIUX-PERF-001). LCP local
≤ 1,26 s (laboratório, não CWV de campo). Header e hero estáveis; cards abaixo da dobra aparecem como
blocos cinza até carregar. Navegação entre páginas tem barra de progresso. Nenhum congelamento.

**Produtos sem thumbnail (revalidado).** Em `/categoria/tudo`, 22 de 51 imagens principais e 28 de 49
imagens de hover apontam para o **arquivo original** (PNGs de 2,2–2,5 MB, ex.: 1086×1448), servidos
direto do R2, sem variante `rare-v1` e sem otimizador (UIUX-IMG-001). Nenhum backfill executado. O
Firefox registrou uma vez "Image corrupt or truncated" para um desses PNGs; o arquivo baixado decodifica
normalmente — atribuído a carregamento interrompido pela navegação, não a arquivo corrompido.

## Limitações (o que não foi verificado)

- Pix: tela de QR/copia-e-cola/contador não capturada (Sandbox bloqueado; produção exigiria cobrança real).
- Redirect real ao Asaas e retorno de pagamento aprovado: não executados.
- Logs de produção do "Falha temporária": indisponíveis (conta Railway conectada não lista o projeto).
- Telas do SELLER em produção: sem sessão de vendedor; auditadas no lab com o mesmo código (`2adec1a`).
- Vídeo na PDP: nenhum produto público com vídeo encontrado na amostra.
- Suíte fixture `tests/visual-storefront/states.config.ts`: **3/8 PASS**; as 5 falhas são do harness
  ("Preview interrompido — Fixture QA refused an unsupported import"), que não acompanhou os módulos
  novos da PDP/carrinho. Dívida de teste; não é defeito de produção (a mesma PDP renderiza em produção).
- `media:variants:audit` (contagem exata por produto no banco) não executado; a revalidação foi feita
  pelo HTML público do catálogo.
- Axe só no Chromium (390/1440); WebKit e Firefox cobertos por overflow/corte/teclado, não por axe.

## Arquivos deste ciclo

- `docs/uiux/*.md` — relatórios.
- `tests/uiux-audit/*.mjs` — sondas somente leitura reutilizáveis (matriz, teclado, marcas, PDP 12x,
  layout, fontes, galeria).
- `tests/e2e/uiux-audit-lab.spec.ts` — cenários do lab (só mede e captura; não falha por achado de UI).
- `scripts/qa-staging-lab.ts` — gancho opcional `QA_LAB_EXTRA_SPECS` (não muda as fases existentes).
