# 10 — Banco de dados

## Migrations deste ciclo (todas aditivas)

| Migration | Conteúdo |
|---|---|
| `20261106120000_admin_mfa_audit` | `User.mfa*` (anuláveis), `AdminMfaRecoveryCode`, `AdminAuditLog` |
| `20261106130000_promotions` | enums, `Promotion`, `PromotionProduct`, `PromotionCategory`; `OrderItem` snapshot (anuláveis / default 0); `Order.promotionDiscountInCents DEFAULT 0` |
| `20261106140000_asaas_payments` | valor `asaas` no enum de provider, `Order.asaasPaymentId` (único), `Order.paymentUrl`, `Order.refundRequestedAt`, `Customer.asaasCustomerId` (único), `AsaasWebhookEvent` |

Sem `DROP`, sem mudança de tipo, sem `NOT NULL` sem default. Compatível com o código anterior (colunas novas ignoradas por ele) → rollback de código não exige rollback de banco.

## Índices

`Promotion(status, startsAt, endsAt)`, `Promotion(homepageFeatured, status)`, `PromotionProduct(productId)`, `PromotionCategory(categoryId)`, `OrderItem(promotionId)`, `AsaasWebhookEvent(status, nextAttemptAt)`, `AsaasWebhookEvent(paymentId)`, `AsaasWebhookEvent(receivedAt)`, `AdminMfaRecoveryCode(userId, usedAt)`, `AdminAuditLog(entityType, entityId, createdAt)`, `AdminAuditLog(createdAt)`; únicos em `Promotion.slug`, `Order.asaasPaymentId`, `Customer.asaasCustomerId`, `AdminMfaRecoveryCode.codeHash`. Volume atual pequeno: query plans em produção **não medidos** (MANUAL quando houver dados).

## Verificação

| Gate | Resultado |
|---|---|
| `prisma migrate deploy` em PostgreSQL 17 local vazio (18 migrations) | PASS |
| `prisma migrate diff` migrations → `schema.prisma` | **No difference detected** |
| Aplicação em staging | **MANUAL** (sem acesso) |
| Produção | `prisma migrate deploy` no preDeploy do Railway; aditivo; fazer backup antes (MANUAL) |
