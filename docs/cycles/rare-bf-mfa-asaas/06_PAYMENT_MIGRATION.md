> **Atualização vigente — 2026-11-13:** ver [RARE-FINAL-RELEASE-01](cycles/CYCLE-FINAL-RELEASE-01.md).
> Asaas é o único provider autorizado para novos pagamentos. Stripe não é fallback;
> rollback fecha checkout (`PAYMENT_PROVIDER=disabled`, `CHECKOUT_ENABLED=false`).
> Backup real de staging criado, baixado e restaurado localmente: 15 migrations aplicadas,
> 3 pendentes, checksums e drift limpos; ensaio local das 3 migrations PASS.
> Staging do PR ainda não publicado; homologação real e contenção interna continuam pendentes.
> Freeze ACTIVE, PR Draft. As seções abaixo preservam evidência histórica dos ciclos anteriores.
# 06 — Migração Stripe → Asaas

## Estado

| Item | Estado |
|---|---|
| Stripe mantido | **SIM** — SDK, webhook, variáveis e código intactos (rollback) |
| Abstração | `PAYMENT_PROVIDER = stripe (padrão) | asaas | disabled`; desconhecido → `disabled` |
| Pedidos existentes | sempre reconciliados pelo provider que os criou (`Order.paymentProvider`: `stripe`, `mercadopago`, `asaas`) |
| Remoção do Stripe | **NÃO** — gates abaixo ainda abertos |

O padrão `stripe` faz o deploy deste código não mudar o meio de pagamento em produção.

## Ordem obrigatória

```
local ✅ → mock ✅ (unit + PostgreSQL real) → Asaas Sandbox ⛔ (sem chave)
→ staging ⛔ (sem acesso Railway) → E2E ⛔ → regressão de segurança em staging ⛔
→ credenciais de produção ⛔ → piloto controlado ⛔
```

Nenhuma cobrança real foi criada.

## Gates para remover o Stripe (prompt §51)

| Gate | Estado |
|---|---|
| Asaas Sandbox PASS | MANUAL (pendente) |
| Webhook PASS (Sandbox) | MANUAL |
| Payment PASS | MANUAL |
| Stock PASS | PASS em PostgreSQL local; MANUAL em staging |
| Refund/cancel strategy definida | PASS (reembolso via Admin, cancelamento por DELETE antes de liberar estoque) |
| Staging E2E PASS | MANUAL |
| Production pilot PASS | MANUAL |

Depois disso: remover SDK `stripe`, `STRIPE_*`, `/api/stripe/webhook`, `StripeEvent` (migration separada, não destrutiva até confirmar retenção), docs e secrets no Railway/Stripe; refazer `npm audit`.

## Observação sobre Mercado Pago

A base (`integration/pre-go-live`) já trazia Pix via Mercado Pago (`PIX_ENABLED`). Com `PAYMENT_PROVIDER=asaas`, Pix passa a ser do Asaas e o Mercado Pago deixa de receber pagamentos novos (pedidos antigos continuam reconciliados). Decidir se o Mercado Pago sai junto com o Stripe é **BUSINESS DECISION**.
