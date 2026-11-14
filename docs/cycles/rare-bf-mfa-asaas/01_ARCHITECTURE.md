# 01 — Arquitetura

Branch `cycle/rare-bf-mfa-asaas-01`, base `integration/pre-go-live@f15e5b6` (motivo em `00_CURRENT_STATE.md`).

## Visão geral

```
Browser (intenção: itens, endereço, método)        Admin (MFA obrigatório)
        │                                                   │
        ▼                                                   ▼
 storefront.ts ──► promotions/store.ts ──► promotions/engine.ts (puro, sem I/O)
        │                                   ▲
        ▼                                   │ mesmas regras, lidas DENTRO da transação
 checkout.ts (preço, cupom, frete, reserva) ┘
        │
        ▼  PAYMENT_PROVIDER (stripe | asaas | disabled)
 ┌──────────────┬──────────────────────┐
 Stripe Checkout  Mercado Pago Pix       Asaas (Pix na loja / cartão na fatura hospedada)
        │                                   │
 /api/stripe/webhook  /api/mercadopago/webhook  /api/asaas/webhook → AsaasWebhookEvent (inbox)
                                                │
                       checkout-expiry-worker ◄─┘ (drena inbox + expira reservas + outbox e-mail)
```

## Decisões

| Tema | Decisão |
|---|---|
| Fonte de preço | `priceProduct()` puro, chamado por catálogo, PDP, carrinho (`/api/cart/pricing`), cotação de frete e checkout. O checkout relê as regras na própria transação. Nada de preço vem do browser. |
| Stacking | Uma promoção automática por item: `priority DESC → maior desconto → createdAt ASC → id`. Cupom `RARE10` só incide sobre itens **sem** promoção. |
| Agenda | Persistência em UTC; entrada/exibição comercial em `America/Sao_Paulo` (`business-time.ts`). Status efetivo derivado de `status + startsAt/endsAt` no instante da requisição — começa/termina sem deploy. |
| Provider | `PAYMENT_PROVIDER` decide só **novos** pagamentos; pedidos antigos são reconciliados pelo `Order.paymentProvider` que os criou. Valor desconhecido → `disabled` (fail closed). Padrão `stripe` = deploy sem efeito. |
| Estados | Estados do Asaas nunca viram estado de pedido: `classifyAsaasPayment()` mapeia para `paid/pending/processing/closed/refunded/refund_pending/chargeback/unknown`. |
| Webhook | Autentica → persiste com `id` único → 200 → processa em `after()` e no worker. O processamento **relê o pagamento na API** (corpo do webhook nunca é confiável). |
| MFA | Senha correta gera só credencial *pendente* (10 min, sem `role`). Sessão Admin só após TOTP/código de recuperação, com `mfa=true, mfaAt`. Gate único em `getCurrentAdmin()` + checagem grossa no `proxy.ts`. |
| Segredos | TOTP cifrado AES-256-GCM com `ADMIN_MFA_ENCRYPTION_KEY` (HKDF por finalidade, AAD = userId). Recovery codes = HMAC. Chave proibida de ser igual ao segredo de sessão. |

## Módulos novos

`src/lib/totp.ts`, `admin-mfa*.ts`, `admin-audit.ts`, `business-time.ts`, `promotions/{engine,store,validation,admin}.ts`, `asaas*.ts`, `asaas-webhook.ts`, `payment-provider-config.ts`, `feature-flags.ts`; rotas `/admin/mfa`, `/admin/mfa/setup`, `/admin/security`, `/admin/promotions/*`, `/api/asaas/webhook`, `/api/cart/pricing`; componentes `home-campaign`, `campaign-countdown`, `price-tag`, `promotion-form`.

## Risco de integração conhecido

A linha `codex/backend-evolution-20261007` (redesign editorial não mergeado) altera a mesma home e o product card. A campanha e o preço ficaram em componentes isolados (`home-campaign`, `price-tag`) para facilitar o rebase, mas haverá conflito a resolver quando as duas linhas se juntarem.
