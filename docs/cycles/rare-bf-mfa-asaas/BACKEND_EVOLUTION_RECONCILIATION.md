# Reconciliação — `codex/backend-evolution-20261007` × ciclo BF/MFA/Asaas

CYCLE-05 (2026-11-07). Fecha a pendência **M-14**. Detalhe da execução em [cycles/CYCLE-05-BACKEND-RECONCILIATION.md](cycles/CYCLE-05-BACKEND-RECONCILIATION.md).

## Bases

| Papel | Ref | Commit |
|---|---|---|
| Ciclo (PR #2) | `cycle/rare-bf-mfa-asaas-01` | `d811724` |
| Evolução de backend/redesign | `codex/backend-evolution-20261007` | `bc2c10c` |
| Base comum | `main` | `4ea73f5` |
| Integração (temporária) | `integration/rare-bf-backend-evolution` | merge `21729fb` (pais `d811724`, `bc2c10c`) |

- Desde a base: o ciclo mudou 162 arquivos; o backend mudou 160 (67 novos, 93 alterados, **0 apagados**, **0 migrations**).
- Interseção: 18 arquivos — 7 com conflito textual e 11 mesclados automaticamente (todos revisados à mão).

## Método

1. `git merge --no-ff --no-commit origin/codex/backend-evolution-20261007` numa branch temporária criada a partir do ciclo; `main` e as duas branches de origem intocadas; nada de `--ours`/`--theirs` global.
2. Cada conflito resolvido arquivo a arquivo pelo significado, não pelo lado.
3. O commit de merge leva **só** a resolução dos conflitos. A regressão completa rodou nesse commit antes de qualquer outra correção, para medir o dano real da integração.
4. Correções de problemas semânticos encontrados depois entram em commits separados, cada um com o motivo.

## Classificação

### SUPERSEDED — o ciclo já tem algo melhor

| Arquivo | Decisão |
|---|---|
| `package.json` | O backend só mexia nos pins `next` 16.3.8, `nodemailer` 10.0.13 e `eslint-config-next`; o ciclo já está em `next` ^16.4.5 e `nodemailer` ^10.3.1 (correções de segurança). Mantidos os do ciclo; o resultado é idêntico ao `package.json` de `d811724`. |
| `package-lock.json` | Lockfile do ciclo, coerente com o manifesto resolvido. Provado com `npm ci` (799 pacotes, árvore limpa depois) e `npm audit --omit=dev` = 0. Nenhuma edição manual de lockfile. |

### MERGE — conflito textual, resolvido combinando os dois lados

| Arquivo | Do backend fica | Do ciclo fica |
|---|---|---|
| `src/app/admin/(protected)/page.tsx` | layout `min-w-0`, nota de fuso, nota de receita, grade `2xl` | alertas de promoção (`role=status`) e resumo de promoções |
| `src/components/admin/admin-nav.tsx` | navegação por seções (Operação/Catálogo/Sistema) com ícones | entradas **Promoções** e **Segurança** (MFA) |
| `src/components/store/cart-page-client.tsx` | estilo do redesign (botões sem cantos, `font-semibold`, controles `h-11`, links de política `min-h-11`) | disponibilidade por `PAYMENT_PROVIDER`, seletor Pix/cartão, janela de pagamento persistida (`paymentWindowMinutes`, não "15 minutos" fixo), nota do provedor (não "Stripe" fixo), preço promocional riscado, sincronização `/api/cart/pricing` |
| `src/components/store/product-card.tsx` | tipografia e espaçamento do card | `PriceTag` com preço do servidor; parcelamento calculado sobre o preço final |
| `src/components/store/product-detail-client.tsx` | tipografia da PDP | `PriceTag` + selo da promoção; parcelamento e carrinho com o preço final do servidor |

### MERGE — mesclados automaticamente e revisados

| Arquivo | Verificação |
|---|---|
| `src/app/(store)/page.tsx` | redesign da home + `HomeCampaign` vinda das promoções (sem campanha fixa no código); carrossel de destaques usa `pricing.finalPriceInCents` |
| `src/app/(store)/produto/[slug]/page.tsx` | só layout/breadcrumb do backend; JSON-LD continua com o preço final |
| `src/app/admin/(protected)/orders/actions.ts` | validação de id do backend em `updateOrderStatusAction`; `requestOrderRefundAction` (Asaas) do ciclo intacto, com regex de id e confirmação `ESTORNAR` |
| `src/app/globals.css` | tokens da loja do backend + regras `.admin-dark … :not(.admin-light-scope *)` do ciclo; o backend não tocou nas regras do Admin |
| `src/components/store/checkout-page.tsx` | continua passando `paymentProvider={getPaymentProvider()}` e Pix/cartão disponíveis |
| `src/lib/admin-analytics.ts` | estoque crítico ordenado no PostgreSQL (SQL parametrizado, sem `@@map` no schema) + analytics de promoção do ciclo |
| `src/lib/feedback-messages.ts` | chaves dos dois lados, sem duplicata (o TypeScript recusaria) |
| `readiness/page.test.ts`, `api/health/route.test.ts`, `src/lib/auth.test.ts` | casos dos dois lados; suíte unitária PASS |
| `docs/railway-env-checklist.md` | aviso do backend apontando para `STAGING_SAFETY.md` / `CRON_OWNERSHIP.md` + seções do ciclo |

### KEEP — só no backend, aceito como está

- **Shell do Admin**: `layout.tsx` reconstruído (sidebar `w-72` com rolagem, usuário e **Sair**), `admin-header.tsx` (menu móvel em diálogo com foco contido, Esc, sino de notificações, **Sair** abaixo de `lg`), `admin-pagination`, `error.tsx`, `loading.tsx`. `requireAdmin()` continua no layout; o MFA continua exigido no proxy e em `getCurrentAdmin()`, que serve `requireAdmin()`, as actions e as APIs do Admin (uploads, push).
- **Endurecimento**: `request-security.ts` (mesma origem, uma única definição), `request-body.ts` (corpo limitado), `admin-action-input.ts`; uploads, push-subscriptions (origem, `Content-Type`, limite 4 KB, rate limit, `strict()`, exige troca de senha) e editor de imagens; validação de entrada nas actions de banners/categorias/notificações/produtos/configurações.
- **Health**: `GET(request: Request)` (corrige um dos 4 erros de route-types que travavam o build do backend); anônimo continua recebendo só o veredito.
- **Redesign da loja**: 39 arquivos (páginas institucionais, conta, pedidos, cabeçalho, rodapé, navegação, carrosséis, mídia).
- **Testes**: 23 arquivos unitários + harness visual (`tests/visual-storefront`), build sem credenciais (`tests/build-storefront-safe`) e `tests/e2e/admin-responsive.spec.ts`.
- **Config/scripts**: ESLint ignora `playwright-report`, `test-results` e `.claude/worktrees`; `tsconfig` exclui saídas de teste; `vitest` com `envDir: false` (unit nunca lê `.env`); `next.config` desliga o cache de dev só em QA; `check-migrations` com aviso mais seguro; `qa-admin-data-contract`; `qa-isolated-admin-e2e`.
- **Docs**: 23 documentos do backend (status, runbooks de staging/cron/migrations, incidente de credenciais). São registros históricos daquela linha; o que eles dizem sobre o build (`BUILD_GATE=BLOCKED`) foi superado pelo build integrado (PASS, ver Testes). O que dizem sobre o incidente de credenciais continua valendo (ver Bloqueios).

### DUPLICATE

Nenhuma. Conferido: uma única definição de `isSameOriginRequest`, `readBoundedRequestBody` e `parseAdminEntityId`; nenhuma rota do ciclo reimplementa essas checagens.

### REJECT

| Origem | Motivo |
|---|---|
| Pins `next` 16.3.8 / `nodemailer` 10.0.13 do backend | rebaixariam versões com correções de segurança (ver SUPERSEDED) |
| Classes `bg-white text-black` / `bg-black text-white` e `aria-label` no badge de não lidas do `admin-nav` do backend | reintroduziam o contraste ~1,05:1 que o ciclo já tinha corrigido (o tema escuro remapeia `.bg-white`) e usavam `aria-label` em `<span>` sem papel; substituídos pelas regras `.admin-nav-badge` e texto `sr-only` (bug B-02) |

### CONFLITOS SEMÂNTICOS encontrados depois do merge (corrigidos em commits próprios)

| # | Problema | Correção |
|---|---|---|
| B-01 | O header novo do Admin não conhece as rotas do ciclo: `/admin/promotions*` e `/admin/security` apareciam como "Admin" no título | rótulos Promoções / Nova promoção / Editar / Pré-visualizar / Detalhes / Segurança |
| B-02 | Badge de não lidas do nav (ver REJECT) | regras `.admin-nav-badge` + `sr-only` |
| B-03 | A home do redesign tirou o `store-shell` do topo; a campanha Black Friday ficaria colada nas bordas com cantos arredondados | campanha em faixa inteira (como o hero), conteúdo alinhado por `store-shell`, imagem de fundo cobrindo a faixa |
| B-04 | `PriceTag`, selo de promoção, campanha e seletor de pagamento do ciclo usavam a linguagem visual antiga (pílulas, `font-black`) no meio do redesign | alinhados ao redesign: sem cantos, `font-semibold`/`font-medium`, riscado em `neutral-600` |
| B-05 | `docs/runbooks/PENDING_MIGRATIONS.md` do backend fala em 14 migrations | nota de reconciliação: 18 migrations, as 4 do ciclo aditivas, link para `10_DATABASE.md` |
| B-07 | A matriz responsiva do Admin do backend (8 larguras) não conhecia as telas do ciclo | `/admin/promotions`, `/admin/promotions/new` e `/admin/security` incluídas |

Bugs encontrados nos testes de navegador entram em [CYCLE-05](cycles/CYCLE-05-BACKEND-RECONCILIATION.md#bugs-found).

## Preservação (o que não podia se perder)

| Área | Evidência no integrado |
|---|---|
| MFA do Admin (TOTP, recovery codes, limitadores, cookie pendente, reset) | unit PASS; `qa:bf-asaas` prova `mfa_totp_single_use_under_concurrency`; lab: 8 casos de MFA/segurança |
| Promoções e Central de Promoções | unit PASS; lab: 13 casos (validação, rascunho/preview, ativação, edição ao vivo, replay de action) |
| Black Friday na home a partir das promoções | lab: campanha QA chega à vitrine sem deploy; nenhum texto de campanha fixo |
| Preço no servidor (R$200 → R$150; mínimo R$1) | `qa:bf-asaas` (`…server_total_170`); unit do motor; lab de preços |
| `PAYMENT_PROVIDER` (stripe / asaas / disabled; desconhecido → disabled) | lab nas 3 fases; carrinho mescla mantém `paymentAvailable` |
| Guardas do Asaas (sandbox × produção por prefixo e host fixo) | unit `asaas-config` PASS; nenhuma chave real usada |
| Stripe e rollback (`PAYMENT_PROVIDER=stripe`) | fase stripe do lab |
| Mercado Pago não reativado com Asaas | nota do provedor e fase asaas do lab ("nunca cita outro gateway") |
| Drivers de e-mail | `email-outbox-worker` unit PASS; health admin com `getEmailReadiness()` |
| Webhook Asaas (token, idempotência, inbox) | lab: token, duplicatas, corpo malformado e grande; `qa:bf-asaas` |

## Banco

- O backend não traz migration. O integrado tem 18 (14 da `main` + 4 do ciclo: `pix_mercadopago`, `admin_mfa_audit`, `promotions`, `asaas_payments`), todas aditivas (só `CREATE`/`ADD`).
- PostgreSQL 17 descartável: `migrate deploy` 18/18, `migrate status` em dia, `migrate diff` banco → `schema.prisma` **sem diferença**; banco removido depois. `prisma/` idêntico ao do ciclo.
