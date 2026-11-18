# RARE-FINAL-AUDIT-ASSISTANT-01 — Auditoria final da plataforma + Assistente Virtual RARE

- Base: `origin/main@80c99e53e391cd9c04a339f1083885ed6b215f14` (confirmada com `git fetch` em 2026-11-18; produção em `80c99e5`).
- Branch: `cycle/rare-final-audit-assistant-01`, worktree dedicada `E:\rare\.claude\worktrees\rare-final-audit-assistant-c0c193`
  (criada pelo app antes do ciclo; a branch do ciclo foi criada nela a partir de `origin/main`). Checkout principal e worktrees
  de outros ciclos não foram tocados.
- **Produção: nenhuma alteração** (`PRODUCTION_CHANGED=NO`). Uso de produção: só leitura (headers da home, `GET /api/health`,
  e um `POST /api/assistant` sem corpo que respondeu 404 — a rota ainda não existe lá).
- Sem merge, sem deploy, sem Railway/Cloudflare/DNS/Search Console/Merchant/Asaas/webhook/VAPID/secrets.
- Evidências pesadas fora do Git: `output/assistant-01/` (prints), `output/lab/` (logs do servidor do lab) e
  `output/playwright/` (relatórios).

## 1. Baseline

| Item | Valor |
|---|---|
| `origin/main` | `80c99e53e391cd9c04a339f1083885ed6b215f14` (igual ao esperado) |
| Produção (`/api/health`) | `status=ok`, banco ok, configuração sem erros (2026-11-18T14:45Z) |
| Headers de produção | CSP `base-uri 'self'; object-src 'none'; frame-ancestors 'none'`, HSTS 2 anos, `nosniff`, `DENY`, Referrer/Permissions-Policy — idênticos a `src/lib/security-headers.ts` |
| Migrations em `main` | 25 (todas aditivas) |

## 2. Arquitetura (árvore lógica)

```
RARE (Next.js 16 App Router, React 19, TypeScript, standalone em Railway)
├─ Borda: Cloudflare (DNS/proxy) → Railway `rare` (web) + `rare-cron` (worker `checkout:worker`)
│  └─ preDeploy: release-freeze + `prisma migrate deploy` (advisory lock off)
├─ src/proxy.ts (edge): Basic gate de staging, gate grosso de sessão Admin/Cliente, 404 de catálogo, request-id de Server Action
├─ Dados: PostgreSQL (Prisma 7 + adapter-pg) · Redis opcional (rate limit compartilhado; fallback memória) · R2/local (mídia)
├─ Auth
│  ├─ Admin: JWT HS256 (8h) + sessionVersion + credentialVersion + MFA TOTP (AES-GCM) + recovery codes (hash) → getCurrentAdmin()
│  ├─ RBAC: admin-permissions.ts (deny-by-default) → requireAdmin(permission) em página, Server Action e Route Handler
│  └─ Cliente: JWT + sessionVersion (logout revoga), CPF obrigatório no checkout
├─ Storefront: home, categorias, coleções, PDP, carrinho/checkout, conta, suporte, políticas, 404 próprio
│  ├─ Promoções (engine pura) · parcelamento (servidor recalcula) · frete (Melhor Envio/manual) · cupom RARE10
│  ├─ Consentimento de cookies (1 cookie) · analytics próprio com opt-in (sem PII, retenção 400 dias)
│  └─ NOVO: Assistente Virtual (widget + POST /api/assistant)
├─ Pagamentos: Asaas (Pix/cartão/parcelas) · inbox de webhook com lease + idempotência · Stripe/Mercado Pago aposentados (fail closed)
├─ Estoque: STANDARD/UNIQUE, reserva por UPDATE condicional, expiração por worker (lease), movimentos de inventário
├─ Workers: checkout-expiry-worker (rare-cron), outbox de e-mail (Resend/ZeptoMail/SMTP), inbox Asaas, cron de liberação
├─ Notificações: AdminNotification + Web Push (VAPID, allowlist de endpoints, payload sem PII)
├─ SEO: robots, sitemap, canonical/paginação, noindex de filtros, Product/ProductGroup JSON-LD, feed Merchant (HOLD)
└─ Admin: dashboard, analytics (vendas/site), pedidos, clientes, notificações, suporte, produtos, promoções, categorias,
   banners, usuários, prontidão, configurações, segurança, conta, NOVO Assistente Virtual
```

## 3. Matriz de auditoria

| Área | Como foi verificado | Resultado |
|---|---|---|
| Auth Admin | leitura de `auth.ts`/`proxy.ts`; 243 testes de RBAC/MFA/sessão; `qa:admin-rbac` (9 provas) | PASS — sessão revalidada no banco a cada request (papel, ativo, sessionVersion, credentialVersion, MFA) |
| MFA | `admin-mfa*.test.ts`; `qa:bf-asaas` prova TOTP de uso único sob concorrência | PASS |
| RBAC | matriz por papel × permissão × superfície (páginas, Server Actions, `/api/admin`), deny-by-default | PASS — nenhuma proteção depende só de esconder botão |
| Auth Cliente | `customer-auth.ts`: sessionVersion, logout revoga | PASS |
| CSRF / same-origin | Server Actions (checagem de Origin do Next); Route Handlers mutáveis com `isSameOriginRequest`; cookies `SameSite=Lax/Strict` | PASS |
| XSS | 2 usos de `dangerouslySetInnerHTML`: JSON-LD (escapa `<`) e QR do MFA (SVG gerado no servidor) | PASS |
| SQL / Prisma injection | todo SQL bruto é template marcado (`$queryRaw\`…\``/`Prisma.sql`), parametrizado | PASS |
| Open redirect | `getSafeAdminNext`/`getSafeCustomerNext`/`resolveSafeInternalPath` | PASS |
| SSRF | push: allowlist de hosts https:443; feed/CEP/frete com hosts fixos | PASS |
| Upload | Admin, same-origin, rate limit, multipart, limite por arquivo e por request, validação de bytes no servidor; presign antigo 410 | PASS |
| Command injection / eval | nenhum `child_process`/`eval`/`new Function` em `src` | PASS |
| Mass assignment | schemas Zod com campos explícitos (checkout não aceita preço/total/juros) | PASS |
| Segredos no Git | varredura de **todo o histórico** por padrões de chave (Stripe, Asaas, Resend, AWS, GitHub, Slack, Mercado Pago, PEM, URLs de banco) + `release:guard` | PASS — só placeholders e fixtures de teste (ver §4) |
| Headers / CSP | código + produção | PASS com P3 (CSP completo só em report-only) |
| Pagamentos / Asaas | leitura do checkout e do webhook; `qa:bf-asaas`, `qa:checkout-concurrency` (13 provas) | PASS — navegador nunca é fonte de verdade de preço/desconto/juros/frete/estoque/status |
| Webhook | token comparado em tempo constante (SHA-256 + `timingSafeEqual`), corpo limitado a 64 KB, persistência antes de processar, lease, duplicata = 200 | PASS |
| Estoque | reserva por `UPDATE … WHERE stock - reservedStock >= qty`; `qa:inventory-policy` (15× corrida por peça UNIQUE: uma reserva) | PASS com P3 (sem CHECK no banco) |
| Banco / migrations | `prisma validate`, migrations do zero num PostgreSQL descartável, `migrate diff` sem diferença | PASS |
| Admin | RBAC por módulo, toasts com códigos conhecidos, audit log nas mutações sensíveis | PASS com P2 (lacunas no audit log) |
| Audit log | `sanitizeAuditSnapshot` remove chaves sensíveis + allowlist por chamador | PASS |
| E-mail / suporte / workers | `qa:email-outbox` (15 provas), `qa:support-coupon` (8 provas) | PASS |
| Web Push | 121 testes (manifest, SW, cliente, endpoint, rotas) | PASS — P2 conhecido RARE-PUSH-DELIVERY-RETRY-02 |
| Cookies / privacidade / analytics | 75 testes + `qa:site-analytics` (5 provas) | PASS |
| SEO | 57 testes (robots, sitemap, canonical, JSON-LD, feed) | PASS — `MERCHANT_SOURCE_ACTIVATION=HOLD_ATTRIBUTE_GAPS` mantido |
| Logging / PII | busca por logs com e-mail/CPF/telefone/endereço/token/cookie/body/endpoint | PASS — erros logam só o tipo; e-mail usa referência opaca |
| Dependências | `npm audit --omit=dev` | PASS — 0 vulnerabilidades |
| A11y / responsivo | axe + larguras 320–1440 no lab (widget e Admin novos) | ver §9 |
| Performance | tamanho de chunk do widget; leitura de queries | PASS com P3 |

## 4. Findings

Nenhum P0 ou P1 encontrado.

| ID | Sev. | Subsistema | Arquivo | Evidência | Impacto | Pré-condição | Recomendação | Status |
|---|---|---|---|---|---|---|---|---|
| FA-01 | P2 | Admin / audit log | `src/app/admin/(protected)/{products,orders,categories,banners,notifications}/actions.ts` | essas Server Actions não chamam `recordAdminAudit` (pedidos registram só o estorno; status manual vai para `InventoryMovement.reason`, sem ator) | não há trilha de **quem** mudou preço, estoque, status manual de pedido, categoria ou banner | Admin autenticado com a permissão do módulo | adicionar `recordAdminAudit` (campos de negócio) nessas actions, sem migration | OPEN (documentado; fora do escopo) |
| FA-02 | P2 | Web Push | `src/lib/admin-notifications.ts` | RARE-PUSH-DELIVERY-RETRY-02 (backlog oficial) | push perdido em falha temporária do provedor | falha transitória do serviço de push | outbox de entrega com retry/backoff (ciclo próprio) | OPEN (backlog) |
| FA-03 | P3 | Headers | `src/lib/security-headers.ts` | CSP aplicado só tem `base-uri`, `object-src`, `frame-ancestors`; `script-src` etc. estão em report-only | sem defesa em profundidade contra XSS (nenhum sink encontrado) | existir um XSS | promover o CSP report-only com nonces, testando regressão real | OPEN |
| FA-04 | P3 | Estoque / banco | `prisma/migrations/*` | nenhuma `CHECK` (`stock >= 0`, `reservedStock >= 0`, `reservedStock <= stock`) | invariante garantida só pelo código (que está correto e provado em corrida) | bug futuro no código | migration aditiva com `CHECK … NOT VALID` + `VALIDATE` em ciclo próprio | OPEN |
| FA-05 | P3 | Headers | `src/lib/security-headers.ts` | HSTS sem `includeSubDomains`/`preload` | subdomínios sem HSTS | subdomínio servindo http | avaliar com o DNS antes de ativar | OPEN |
| FA-06 | P3 | Checkout | `src/app/api/checkout/route.ts` | sem `isSameOriginRequest` explícito | depende de `SameSite=Lax` + JSON (preflight) | navegador sem SameSite | adicionar a checagem (como em analytics/uploads) | OPEN |
| FA-07 | P3 | Hosting | `vercel.json` | `release:guard` avisa cron legado | job duplicado se a Vercel publicar | projeto Vercel ativo | confirmar/remover | OPEN (pré-existente) |
| FA-08 | INFO | Backlog | `docs/cycles/RARE_BACKEND_BACKLOG.md` | 3 linhas antigas (gate de build, upsert de settings, JSON-LD com variação inativa) não se reproduzem: build passa; `upsert` com `update: {}` medido sem UPDATE; JSON-LD filtra variações ativas | backlog enganoso | — | nota adicionada no backlog | RESOLVED (doc) |
| FA-09 | INFO | Cookies | — | F-01/F-02 do ciclo de cookies seguem abertos (texto "Entrega"; purga oportunista) | — | — | — | OPEN (pré-existente) |
| FA-10 | INFO | Merchant | — | atributos `color`/`gender`/`age_group`/`brand` ausentes | — | — | manter `HOLD_ATTRIBUTE_GAPS` | HOLD |

Segredos (nunca impressos): `.env.example` e `scripts/validate-linux-standalone.mjs` contêm placeholders (`replace…`,
`validation`, `linux-…`, banco `127.0.0.1`); `sk_live_*` aparecem só em 4 arquivos de teste como valores fictícios
(`sk_live_1234…`, `…exam…`, `…notr…`, `…secr…`); os acertos de `re_…_…` são nomes de cookie/constante, não chaves Resend.
Nenhum segredo real versionado → nenhum P0 de segredo.

## 5. Correções

Nenhum P0/P1 → nenhuma correção de auditoria fora do Assistente. Itens tocados:

- RBAC: permissão nova `system.assistant` só para SYSTEM_ADMIN, com o `ADMIN` legado **explicitamente excluído**
  (`LEGACY_ADMIN_EXCLUDED_PERMISSIONS`); todas as outras permissões do legado preservadas (teste dedicado).
- Backlog: linha RARE-PUSH-DELIVERY-RETRY-02 e nota de verificação (FA-08).

## 6. Arquitetura do Assistente

```
Admin (SYSTEM_ADMIN)                         Loja (anônimo)
/admin/assistant ──Server Actions──┐        StoreChrome (server) ── getPublicAssistantBootstrap() ── null → nada
  config · CRUD · ativar/desativar │                                └─ { nome, boas-vindas, placeholder, ≤4 sugestões }
  "Testar Assistente" (preview)    │        AssistantLauncher (client, ~1,4 KB gzip) ── abre ──▶ AssistantPanel (React.lazy, chunk próprio ~2,9 KB gzip)
          │                        │                                                        │ fetch POST /api/assistant
          ▼                        ▼                                                        ▼
  src/lib/assistant/engine.ts  ◀── mesma engine ──────────────────────────────── route.ts (same-origin, JSON, 4 KB, 30/min)
  (AssistantEngine: deterministic-v1)                                                         │
          │                                                                                   ▼
  matching.ts (puro) ◀── store.ts (Prisma; cache 15 s só para o layout; endpoint sem cache) ── PostgreSQL
```

- **Sem IA generativa / LLM externo** (`GENERATIVE_AI=NO`, `EXTERNAL_LLM_API=NO`). A resposta é sempre um texto que o Admin
  escreveu, ou o fallback configurado. Uma engine futura implementa `AssistantEngine` (`engine.ts`) sem mudar UI, Admin
  ou contrato do endpoint.
- **Matching** (`matching.ts`): trim → minúsculas → NFD → remove acentos → remove pontuação → espaços → tokens sem
  stopwords (pt-BR) e com plural dobrado. Score: pergunta igual = 1,0; senão OU probabilístico entre Dice de tokens
  (mensagem × pergunta) e palavras-chave (1 → 0,55, 2 → 0,80, 3 → 0,91; frases contíguas, nunca substring). Threshold
  **0,50**: abaixo disso, fallback. Prioridade (0–10) vale 0,012/ponto **só entre candidatos acima do threshold** — nunca
  resgata match fraco; empate final por `sortOrder` e `id` (determinístico).
- **Endpoint público** `POST /api/assistant`: same-origin obrigatório (403), rate limit 30/min por endereço via
  `rateLimit()` existente (chave com hash, nada guardado), `content-type: application/json` (415), corpo ≤ 4 KB (413),
  `{ "message": string }` estrito, 1–500 caracteres (400). Respostas: `{ matched, answer, category, cta }`; nunca
  keywords, prioridade, score, ids ou autores. Desativado → 404 `Assistente indisponível.`; falha de banco → 503 (loga só
  o tipo do erro). `cache-control: no-store`.
- **Privacidade**: a pergunta do cliente não é gravada, logada, enviada a analytics nem associada a cliente/sessão/IP/
  pedido. Conversa só em memória React da página. Nenhum cookie/localStorage/sessionStorage novo
  (`COOKIE_POLICY_CHANGED=NO`, `COOKIE_STORAGE_INVENTORY_CHANGED=NO`).
- **Widget**: botão preto/branco (“Dúvidas” + ícone; só ícone no celular), `z-30` abaixo do header e de todos os overlays
  modais, sempre **acima das barras fixas de rodapé** — banner de cookies e barra de compra do PDP no celular (altura de
  layout medida por `ResizeObserver`/`MutationObserver`, sem tocar no código delas) —, safe-area do iPhone; painel `role="dialog"`
  não modal, foco no campo ao abrir, `Esc` fecha e devolve o foco ao botão, `role="log"`/`aria-live="polite"` para
  respostas, alvos ≥ 44 px, animações só com `motion-safe`. Escondido em `/finalizar-compra` e `/pedido/*` para não
  disputar a tela de pagamento. Texto sempre como texto React (sem `dangerouslySetInnerHTML`).
- **Cache**: só o layout da loja (props do widget) usa cache em memória de 15 s; mutações no Admin o invalidam onde
  possível e as demais instâncias/bundles convergem em ≤ 15 s. O **endpoint público lê sempre do banco** (2 consultas
  indexadas, sob rate limit): o lab mostrou que o Next empacota Route Handlers à parte, com estado de módulo próprio, então
  um cache ali não veria a invalidação — desativar ou editar vale na pergunta seguinte. O preview do Admin também lê direto.
  Erros nunca são cacheados.
- **Falha não derruba a loja**: `getPublicAssistantBootstrap()` captura qualquer erro e devolve `null` (widget some).

## 7. RBAC do Assistente

| Papel | Navegação | `GET /admin/assistant` | Server Actions (criar/editar/ativar/desativar/config/preview) |
|---|---|---|---|
| SYSTEM_ADMIN | visível (Sistema → Assistente Virtual) | 200 | permitido |
| SELLER_ADMIN | oculto | → `/admin/sem-acesso` | negado antes de qualquer leitura/escrita |
| ADMIN legado | oculto | → `/admin/sem-acesso` | negado antes de qualquer leitura/escrita |
| Cliente / anônimo | — | → `/admin/login` | — |

- Cada página e cada Server Action chama `requireAdmin("system.assistant")` como **primeira** instrução (teste estático
  da matriz + teste de page guards). MFA e sessão seguem o fluxo Admin existente (sem auth paralelo).
- Não há Route Handler Admin para o Assistente (só Server Actions); o endpoint público não expõe dados administrativos.
- Audit (`AdminAuditLog`): `assistant.config_updated`, `assistant.entry_created`, `assistant.entry_updated`,
  `assistant.entry_activated`, `assistant.entry_deactivated` — só campos de negócio; nunca sessão, cookie, token, pergunta
  do cliente ou do preview.

## 8. Migration

- `prisma/migrations/20261118120000_virtual_assistant/migration.sql`: **aditiva** (`DESTRUCTIVE_MIGRATION=NO`) — 2 tabelas,
  1 índice, 2 FKs `ON DELETE SET NULL` para `User`. Nenhuma tabela existente muda; nenhuma linha inserida (o Assistente
  nasce **desativado** porque a ausência de config = defaults com `enabled=false`). Nenhum seed comercial.
- Validação: `prisma validate` PASS; `prisma generate` PASS; migrations do zero num PostgreSQL descartável
  (`rare_assistant_lab_zero`) PASS; `prisma migrate diff --from-config-datasource --to-schema` → **No difference detected**;
  o lab aplica as 26 migrations sobre um banco novo a cada execução.
- Rollback operacional (sem perda de outros dados): reverter o código e, se desejado,
  `DROP TABLE "VirtualAssistantEntry"; DROP TABLE "VirtualAssistantConfig";` + remover a linha
  `20261118120000_virtual_assistant` de `_prisma_migrations`. Rollback de produto sem tocar no banco: desmarcar
  “Mostrar o Assistente na loja” (some da loja na hora; endpoint passa a 404).

## 9. Evidência de testes

| Gate | Resultado |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | PASS |
| `npm run lint` | PASS (0 erros, 0 avisos) |
| `npm test` (Vitest) | **2572 passed / 3 skipped**, 218 arquivos (106 testes novos do Assistente + RBAC) |
| `npm audit --omit=dev` | PASS — 0 vulnerabilidades |
| `npm run build` (produção, `APP_ENV=staging` para o lab) | PASS — `/admin/assistant` e `/api/assistant` no build; 49 Server Actions íntegras (`server-actions:check`) |
| `npm run release:guard` | PASS — 7 OK, 1 WARNING pré-existente (`vercel.json`, FA-07), 0 FAIL; inclui `secrets:repository`, `secrets:diff`, `bundle:browser` |
| `prisma validate` / `generate` / migrations do zero / `migrate diff` | PASS / PASS / PASS / sem diferença |
| `qa:checkout-concurrency` | PASS (13 provas, 0 chamadas externas) |
| `qa:bf-asaas` | PASS |
| `qa:inventory-policy` | PASS (9 provas) |
| `qa:admin-rbac` | PASS (9 provas) |
| `qa:email-outbox` | PASS (15 provas, 0 chamadas externas) |
| `qa:support-coupon` | PASS (8 provas) |
| `qa:site-analytics` | PASS (5 provas) |

Testes novos do Assistente (Vitest): engine/normalização (`matching.test.ts`), validação/href/limites/audit views
(`config.test.ts`), cache e falha de banco (`store.test.ts`), endpoint público (`route.test.ts`: same-origin, 429, 415,
400 para JSON malformado/vazio/campos extras/longo, 413, 404 desativado, 503 sem logar a pergunta, sem vazar
keywords/prioridade/score/ids), Server Actions (`actions.test.ts`: negação sem tocar no banco, audit, href inseguro,
ativar vazio, concorrência otimista, preview sem escrita), widget (`assistant-widget.test.tsx`: texto escapado, dialog,
log, sem storage/cookie/analytics, chunk lazy, posição) e RBAC (`admin-permissions`, `admin-rbac-matrix`, `page-guards`).

**Lab** (`scripts/qa-staging-lab.ts --https`: build de produção + PostgreSQL descartável + admins sintéticos
A=ADMIN legado, E=SYSTEM_ADMIN, F=SELLER_ADMIN com MFA real; `tests/e2e/assistant.spec.ts`, 12 cenários):

| Engine | Resultado |
|---|---|
| Chromium | **12/12 PASS** |
| WebKit | **12/12 PASS** (1 h — WebKit no Windows custa segundos por chamada de driver) |
| Firefox | **12/12 PASS** |

Cenários: instalação nova (desativado, sem widget, endpoint 404); nav/URL por papel; **post forjado da Server Action**
(controle positivo do SYSTEM_ADMIN grava; SELLER_ADMIN e ADMIN legado → `sem-acesso`, nada gravado, nada auditado);
ativar vazio recusado; CRUD + desativar/reativar; href `javascript:` recusado no servidor (com o `pattern` do navegador
removido); audit log com ator e sem campos sensíveis; preview (match/fallback, confiança só no Admin, pergunta de teste
não gravada); axe no Admin novo em 1440/320/768 = 0 violações; widget: teclado (Enter abre, foco no campo, Esc fecha e
devolve o foco), sugestões do banco, keyword, acento/caixa, fallback com CTA `/suporte`, resposta hostil exibida como
texto (0 `img`/`script`, 0 `alert`), sem score na loja, **cookies/localStorage/sessionStorage idênticos antes e depois**,
nenhuma requisição além de `/api/assistant` contendo a pergunta; axe no painel aberto = 0 violações; larguras
320/360/375/390/430/768/1024/1440 em home, categoria e PDP sem overflow, botão ≥ 44 px dentro da tela, painel dentro da
tela, **botão acima da barra de compra do PDP**; banner de cookies aberto nas 8 larguras (botão e painel acima do banner,
“Recusar não essenciais” clicável); oculto no checkout; `prefers-reduced-motion`; contrato JSON + 400 + 403 cross-site;
desativar → endpoint 404 na hora e widget some; rate limit (32 perguntas → 429).
Scanner do lab: `LAB_LOG_SCAN leaked=0` (49 valores sensíveis verificados) e o log do servidor não contém nenhuma
pergunta de teste; `LAB_DATA_INTEGRITY` sem anomalias.

Prints: `output/assistant-01/` (Admin 1440/768/320, widget aberto nas 8 larguras, com banner de cookies, PDP com barra
de compra). Impacto de bundle: launcher ≈ 2,4 KB brutos / 1,4 KB gzip no chunk da loja; painel em chunk próprio
(7,5 KB / 2,9 KB gzip), baixado só ao passar o mouse, focar ou tocar; nenhuma SDK externa.

Achados do próprio lab, corrigidos antes do PR: rótulos do Admin poluídos pelo texto de ajuda (→ `aria-describedby`);
foco perdido após enviar (Esc não fechava); botão sobre o “Adicionar” da barra de compra do PDP no celular; cache do
endpoint não invalidado entre bundles do Next.

**Regressão completa do lab** (Chromium, build desta branch): fase `asaas` com `bf-mfa-admin-security`,
`bf-mfa-payments`, `bf-mfa-promotions`, `prelaunch-consent-analytics`, `prelaunch-rbac-inventory`, `order-item-sku`,
`card-installments`, `cookie-public-hardening` e `collections-cart` → **51 passed, 1 skipped, 1 falha de fixture**: a
`collections-cart` (incluída como extra) já cadastra o MFA do admin F que a `prelaunch-rbac-inventory` cadastra de novo
(mesma limitação conhecida de specs que dividem admins). Reexecutadas isoladas, `prelaunch-consent-analytics` +
`prelaunch-rbac-inventory` → **20/20 PASS**. Fases `qualquer-coisa` e `stripe` (provedor desconhecido / Stripe aposentado
precisam falhar fechados) → 2 passed + 3 skipped cada, como esperado. `LAB_LOG_SCAN leaked=0` (115 valores sensíveis
verificados), `LAB_DATA_INTEGRITY` sem anomalias (estoque negativo, itens órfãos, pagos sem `paidAt`, cliente Asaas
duplicado, códigos de recuperação órfãos, promoções inconsistentes = 0).

## 10. Regressões

| Gate | Resultado |
|---|---|
| `PAYMENT_CHANGED` / `ASAAS_CHANGED` / `WEBHOOK_CHANGED` / `INSTALLMENT_CHANGED` / `INVENTORY_RULES_CHANGED` | NO (nenhum arquivo desses domínios no diff) |
| Regressão financeira | `qa:checkout-concurrency` 13 provas, `qa:bf-asaas`, `qa:inventory-policy` 9 provas, testes unitários de checkout/Asaas/webhook/parcelamento/cupom/frete/estoque — PASS, 0 chamadas externas |
| iOS Push | 121 testes PASS (manifest, service worker, cliente, endpoint allowlist, rotas, notificações) |
| Cookies | 75 testes PASS + `qa:site-analytics` PASS; política e inventário inalterados |
| SEO | 57 testes PASS (robots `/conta$ /conta? /conta/`, sitemap, canonical/paginação, noindex de filtros, Product/ProductGroup, feed) |

## 11. Backlog conhecido

- **RARE-PUSH-DELIVERY-RETRY-02 — P2** (incluído em `RARE_BACKEND_BACKLOG.md`).
- FA-01 (audit log de catálogo/pedidos) — P2.
- FA-03…FA-07 — P3.
- Assistente v2 (fora deste ciclo): métricas agregadas e anônimas de “pergunta sem resposta” só com opt-in de analytics;
  engine com IA plugável via `AssistantEngine`, com revisão de privacidade antes.

## 12. Rollout (quando aprovado — não executado neste ciclo)

1. Merge do PR → deploy automático Railway; o preDeploy aplica a migration aditiva.
2. Conferir `GET /api/health` 200 e que a loja **não** mostra o widget (desativado por padrão); `POST /api/assistant` → 404.
3. Um SYSTEM_ADMIN cadastra as respostas reais em Admin → Sistema → Assistente Virtual, testa em “Testar Assistente”
   e só então marca “Mostrar o Assistente na loja”.
4. Smoke: abrir o widget no celular e no desktop, uma pergunta com resposta e uma sem (fallback + botão de suporte).

## 13. Rollback

- Produto: desmarcar “Mostrar o Assistente na loja” (endpoint fecha na hora; o botão some da loja em ≤ 15 s).
- Código: reverter o merge; as tabelas novas podem ficar (não são lidas pelo código antigo) ou ser removidas como em §8.

## 14. Recomendação final

**READY_FOR_REVIEW.** Nenhum P0/P1 aberto; P2 (FA-01, FA-02) e P3 documentados. O Assistente é aditivo, nasce desativado,
é exclusivo de SYSTEM_ADMIN (ADMIN legado e SELLER_ADMIN negados em navegação, URL e Server Action forjada), não guarda
nem envia a terceiros nada do que o cliente digita, não cria cookie/storage e não altera pagamento, Asaas, webhook,
parcelamento, estoque, SEO ou cookies. Recomenda-se revisar o PR, mergear e só então o operador cadastrar o conteúdo real
e ativar. Sem merge e sem deploy neste ciclo.
