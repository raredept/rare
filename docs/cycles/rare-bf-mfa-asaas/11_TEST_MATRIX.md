# 11 — Matriz de testes

## CYCLE-04 (2026-11-07) — gates no commit final e laboratório staging-like

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | PASS |
| `eslint` | PASS |
| `vitest run` | PASS — 164 arquivos / 1465 testes (também em `TZ=UTC`, como no runner Linux) |
| `npm run build` + server actions/standalone | PASS |
| `npm run release:guard` | PASS — 6 OK, 0 FAIL, 1 WARNING pré-existente (`vercel.json`) |
| `npm audit --omit=dev` | 0 vulnerabilidades (avisos só em dev deps: vitest mocker, basic-ftp via lighthouse, brace-expansion) |
| CI GitHub `PR CI` (novo) | PASS no PR #2 (types, lint, unit, audit, build, release guard) |
| `qa:bf-asaas` / `qa:checkout-concurrency` (PostgreSQL real) | PASS — 8 + 12 provas, 0 chamadas a provedores |
| `qa:staging-lab` Chromium (asaas / desconhecido / stripe) | PASS — 24 + 2 + 2 |
| `qa:staging-lab` WebKit, HTTPS local | PASS — MFA/segurança 8/8 + pagamentos (asaas 3, desconhecido 2, stripe 2) numa passada; Promoções 13/13 na seguinte (o WebKit de Windows é ~4× mais lento) |
| Firefox | NÃO EXECUTADO (navegador do Playwright não instalado; M-19) |
| Log do servidor (lab) | 0 de 67 valores sensíveis vazados; 0 padrões de credencial |
| Integridade do banco após o uso (lab) | 0 anomalias em 9 checagens (`LAB_DATA_INTEGRITY`) |
| Staging real | **NÃO EXECUTADO** — BLOCKED_EXTERNAL (M-01) |
| Asaas Sandbox / webhook real | **NÃO EXECUTADO** — BLOCKED_EXTERNAL (M-02, M-18) |

Specs novos (opt-in, `QA_LAB_ENABLED=1` pelo runner): `tests/e2e/bf-mfa-admin-security.spec.ts` (8), `bf-mfa-payments.spec.ts` (4, por fase), `bf-mfa-promotions.spec.ts` (13). Detalhe por caso em `cycles/CYCLE-04-STAGING.md`.

## CYCLE-01/02 (2026-11-06)

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
