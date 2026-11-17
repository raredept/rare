# RARE-CARD-INSTALLMENTS-02 — Integração do parcelamento sobre SKU + foto (PR #4) — 2026-11-16/17

Continuação de [CARD_INSTALLMENTS_01.md](CARD_INSTALLMENTS_01.md). A política (1x–3x sem juros; 4x 9% … 12x 18%;
máximo 12x; 13x+ rejeitado; cálculo só no servidor; flag `CARD_INSTALLMENTS_ENABLED` + toggle no Admin) não mudou.

## 1. Base e histórico

- O PR #4 (`feat/order-item-image-sku`, 8964dca) **não está mergeado** em `main` (44db0f3). Decisão do operador:
  integrar sobre o PR #4.
- Branch `cycle/rare-card-installments-02` = `8964dca` + merge `d4c8399` de `cycle/rare-card-installments-01`
  (33449f5). Merge sem rebase/force: o histórico dos dois ciclos continua auditável.
- Conflitos inspecionados um a um (checkout.ts, schema.prisma, OrderItem, página do pedido no Admin e do cliente,
  e-mails, testes). Resolução: os dois snapshots convivem — `OrderItem.skuSnapshot / imageUrlSnapshot /
  catalogSnapshotAt` e o snapshot de parcelamento no `Order` (`paymentInstallment*`, `paymentBaseTotalInCents`,
  `asaasInstallmentId`) e no `EmailOutbox` (`installmentCount`, `installmentValueInCents`).

| Commit | Conteúdo |
|---|---|
| d4c8399 | merge do ciclo 01 sobre o PR #4 |
| 3be76c6 | teste combinado SKU + foto + 12x; Admin mostra SKU e as linhas do parcelamento na mesma tela |
| c1cfb80 | tipagem do teste combinado (o `next build` checa testes) |
| 3b18580 | correções da auditoria independente (2 MEDIUM + 5 LOW) |

## 2. Migrations (banco descartável)

Ordem aplicada: `…support_requests` → `20261116120000_variant_sku_order_item_snapshot` →
`20261116180000_card_installments`.

- Banco populado com pedidos/itens/variantes antigos antes de aplicar as duas migrations.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` = sem diferença
  (**NO DRIFT**).
- Linhas antigas intactas (contagens e valores comparados antes/depois); a única alteração é a intencional do PR #4
  (SKU em maiúsculas, duplicados viram NULL antes do índice único) — **NO DATA LOSS**.
- Nenhuma coluna/índice em comum entre as duas migrations — **NO CONFLICT**.
- Impacto em produção da migration de SKU: zero linhas afetadas (leitura somente-leitura do banco de produção).

## 3. Teste combinado (unitário)

`checkout-asaas-installments.test.ts` — um pedido com SKU + foto + 12x a 18%: o pedido grava o SKU/foto do item e o
snapshot do plano; depois troca-se o SKU da variante, a foto do produto e a taxa de 12x no Admin, e o pedido antigo
continua com os valores originais (SKU, foto, taxa, parcela, última parcela, total).

## 4. Auditoria independente do delta — **GO**

Sem CRITICAL/HIGH. Achados corrigidos em 3b18580:

| ID | Achado | Correção |
|---|---|---|
| MEDIUM-1 | estorno parcial de um plano marcava o pedido como estornado | só aceita `REFUNDED` de plano se o pedido está pago e houve `refundRequestedAt`; senão incidente `plan_partial_refund` |
| MEDIUM-2 | pedido de plano podia ser pago por evento sem conferir tipo/status | exige `planMatches`, `CREDIT_CARD` e `CONFIRMED`/`RECEIVED` |
| LOW-1 | `paymentUrl` gravado antes de conferir o plano | grava depois de `getAsaasInstallment` + `isAsaasPlanForOrder` |
| LOW-2 | expiração não apagava o plano se a parcela 1 já tinha sumido | confere se o plano segue aberto e apaga via `DELETE /installments/{id}` |
| LOW-3 | liberação "sem pagamento" ignorava pedidos de plano | retorna false quando há `asaasInstallmentId` |
| LOW-4 | `processing` não conferia o plano | exige `planMatches` |
| LOW-5 | e-mail não mostrava a última parcela diferente | "Nx de R$ X (última R$ Y)" |

Performance: as páginas de pedido (Admin e cliente) leem pedido + itens (+ variante/fotos atuais, só como fallback de
pedidos anteriores ao snapshot) em um único `findUnique`/`findFirst` com `include`; o Prisma resolve as relações em
um número fixo de consultas, nunca uma por item (sem N+1). O parcelamento não adiciona consulta: são colunas do `Order`.

## 5. Regressão

`tsc` 0 erros · `eslint` 0 · `vitest` 2209 passaram (3 skipped) · `next build` OK.

## 6. Staging no candidato

`STAGING_SOURCE_BRANCH=cycle/rare-card-installments-02` · `STAGING_SHA=3b18580` (deploy via GitHub nos dois
serviços, `rare-staging` e `rare-checkout-worker-staging`; health 200). Produção intocada: `rare` e `rare-cron` em
44db0f3, `CARD_INSTALLMENTS_ENABLED` ausente (= desligado).

Compras humanas no Sandbox (cartão de teste oficial do Asaas; nenhum dado de cartão registrado):

| Pedido | Plano | Total | Asaas | Observação |
|---|---|---|---|---|
| RARE-…-TXQVIH | 1x (cobrança única) | R$ 358,00 | CONFIRMED | `value`, sem `installmentCount` |
| RARE-…-ZKL01G | 2x | R$ 229,00 | pago | sem acréscimo |
| RARE-…-7F3OEL | 3x | R$ 358,00 | plano de 3 CONFIRMED | 119,33 × 2 + 119,34 |
| RARE-…-2NB095 | 12x a 18% | R$ 1.856,00 + R$ 334,08 = R$ 2.190,08 | plano de 12 CONFIRMED | 182,50 × 11 + 182,58; soma exata |

- Webhooks: 18 `PAYMENT_CREATED` + 18 `PAYMENT_CONFIRMED`, todos processados; pedido pago uma única vez.
- Estoque baixado uma vez por pedido; SKU/foto gravados em todos os itens.
- E-mails "Pagamento aprovado" entregues (Resend) com a linha de parcelamento.
- **Pix no staging: não provado neste ciclo.** O Asaas Sandbox recusa qualquer cobrança Pix
  ("Não há nenhuma chave Pix disponível para receber cobranças"): a chave EVP da conta Sandbox está
  `AWAITING_ACTIVATION`. É configuração da conta Sandbox, não código; o caminho Pix não foi alterado neste ciclo
  (só o ramo de cartão recebe `installmentCount`) e segue coberto pelos testes unitários e pela compra Pix real
  de produção (RARE-20261116-SPVPKE).

## 7. Mobile e Admin (lab local, build de produção)

`tests/e2e/card-installments.spec.ts` no lab (`scripts/qa-staging-lab.ts --only=card-installments`, banco local
descartável, chave Asaas falsa). Evidências em `output/card-installments-02/` (fora do git):

**12/12 passaram** (4 do parcelamento + 8 do SKU, mesma rodada; sem vazamento de segredo nos logs; integridade de dados 0 anomalias).

| Print | O que prova |
|---|---|
| `pdp-mobile-375.png` | PDP no celular: "ou em até 3x sem juros · ou até 12x no cartão", sem valor com acréscimo; sem overflow horizontal |
| `checkout-12x-mobile-375.png` | checkout no celular: 12 opções (1x–3x sem juros; 4x–12x com "Total no cartão"); nenhuma 13x; 12x de R$ 600,00 = R$ 708,00 e a linha "Acréscimo do parcelamento" |
| `customer-order-12x-mobile-375.png` | pedido do cliente no celular: "12x de R$ 55,06 (última R$ 55,14) com acréscimo", acréscimo e total R$ 660,80 |
| `admin-order-12x-desktop.png`, `admin-order-12x-mobile-375.png` | Admin com conta **SELLER_ADMIN**: foto, nome, tamanho, qtd, preço e SKU do snapshot + cupom, frete, acréscimo (18%), plano e total na mesma tela; desktop e 375 px sem overflow |

Pedido da fixture: R$ 600,00 − RARE10 R$ 60,00 + frete R$ 20,00 = R$ 560,00; 12x a 18% = + R$ 100,80 → R$ 660,80
(11 × R$ 55,06 + R$ 55,14). O lab exige build com `APP_ENV=staging` (com build comum o otimizador de imagem
responde 401 atrás do Basic gate e a foto vira "Sem imagem"). Cada spec usa a própria conta seller (G = SKU,
H = parcelamento), porque o cadastro de MFA de uma conta não se repete na mesma rodada.

## 8. Pendências / bloqueadores

- PR #4 ainda não mergeado em `main`: este ciclo deve entrar **depois** dele (ou junto, revisado como um só).
- Pix no staging: **gate dispensado pelo operador em 17/11/2026** ("Libere o staging sem API mesmo, vamos testar na
  produção e se não tiver funcionando lá, a gente tira por enquanto"). Motivo: a chave EVP da conta Sandbox ficou
  `AWAITING_ACTIVATION`; o Asaas recusa criar outra ("Já existe uma chave aguardando ativação") e o painel trava ao
  excluir. A prova do Pix passa a ser feita em produção; rollback = desligar o parcelamento (flag/toggle).
- Fora do escopo: erro "Falha temporária" relatado pelo vendedor ao editar promoção no Admin (não investigado).
- Produção: nada publicado; `CARD_INSTALLMENTS_ENABLED` continua desligado.
