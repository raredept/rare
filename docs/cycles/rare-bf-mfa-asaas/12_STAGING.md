# 12 — Staging

## Estado: NÃO PUBLICADO (BLOCKED → MANUAL)

O Railway MCP desta sessão está autenticado num workspace sem o projeto RARE (lista só projetos DuraPets/DuraOps, verificado em 2026-11-06) e o Railway CLI local responde `Unauthorized`. Nenhum deploy, variável ou migration foi aplicado em staging.

## O que substituiu staging neste ciclo (evidência local)

- PostgreSQL 17 real e isolado (embedded, porta local), banco descartável por execução.
- `npm run qa:bf-asaas` e `npm run qa:checkout-concurrency` com o transporte real do Asaas/Stripe contra doubles em processo (nenhuma rede).
- `next build` de produção + checagem de server actions/standalone.

## Roteiro para quando houver acesso (ordem)

1. Variáveis no serviço web **e** no worker de staging: `ADMIN_MFA_ENCRYPTION_KEY` (nova, só staging), `PAYMENT_PROVIDER=asaas`, `ASAAS_ENV=sandbox`, `ASAAS_API_KEY=$aact_hmlg_…`, `ASAAS_WEBHOOK_TOKEN` (32–255, aleatório, ≠ chave), `ASAAS_PAYMENT_METHODS=pix,card`. Não imprimir valores.
2. Deploy da branch; preDeploy aplica as 3 migrations aditivas. Conferir `/api/health` e `/admin/readiness`.
3. MFA: login → cadastro → confirmar código → guardar códigos → logout → login com TOTP → login com código de recuperação → tentar reutilizar o mesmo código (deve falhar).
4. Webhook no painel Sandbox do Asaas: URL `https://<staging>/api/asaas/webhook`, token do passo 1, eventos `PAYMENT_CREATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_REFUND_IN_PROGRESS, PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_CHARGEBACK_DISPUTE, PAYMENT_AWAITING_CHARGEBACK_REVERSAL, PAYMENT_AWAITING_RISK_ANALYSIS, PAYMENT_APPROVED_BY_RISK_ANALYSIS, PAYMENT_REPROVED_BY_RISK_ANALYSIS`. Disparar evento de teste (deve ficar `ignored`, sem 5xx).
5. `npm run promotions:seed-black-friday`; no Admin: definir % real de teste, 1 produto, período curto (início em 2 min, fim em 10 min), preview desktop/mobile, ativar. Confirmar que aparece sozinho no início e some no fim, sem deploy.
6. Compra Pix Sandbox com a promoção (conferir valor no Asaas = total do pedido); pagar pelo simulador do Sandbox; pedido vira pago; e-mail; Admin mostra promoção/desconto/provider.
7. Compra cartão Sandbox (cartão de teste do Asaas na fatura hospedada).
8. Deixar uma cobrança expirar: worker apaga no Asaas e libera estoque.
9. Reembolso pelo Admin; webhook REFUNDED; pedido `refunded`; estoque não volta sozinho.
10. Regressão adversarial §28 (ver 07_SECURITY) contra o domínio de staging, incluindo headers Origin/Host/X-Forwarded/CF.
11. Mobile 320–1920 px da home com campanha e do Admin de promoções.

Registrar cada passo como PASS/FAIL com data em `docs/cycles/rare-bf-mfa-asaas/12_STAGING.md`.
