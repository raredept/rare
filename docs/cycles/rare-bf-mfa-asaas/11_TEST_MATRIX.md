# 11 — Matriz de testes

Execução final: 2026-11-06, Windows do dono, Node 22.20, worktree `cycle/rare-bf-mfa-asaas-01`.

## Gates

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | PASS (0 erros) |
| `eslint .` | PASS |
| `vitest run` | **PASS — 163 arquivos / 1461 testes** (base: 148 / 1239) |
| `next build` (NODE_ENV=production) + server actions/standalone | PASS |
| `npm run release:guard` | PASS — 6 OK, 0 FAIL, 1 WARNING pré-existente (`vercel.json` cron legado) |
| `npm audit` | 0 vulnerabilidades |
| `prisma migrate deploy` (PostgreSQL 17 vazio) + `migrate diff` | PASS / sem diferença |
| `npm run qa:bf-asaas` (PostgreSQL real) | PASS — 8 provas |
| `npm run qa:checkout-concurrency` (PostgreSQL real) | PASS — 12 provas (QA corrigido neste ciclo; falhava igual na base) |
| E2E Playwright Admin/público/comercial | **NÃO EXECUTADO** — exige app servida com banco e staging (MANUAL) |
| Staging | **NÃO EXECUTADO** (12_STAGING) |

## Provas do QA em PostgreSQL real (`qa:bf-asaas`)

`bf_last_unit_five_buyers_one_winner_server_total_170`, `duplicate_and_out_of_order_webhooks_one_sale_no_regression`, `divergent_value_not_paid_incident_recorded`, `expiry_deletes_charge_first_then_releases_stock`, `payment_during_expiry_settles_as_paid`, `refund_no_restock_no_regression`, `asaas_customer_reused`, `mfa_totp_single_use_under_concurrency`.

## Cobertura exigida pelo prompt

| Área | Casos | Onde |
|---|---|---|
| MFA §68 | enrollment, TOTP errado/certo, janela expirada, replay, rate limit, recovery code, reuso de recovery, reset, sessão sem/com MFA, logout, cookie velho | `totp.test.ts`, `admin-mfa.test.ts`, `admin-mfa-crypto.test.ts`, `auth-mfa.test.ts`, `mfa/actions.test.ts`, `login/actions.test.ts`, `proxy.test.ts`, QA PG |
| Promoções §69 | draft, scheduled, active, paused, ended, fronteiras início/fim (23:59/00:00 SP), escopo produto/categoria/todos, prioridade, cupom, esgotado, preço no servidor, concorrência | `engine.test.ts`, `validation.test.ts`, `business-time.test.ts`, `promotions/actions.test.ts`, `checkout-session.test.ts`, `storefront-catalog.test.ts`, QA PG |
| Asaas §70 | customer criar/reusar, cobrança, Pix, cartão, credenciais inválidas, 400/401/403/404/429/5xx, timeout, webhook duplicado, fora de ordem, valor errado, id errado, reembolso/cancelamento, Pix em bloqueio cautelar | `asaas.test.ts`, `asaas-config.test.ts`, `asaas-webhook.test.ts`, `api/asaas/webhook/route.test.ts`, `checkout-asaas.test.ts`, `checkout-expiry-asaas.test.ts`, QA PG |
| Parcelamento | não oferecido (sem casos) | — |
| Sandbox real | — | **MANUAL** |
