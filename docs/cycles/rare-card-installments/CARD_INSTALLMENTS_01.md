# RARE-CARD-INSTALLMENTS-01 — Parcelamento no cartão (Asaas) — 2026-11-16

Branch `cycle/rare-card-installments-01` (a partir de `main` `44db0f3`). Produção NÃO foi tocada:
nenhum deploy, nenhuma variável, nenhuma migration aplicada, nenhuma compra. Sem chaves, tokens,
CPF, e-mail completo ou dado de cartão neste documento.

## 1. Política implementada

Política aprovada pelo proprietário em 16/11/2026 (V2): cartão em até **12x**.

| Parcelas | Acréscimo total |
|---|---|
| 1x, 2x, 3x | 0% — sempre sem juros, fixo no código, sem campo no Admin |
| 4x | 9% |
| 5x | 10% |
| 6x | 11% |
| 7x | 13% |
| 8x | 14% |
| 9x | 15% |
| 10x | 16% |
| 11x | 17% |
| 12x | 18% |
| 13x ou mais | nunca oferecido (rejeitado no schema, no domínio e no transporte da loja) |

A tabela 4x–12x é uma coluna JSON (`StoreSettings.cardInstallmentSurchargesBps`) cujo default na
migration é exatamente a tabela aprovada; o Admin pode alterá-la depois (auditado). O teste
`card-installments.test.ts` fixa os valores: mudar uma taxa sem atualizar o teste quebra a suíte.

Ordem do cálculo: produtos → promoções → cupom → frete → **base** → acréscimo → total final.
Frete grátis e cupom são decididos antes do acréscimo (os juros nunca destravam frete grátis).
Tudo em centavos inteiros e pontos-base; arredondamento meio-para-cima. A parcela segue a divisão
do Asaas (as primeiras parcelas iguais, o centavo restante na última).

Ativação dupla: `CARD_INSTALLMENTS_ENABLED=true` (deploy) **e** "Parcelamento ativado" no Admin.
`CARD_INSTALLMENTS_ENABLED=false` (padrão) devolve na hora o cartão só à vista; Pix e cartão 1x
não dependem dessa flag.

## 2. Taxas reais da conta Asaas Production (leitura `GET /myAccount/fees`, só números)

| Item | Valor |
|---|---|
| Cartão 1x | 2,99% (promocional **1,99%** até 06/02/2027) + R$ 0,49 |
| Cartão 2x–6x | 3,49% (promocional **2,49%** até 06/02/2027) + R$ 0,49 |
| Cartão 7x–12x | 3,99% (promocional **2,99%** até 06/02/2027) + R$ 0,49 |
| Recebimento cartão | 32 dias por parcela (cada parcela no seu mês) |
| Antecipação de parcelado | 1,70% ao mês por parcela antecipada (painel informa também 1,2501% em "cardSale") |

O Asaas **não** oferece, no fluxo de cobrança por API (`POST /v3/payments` + fatura hospedada),
campo oficial para repassar juros de parcelamento ao pagador (os campos `interest`/`fine` são de
**atraso** e não foram usados). O Checkout Asaas (`/v3/checkouts`) também não tem acréscimo por
parcela. Por isso: **estratégia B — cálculo RARE no servidor**; o Asaas recebe o total financiado
em `totalValue` com `installmentCount`.

### Histórico (V1): estimativa de custo de 4x a 6x (base R$ 600,00)

Decisão tomada depois desta análise: tabela 1x–12x da seção 1 (aprovada pelo proprietário).

Custo da RARE = taxa do cartão (+ antecipação, se a loja antecipar). Média de meses antecipados =
(n+1)/2.

| | 4x | 5x | 6x |
|---|---|---|---|
| Taxa observada (promo 2,49% + R$ 0,49) | R$ 15,43 | R$ 15,43 | R$ 15,43 |
| Valor líquido sem antecipar | R$ 584,57 | R$ 584,57 | R$ 584,57 |
| + antecipação 1,70% a.m. (2,5 / 3 / 3,5 meses) | + R$ 25,50 | + R$ 30,60 | + R$ 35,70 |
| Valor líquido antecipando | R$ 559,07 | R$ 553,97 | R$ 548,87 |
| Taxa sem promoção (3,49%) — após 06/02/2027 | R$ 21,43 | R$ 21,43 | R$ 21,43 |
| **Acréscimo sugerido** (cobre antecipação + taxa cheia) | **6%** | **7%** | **8%** |

Na V1 a sugestão não foi gravada; na V2 a tabela aprovada é o estado inicial (migration).

## 3. Mínimos

- Cobrança Asaas abaixo de **R$ 10,00** é recusada pela conta de produção (observado em 16/11).
  A loja agora recusa antes de criar pedido, reserva ou cobrança, com a mensagem "O valor mínimo
  para pagamento é de R$ 10,00. Adicione mais itens ao carrinho para continuar." (Pix e cartão).
  O carrinho mostra o aviso e desabilita "Finalizar compra".
- Sandbox: "O valor mínimo para cobranças via Cartão de Crédito é R$ 5,00" **por parcela**
  (provado com 2x de R$ 4,50). Política da loja: parcela mínima padrão **R$ 10,00**, nunca menor
  que R$ 5,00. Só aparecem as parcelas válidas para o total.

## 4. Arquitetura preservada

- Cartão continua na fatura hospedada do Asaas (`invoiceUrl`); a loja não recebe número nem CVV.
  Provado no Sandbox: a fatura de um plano 4x mostra "Valor total R$ 233,20, parcelado em 4x de
  R$ 58,30", o resumo das 4 parcelas e um único formulário de cartão.
- O navegador envia só `installmentCount` (1–6). Taxa, acréscimo e totais enviados são descartados
  pelo schema; o servidor recalcula tudo a partir do pedido.
- Asaas: 1x envia só `value` (payload idêntico ao atual); 2x+ envia `installmentCount` + `totalValue`
  (sem `value`, sem `installmentValue`). `externalReference = order.id` (copiado pelo Asaas para
  todas as parcelas — provado).
- Cada parcela é uma cobrança Asaas sob um plano (`installment`). A resposta da criação é a 1ª
  parcela (valor = uma parcela). Por isso a loja confere o **plano** (`GET /installments/{id}`):
  total = `Order.totalInCents` (financiado), quantidade, cliente e CREDIT_CARD. Valor de uma
  parcela nunca é comparado com o total.
- Webhook: continua relendo o pagamento pela API; para parcela, relê também o plano. Pago só se o
  plano bater; duplicatas e eventos das outras parcelas são idempotentes (`already_paid`, uma baixa
  de estoque). Plano de outro pedido/cliente, sem acréscimo ou com outra quantidade → incidente,
  pedido não muda.
- Expiração: plano pendente é removido inteiro (`DELETE /installments/{id}`) antes de liberar o
  estoque; a remoção de uma parcela isolada não libera a reserva (incidente). Recuperação de
  resposta perdida aceita as N parcelas de um mesmo plano; planos diferentes na mesma referência
  ficam retidos para revisão.
- Estorno pelo Admin: plano estornado inteiro (`POST /installments/{id}/refund`, sem `value` =
  total). Estorno parcial não é oferecido pela loja (inalterado). Pagamento continua "estornado" só
  quando o Asaas confirma.

## 5. Snapshot do pedido

`Order.paymentInstallmentCount`, `paymentInstallmentRateBps`, `paymentInstallmentFeeInCents`,
`paymentBaseTotalInCents`, `paymentInstallmentValueInCents`, `paymentLastInstallmentValueInCents`,
`asaasInstallmentId`; `totalInCents` = total final. Admin, área do cliente e e-mail leem só esse
snapshot — mudar as taxas depois não altera pedidos antigos. Pix: tudo nulo/0.

## 6. Migration

`20261116180000_card_installments` — só colunas novas (nulas ou com default) e um índice único
parcial-por-natureza (`asaasInstallmentId`, NULL permitido). Nenhum dado existente muda; todos os
pedidos atuais continuam com o mesmo total. Instalação desligada por padrão.

## 7. Evidência Sandbox (scripts/qa-card-installments-sandbox.ts)

Base R$ 220,00; regras 6% / 7,5% / 9% (apenas para a prova).

| | 1x | 3x | 4x | 6x |
|---|---|---|---|---|
| billingType | CREDIT_CARD | CREDIT_CARD | CREDIT_CARD | CREDIT_CARD |
| installmentCount (plano) | 1 (sem plano) | 3 | 4 | 6 |
| totalValue | R$ 220,00 | R$ 220,00 | R$ 233,20 | R$ 239,80 |
| cobranças sob a referência | 1 | 3 | 4 | 6 |
| soma das parcelas = total | sim | sim | sim | sim |
| externalReference em todas | sim | sim | sim | sim |
| regra de valor da loja | MATCH | MATCH | MATCH | MATCH |
| plano sem acréscimo recusado | n/a | n/a | sim | sim |
| status | PENDING | PENDING | PENDING | PENDING |

**Não provado no Sandbox:** o pagamento com cartão de teste na fatura e o webhook resultante
processado por este código (o Sandbox entrega webhooks ao staging, que roda `main`). Pendente de
operador: pagar as faturas de 4x/6x com cartão de teste e rodar o código desta branch em staging.

## 8. Rollback

`CARD_INSTALLMENTS_ENABLED=false` (ou desmarcar no Admin): novos pedidos só à vista; Pix e cartão
1x seguem funcionando. Pedidos já criados parcelados continuam válidos e são liquidados pelo
webhook normalmente. Não desligar o checkout inteiro por causa do parcelamento.

## 9. Riscos

- Taxas 4x–6x são decisão comercial pendente (acima).
- Parcela mínima de produção do Asaas para cartão não foi medida (só Sandbox R$ 5,00); padrão da
  loja R$ 10,00 cobre o mínimo de R$ 10,00 observado em produção.
- Asaas pode recusar o CREDIT_CARD do pagador em 4x–6x conforme a bandeira (limite 12/21x) — não
  afeta, pois o teto da loja é 6x.
- Estorno parcial de uma parcela feito direto no painel do Asaas marcaria o pedido como estornado
  (comportamento já existente para cobranças avulsas) — o Admin recebe incidente.
