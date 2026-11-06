# 00 — Estado atual (CYCLE-01 DISCOVER)

Levantado em 2026-11-06 (America/Sao_Paulo). Evidência: comandos git/npm executados nesta data. Relatórios antigos (V1_7_*, docs/cycles, PROJECT_CONTEXT.md de 19/09) foram tratados como histórico, não como estado atual.

## Git

| Item | Valor |
|---|---|
| Worktree principal `E:\rare` | `codex/backend-evolution-20261007` @ `bc2c10c` (limpo, 2 arquivos não rastreados de contexto) |
| `main` / `origin/main` | `4ea73f5` (2026-09-25) "test(e2e): measure production console health…" |
| `integration/pre-go-live` / origin | `f15e5b6` (2026-10-12) = `main` + 3 commits: transporte Resend, ajuste de teste, **Pix via Mercado Pago** |
| `integration/pre-go-live` mergeada em `main`? | **NÃO** (`main...pre-go-live` = 0/3) |
| `codex/backend-evolution-20261007` | `main` + 50 commits (redesign editorial do storefront + docs de release/admin). **Não mergeada.** Diverge de `pre-go-live`. |
| Worktrees existentes | 4 em `.claude/worktrees/*` (preservados, nada removido) |
| Branch deste ciclo | `cycle/rare-bf-mfa-asaas-01` criada de `integration/pre-go-live@f15e5b6` em `.claude/worktrees/rare-bf-mfa-asaas-01` |

### Por que `integration/pre-go-live` como base
É o estado mais recente que contém `main` integralmente e já é a linha de integração de go-live (e-mail Resend + Pix). A linha `codex/backend-evolution` (redesign visual) não foi aprovada/mergeada e alteraria a mesma home onde a campanha entra; foi deixada fora para não misturar um redesign não homologado com este ciclo. **Risco registrado:** quando o redesign for integrado haverá conflito na home/product card; as mudanças deste ciclo foram mantidas em componentes isolados (`home-campaign`, `price-tag`) para facilitar o rebase.

## Produção / staging

| Item | Estado |
|---|---|
| `https://raredept.com.br/api/health` | 200 `{status: ok, database ok, configuration ok}` em 2026-11-06 16:53Z |
| Commit em produção | **NÃO VERIFICÁVEL daqui**: o Railway MCP disponível está autenticado em outro workspace (projetos DuraPets); o Railway CLI local responde `Unauthorized`. → MANUAL |
| Commit em staging | **NÃO VERIFICÁVEL** pelo mesmo motivo → MANUAL |
| Deploy de staging deste ciclo | **BLOQUEADO** (sem credencial Railway válida para o projeto RARE) → MANUAL |

## Stack (verificada no código da base)

- Next.js **16.3.8** App Router (`src/proxy.ts` no lugar de middleware), React 19.2.4, TypeScript, Tailwind 4.
- Prisma 7.9 + PostgreSQL (`@prisma/adapter-pg`). 15 migrations, a última `20261013120000_pix_mercadopago`.
- Redis (rate limit, com fallback em memória), R2 para mídia, web-push, e-mail transacional com outbox (SMTP/ZeptoMail/Resend).
- Worker durável `scripts/checkout-expiry-worker.ts` (serviço Railway `railway.cron.json`, `restartPolicyType: ALWAYS`) — expira reservas e drena o outbox de e-mail.
- Deploy Railway (`railway.json`: `prisma migrate deploy` em preDeploy), Cloudflare na frente (`client-ip` já ignora IP de edge).

## Pagamento / checkout / frete

- `src/lib/checkout.ts`: checkout 100% server-side — preço vem de `Product.priceInCents`, cupom `RARE10` (1ª compra, 10%) calculado no servidor, frete recalculado (fixo ou Melhor Envio), reserva de estoque com `UPDATE … WHERE stock - reservedStock >= qty`, lock de linha do pedido (`FOR UPDATE`) em toda transição.
- Provedores: **Stripe Checkout** (cartão/Pix Stripe) e **Mercado Pago Checkout API (Pix)** atrás de `PIX_ENABLED`. Enum `PaymentProvider { stripe, mercadopago }`.
- Webhooks: `/api/stripe/webhook` (assinatura + tabela `StripeEvent` para idempotência) e `/api/mercadopago/webhook` (assinatura HMAC; estado sempre relido da API).
- Expiração: `CheckoutExpiryJob` + `reconcileCheckoutExpiry` — fecha a cobrança no provedor **antes** de liberar estoque.
- Parcelamento: `installment-terms.ts` só exibe oferta verificada; hoje nenhuma oferta é fornecida (correto — nada hardcoded).
- `Product.compareAtPriceInCents` existe no schema/admin mas **não é exibido** na loja. Não há modelo de promoção.

## Admin / autenticação

- Login admin por e-mail/usuário + senha (bcrypt, custo constante, rate limit em 3 camadas). Sessão = JWT HS256 (8h) em cookie `rare_admin_session` com `credentialVersion` (hash do hash da senha) e `sessionVersion` (revogação no logout).
- Autorização centralizada em `getCurrentAdmin()` / `requireAdmin()` (páginas, server actions e `/api/admin/*`) + checagem de assinatura no `proxy.ts`.
- **MFA: inexistente.** Nenhum campo, rota ou fluxo.
- Sem modelo de audit log administrativo.

## Feature flags existentes

`CHECKOUT_ENABLED`, `PIX_ENABLED`, `SHIPPING_ENABLED`, `STRIPE_PAYMENT_METHOD_TYPES`, `EMAIL_DRIVER`, `RATE_LIMIT_DRIVER`, `APP_ENV` (production|staging|preview|homologation|development|test) via `deployment-environment.ts`.

## Baseline de qualidade (base `f15e5b6`, Windows, Node 22.20)

| Gate | Resultado |
|---|---|
| `npm ci` | OK |
| `tsc --noEmit` | OK (0 erros) |
| `vitest run` | **148 arquivos / 1239 testes PASS** |
| lint / build | executados no ciclo de validação |

## Ferramentas do ambiente deste ciclo

- Windows do dono (via Desktop Commander): node 22.20, git, rede OK. **Sem Docker, sem psql, sem Postgres local.**
- Nenhuma credencial Asaas disponível → Sandbox real **não executável** neste ciclo (MANUAL). Integração validada por mocks de transporte.
