# RARE-UIUX-REFINE-01 — Implementação dos 9 itens P1 aprovados

```text
BASE_SHA=41fb8dd (audit/rare-uiux-01, sobre main@2adec1a)
BRANCH=refine/rare-uiux-01 (local, sem push)
APPROVED=todos os P1 (operador, 2026-11-17)
PRODUCTION_CHANGED=NO · PRODUCTION_DEPLOYED=NO · MIGRATIONS=0
FINANCIAL_LOGIC_CHANGED=NO (cálculo, taxas, installmentCount, snapshot, total, Asaas, webhook,
  estoque, reservas, cupons, frete, RBAC, SEO: nenhum arquivo tocado)
```

## Resultado por item

| ID | Status | O que mudou | Prova |
| --- | --- | --- | --- |
| UIUX-NAV-001 | DONE | Barra do header centralizada no grid (≥ 1024 px); "Acessórios ▾" com o mesmo peso/tamanho dos links; atalhos do catálogo só abaixo de 1024 px (onde o header não tem barra) | `uiux-refine-lab.spec.ts` (sobras esquerda/direita e fonte medidas); `category/[slug]/page.test.ts` |
| UIUX-CATALOG-001 | DONE (fase 1) | Toolbar "N produtos · Filtrar · Ordenar"; painel lateral (≥ 640 px) / bottom sheet (celular) com Marca, Tamanho disponível, Preço, Disponível agora, Em promoção; ordenação Destaques / Mais recentes / Menor preço / Maior preço; chips removíveis; estado na URL; total real; busca com atalho "Filtrar e ordenar" | `catalog-refinements.test.ts`, `storefront-catalog.test.ts`, `page.test.ts`, lab |
| UIUX-ORDERS-001 | DONE | Lista em cards com até 3 miniaturas (+N), status com ícone + texto, data, "N itens", "Cartão · 8x"/"Pix", total e "Ver pedido"; detalhe com foto, tamanho, quantidade, preço e "Ref." (SKU gravado no pedido) | `customer-order-parts.test.ts`, lab (pedidos de 1/2/5/10/20 itens) |
| UIUX-CHECKOUT-001 | DONE | Seletor compacto: uma linha com o plano escolhido (e o total no cartão quando há acréscimo) + "Alterar"; abre os mesmos radios em caixa com rolagem própria, agrupados "Sem juros" / "Com acréscimo" | `card-installments.spec.ts` 4/4 no lab, `card-installments-ui.test.ts`, lab (altura medida) |
| UIUX-PDP-001 | DONE | "Detalhes do produto" saiu da linha própria do grid e foi para a coluna direita, logo abaixo do bloco de compra (antes de frete e confiança); coluna deixou de ser `sticky` (nunca engatava) | lab 1024/1440 (posição medida), `product-detail-client.test.ts` |
| UIUX-ADMIN-PROMO-001 | DONE (UI) | Boundary do Admin reconhece ação desatualizada: "Esta tela foi atualizada enquanto estava aberta" + "Recarregar página" (sem reenvio); erro genérico diz "Não foi possível concluir esta ação" e mostra o código (digest). Lógica de promoções intacta | lab (promoção salva + tela da ação desatualizada) |
| UIUX-PDP-002 | DONE | "ou até Nx no cartão" com o N real que o preço da peça permite sozinho (mesmo cálculo do checkout); sem "no cartão" quando só cabe sem juros | `card-installments-ui.test.ts`; `tests/uiux-audit/pdp-installments-after.ts` nos 75 preços reais: 0 promessas impossíveis, só os 7 produtos do achado mudam |
| UIUX-HOME-001 | DONE (sem migration) | Banner com imagem e **sem título** = "arte manda": o site não desenha scrim, eyebrow nem subtítulo por cima (ficam para leitor de tela); indicadores saíram de cima da arte para uma faixa abaixo dela; orientação no formulário de banners do Admin | `home-hero-carousel.test.ts`, lab 390/1440 |
| UIUX-CHECKOUT-002 | DONE | Só a pausa real vira "checkout pausado"; a falha genérica vira "Não conseguimos iniciar o pagamento agora. Seu carrinho foi mantido — tente de novo em alguns instantes." | `checkout-messages.test.ts` (inclusive conferindo o texto exato da rota) |

## Decisões tomadas (sem inventar regra)

- **Preço do filtro e da ordenação = preço final da peça agora** (`pricing.finalPriceInCents`, promoção
  automática já aplicada pelo motor de promoções, que só é lido). Cupom e frete não entram. Está escrito no
  próprio painel.
- **Esgotados continuam depois dos disponíveis** em qualquer ordenação (regra que já existia).
- **"Maior desconto" não foi incluído**: o desconto por peça existe, mas ordenar por ele não foi pedido
  na fase 1; fica para quando o operador quiser.
- **Filtros de seleção única** por grupo (fase 1). Opções e contagens vêm só do escopo atual (categoria /
  busca); cada número já considera os outros filtros ativos.
- **Leitura do catálogo:** a página agora lê o escopo inteiro uma vez (dezenas de produtos) para ter
  opções, total e ordenação do mesmo conjunto; a paginação (24) acontece depois, na aplicação. Com
  milhares de produtos isso precisaria voltar para o banco.
- **Catálogo filtrado ou ordenado** em "Tudo"/"Acessórios" vira uma lista única paginada (seções
  esconderiam a ordem escolhida). Sem filtro, as seções continuam iguais.
- **SEO intocado:** metadata e canonical continuam lendo a página sem filtro (canonical sem parâmetros).
  Indexação de URLs filtradas fica para o ciclo de SEO.
- **HOME-001 sem migration:** a regra usa o campo que já existe (título vazio). Foto do celular cortando o
  "COMPRAR AGORA" desenhado na arte é conteúdo (recorte mobile do banner), não código.
- **SKU para o cliente:** só o gravado no pedido ("Ref."). O SKU atual do catálogo não aparece para pedidos
  antigos — para o cliente seria um palpite.
- **Fonte dos botões novos:** a regra global `font: inherit` (UIUX-GLOBAL-001, P2, não aprovado) continua; os
  componentes novos põem tamanho/peso no contêiner para não depender dela.

## Regressão

```text
typecheck=PASS  lint=PASS  vitest=200 arquivos / 2233 testes PASS (3 skipped, como antes)
lab (build de produção com APP_ENV=staging, banco descartável, Asaas falso, e-mail desligado):
  card-installments.spec.ts 4/4 PASS  ·  order-item-sku.spec.ts 8/8 PASS
  uiux-refine-lab.spec.ts 3/3 PASS
  uiux-audit-lab.spec.ts 6/6 PASS na rodada com o código final do Admin e do checkout;
    na última rodada (após o ajuste de largura dos pedidos) 4 PASS, 1 timeout no helper de medição
    das telas do Admin (mesmo travamento intermitente em redirect visto na auditoria), 1 não executado
```

O spec `card-installments.spec.ts` mudou só a interação (abrir o seletor antes de ler as opções); todas as
asserções de valores são as mesmas.

## Evidências AFTER (antes → depois)

Prints em `output/uiux-refine-01/` (99 capturas; fora do Git, como no ciclo da auditoria). Métricas em
`output/uiux-refine-01/lab/metrics.json` e `refine-metrics.json`.

| Item | Antes | Depois |
| --- | --- | --- |
| CHECKOUT-001 | lista de parcelas com 852 px (390 e 1440); página do cartão 4.530 px (390) / 2.686 px (1440) | seletor fechado com 48 px, aberto 352 px com rolagem própria; página 3.754 px (390) / 1.910 px (1440); "Finalizar compra" em 1.154 px no desktop; escolher 8x fecha a lista e mostra "8x de R$ 85,50 com acréscimo · Total no cartão R$ 684,00" |
| ORDERS-001 | 0 imagens na lista e no detalhe | lista com miniaturas (15 imagens para 5 pedidos de teste) e status com ícone; detalhe com 1/2/5/10/20 fotos; pedido de 20 itens no celular 5.607 → 4.879 px |
| PDP-001 | "Detalhes do produto" começava em 1.502 px (1440) | começa em 850 px (1440) e 852 px (1024), na coluna da direita |
| PDP-002 | item de R$ 30 anunciava "até 12x" com checkout 1x–3x | "ou em até 3x sem juros"; nos 75 preços reais, 0 promessas impossíveis |
| ADMIN-PROMO-001 | "Falha temporária / Não foi possível carregar esta área." | "Tela desatualizada / Esta tela foi atualizada enquanto estava aberta." + "Recarregar página"; edição normal continua salvando |
| HOME-001 | eyebrow e subtítulo do site sobre a arte; indicadores sobre o falso botão | nenhum texto visível sobre a arte; indicadores começam exatamente onde a arte termina (390 e 1440) |
| NAV-001 | barra com 537 px vazios à direita (1440); "Acessórios" 400/16px | 331 px de cada lado; "Acessórios" 700/14px como os links; atalhos do catálogo só abaixo de 1024 px |
| CATALOG-001 | sem filtro/ordenação; "24 produtos nesta página" | "10 produtos" (total real); filtro BAPE → 3; "Menor preço" ordena R$ 42,21 → 72,00 → 180,00; painel lateral no desktop e bottom sheet de 717 px no celular, Esc fecha, sem rolagem horizontal |

## Não feito / limites

- Nada foi enviado para produção; nenhum push; nenhum merge.
- WebKit/Firefox não rodaram neste ciclo (lab em Chromium, como os specs financeiros).
- O erro real de backend da promoção continua sem prova (sem logs de produção nesta máquina).
- Polimento não feito: na lista de pedidos, o texto começa em posições diferentes conforme o número de
  miniaturas (1, 2 ou 3+). Funcional, mas pode ganhar uma coluna de largura fixa.
- Encontrado e corrigido durante a prova: a primeira versão da lista de pedidos estourava a largura no
  desktop (linha de nomes sem quebra dentro de um grid); trocada por lista em bloco e reconferida.
