> **Atualização vigente — 2026-11-13:** ver [RARE-FINAL-RELEASE-01](cycles/CYCLE-FINAL-RELEASE-01.md).
> Asaas é o único provider autorizado para novos pagamentos. Stripe não é fallback;
> rollback fecha checkout (`PAYMENT_PROVIDER=disabled`, `CHECKOUT_ENABLED=false`).
> Staging real publicado: web/worker c93f2f4, 18 migrations aplicadas, zero pendentes/drift.
> MFA real Chromium/Firefox/WebKit: 8/8 em cada. Sessões antigas rejeitadas nos dois ambientes.
> Produção contida no main anterior, checkout OFF; Stripe removida dos consumers ativos.
> Primeiro Pix Sandbox calculou R$ 170 corretamente; formato real do ID revelou bug corrigido
> em 54e0ac8, aguardando CI/deploy/reteste. Lifecycle, promoções e E2E comercial em andamento.
> Freeze ACTIVE, PR Draft. As seções abaixo preservam evidência histórica dos ciclos anteriores.
# 11 — Matriz de testes

## CYCLE-05 (2026-11-07) — integração com a evolução de backend

Branch `integration/rare-bf-backend-evolution` (merge `21729fb` + correções). Colunas: ciclo antes (`d811724`), merge bruto (`21729fb`, só resolução de conflitos) e integrado final.

| Gate | Ciclo `d811724` | Merge bruto | Integrado final |
|---|---|---|---|
| `npm ci` (lockfile do ciclo) | PASS | PASS (799 pacotes, árvore limpa) | PASS |
| `tsc --noEmit` | PASS | PASS | PASS |
| `eslint` | PASS | PASS | PASS |
| `vitest run` | 164 / 1465 | 171 / 1522 | 173 / 1542 |
| `npm audit --omit=dev` | 0 | 0 | 0 |
| `npm run build` (+ type check do Next, standalone, 35 server actions) | PASS | PASS | PASS |
| `release:guard` | 0 FAIL / 1 WARNING | 0 FAIL / 1 WARNING | 0 FAIL / 1 WARNING (`vercel.json`, pré-existente) |
| `migrate deploy` + `status` + `diff` (PostgreSQL 17 descartável) | 18 / em dia / sem diferença | idem | idem (`prisma/` inalterado) |
| `qa:bf-asaas` / `qa:checkout-concurrency` | 8 + 12 | 8 + 12 | 8 + 12 (0 chamadas a provedor) |
| Lab Chromium (asaas / desconhecido / stripe) | 24 + 2 + 2 | 17 + **1 FAIL** (axe) + 2 + 2 | PASS — 24 + 2 + 2 |
| Lab WebKit, HTTPS local | PASS | não rodado | asaas 24/24, desconhecido 2/2; stripe 1/2 na rodada longa (fixture Pix vencida após 29 min, B-10) → corrigido e reconfirmado: pagamentos 3 + 2 + 2 PASS |
| Lab Firefox, HTTPS local | não instalado | não rodado | asaas 22/23 (corrida de navegação no spec, B-09), desconhecido 2/2, stripe 2/2 → corrigido e reconfirmado: segurança 8/8 PASS |
| Admin isolado do backend (`qa:e2e:isolated`: contrato de dados + desktop + mobile) | — | não rodado | PASS (2 + 1; banco e storage removidos) |
| Matriz responsiva do backend (`admin-responsive`, 8 larguras × 14 telas, drawer com foco contido + axe) | — | não rodado | PASS |
| Log do servidor (lab) | 0 vazamentos | 0 / 67 valores | 0 vazamentos em todas as rodadas (Chromium, Firefox, WebKit) |
| Integridade do banco (lab) | 0 anomalias | 0 anomalias em todas as rodadas |
| Varredura de segredos (diff integrado × `main`) | — | — | 0 achados reais |

Novos testes: `src/lib/admin-page-label.test.ts` (16), `src/components/admin/admin-nav.test.ts` (4; falham 3/4 contra o merge bruto).

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
