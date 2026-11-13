> **Atualização vigente — 2026-11-13:** ver [RARE-FINAL-RELEASE-01](cycles/CYCLE-FINAL-RELEASE-01.md).
> Asaas é o único provider autorizado para novos pagamentos. Stripe não é fallback;
> rollback fecha checkout (`PAYMENT_PROVIDER=disabled`, `CHECKOUT_ENABLED=false`).
> Backup real de staging criado, baixado e restaurado localmente: 15 migrations aplicadas,
> 3 pendentes, checksums e drift limpos; ensaio local das 3 migrations PASS.
> Staging do PR ainda não publicado; homologação real e contenção interna continuam pendentes.
> Freeze ACTIVE, PR Draft. As seções abaixo preservam evidência histórica dos ciclos anteriores.
# 12 — Staging

## Estado: NÃO PUBLICADO (BLOCKED_EXTERNAL → M-01, M-16, M-17)

Reconfirmado no CYCLE-04 (2026-11-07): o Railway CLI desta máquina responde `Unauthorized` para o projeto `Rare` vinculado a `E:\rare`, o conector da sessão só vê o workspace da DuraPets e nenhum dos 4 Chromes conectados abre o projeto. Nenhum deploy, variável ou migration foi aplicado em staging. O staging público responde (`/api/health` 200 `ok_with_warnings`, banco ok), mas não expõe SHA: a versão que roda lá é desconhecida.

## O que substituiu staging (evidência local, não é staging PASS)

- PostgreSQL 17 real e isolado (embedded, porta local), banco descartável por execução.
- `npm run qa:bf-asaas` (8 provas) e `npm run qa:checkout-concurrency` (12 provas) com o transporte real do Asaas/Stripe contra doubles em processo (nenhuma rede).
- `npm run qa:staging-lab`: build de produção com `APP_ENV=staging`, gate Basic, MFA obrigatório e `PAYMENT_PROVIDER=asaas` (chave falsa de formato Sandbox), Playwright em Chromium e WebKit em três fases (asaas, provedor desconhecido, stripe). Resultados em `cycles/CYCLE-04-STAGING.md`.

```bash
# PostgreSQL local de QA + build de produção antes
npm run build
QA_LAB_DATABASE_URL=postgresql://<user>:<pass>@localhost:<port>/postgres npm run qa:staging-lab -- --project=chromium-desktop
QA_LAB_DATABASE_URL=... npm run qa:staging-lab -- --project=webkit --https
```

Os specs `tests/e2e/bf-mfa-*.spec.ts` fazem asserções no banco (`QA_DATABASE_URL`); contra o staging real, sem acesso ao banco, essas checagens precisam ser trocadas por conferência no Admin.

## Gates antes de qualquer deploy deste PR no staging (CYCLE-06/07)

1. **M-20 fechado** (rotação + revogação + prova nos dois ambientes; ver [SECURITY_FREEZE_CLOSURE.md](SECURITY_FREEZE_CLOSURE.md)). O freeze não bloqueia o staging em código, mas configurar o staging com segredos comprometidos ainda ativos não é homologação válida.
2. **M-21:** backup do Postgres-MlyZ criado; `npm run db:history-audit -- --expect=staging` limpo (esperado 14 APPLIED + 4 PENDING); `migrate status`; checagem de drift (closure §6). O histórico de 14 migrations verificado em 2026-10-07 não substitui a revalidação no momento do deploy.
3. O pre-deploy deste PR roda `node scripts/release-freeze.mjs` antes do `migrate deploy`: no staging ele só avisa; conferir no log do deploy (ainda não verificado no Railway).
4. Nada de rollback de deployment depois da rotação: o Railway restaura as variáveis antigas.

## Roteiro para quando houver acesso (ordem)

1. Variáveis no serviço web **e** no worker de staging: `ADMIN_MFA_ENCRYPTION_KEY` (nova, só staging), `PAYMENT_PROVIDER=asaas`, `ASAAS_ENV=sandbox`, `ASAAS_API_KEY=$aact_hmlg_…`, `ASAAS_WEBHOOK_TOKEN` (32–255, aleatório, ≠ chave), `ASAAS_PAYMENT_METHODS=pix,card`. Não imprimir valores.
2. Deploy da branch; preDeploy aplica as 3 migrations aditivas. Conferir `/api/health` e `/admin/readiness`.
3. MFA: login → cadastro → confirmar código → guardar códigos → logout → login com TOTP → login com código de recuperação → tentar reutilizar o mesmo código (deve falhar).
4. Webhook no painel Sandbox do Asaas: URL `https://rare-staging-staging.up.railway.app/api/asaas/webhook` (domínio que responde hoje; confirmar no Railway), token do passo 1, eventos `PAYMENT_CREATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_REFUND_IN_PROGRESS, PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_CHARGEBACK_DISPUTE, PAYMENT_AWAITING_CHARGEBACK_REVERSAL, PAYMENT_AWAITING_RISK_ANALYSIS, PAYMENT_APPROVED_BY_RISK_ANALYSIS, PAYMENT_REPROVED_BY_RISK_ANALYSIS`. Disparar evento de teste (deve ficar `ignored`, sem 5xx).
5. `npm run promotions:seed-black-friday`; no Admin: definir % real de teste, 1 produto, período curto (início em 2 min, fim em 10 min), preview desktop/mobile, ativar. Confirmar que aparece sozinho no início e some no fim, sem deploy.
6. Compra Pix Sandbox com a promoção (conferir valor no Asaas = total do pedido); pagar pelo simulador do Sandbox; pedido vira pago; e-mail; Admin mostra promoção/desconto/provider.
7. Compra cartão Sandbox (cartão de teste do Asaas na fatura hospedada).
8. Deixar uma cobrança expirar: worker apaga no Asaas e libera estoque.
9. Reembolso pelo Admin; webhook REFUNDED; pedido `refunded`; estoque não volta sozinho.
10. Regressão adversarial §28 (ver 07_SECURITY) contra o domínio de staging, incluindo headers Origin/Host/X-Forwarded/CF.
11. Mobile 320–1920 px da home com campanha e do Admin de promoções.

Registrar cada passo como PASS/FAIL com data em `docs/cycles/rare-bf-mfa-asaas/12_STAGING.md`.
