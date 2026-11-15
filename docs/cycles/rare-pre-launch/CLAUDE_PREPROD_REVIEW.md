# RARE-PRE-LAUNCH-02 — pacote para a revisão independente

Sessão implementadora (Claude). **Não aprova produção**: o GO/NO-GO é de outra sessão, independente.
Produção não foi tocada (nenhum deploy, variável, migration ou dado). PR `raredept/rare#2` em DRAFT.
Nenhum segredo neste documento.

## 1. Identificação

| Item | Valor |
|---|---|
| SHA inicial | remoto `62de5a4` · local `7e734ca` (3 commits do Qoder não enviados) |
| SHA final (PR HEAD) | `4e32250` (código). O commit deste documento vem depois e só altera `docs/`. |
| Branch / PR | `cycle/rare-bf-mfa-asaas-01` · `raredept/rare#2` (DRAFT) |
| Staging web / worker | web `rare-staging` = worker `rare-checkout-worker-staging` = **`4e32250`** (ambos SUCCESS em 2026-11-14; o Railway aguardou o CI antes de construir) |
| Migrations | 21 no repositório; 3 novas e aditivas neste ciclo: `20261113120000_admin_rbac_roles`, `20261114120000_product_stock_policy`, `20261114130000_site_analytics_events` |

## 2. Commits do ciclo (sem squash; os do Qoder preservados)

```
4e32250 test(e2e): prove consent, analytics, RBAC roles and unique stock in a real browser
1635fe4 fix(admin): keep the new Admin screens readable at 320 px and in the dark theme
02375d4 fix(release): guard the InStock claim instead of the whole Product offer
9a0acba docs(admin): document the legacy ADMIN role and its manual migration
f29f148 feat(privacy): implement cookie preferences
90bd760 feat(analytics): add consent-aware site analytics
ea06099 feat(inventory): model unique item stock policy
b9e67ec test(admin): cover permission matrix
ba1d695 feat(admin): complete system and seller RBAC
7e734ca feat(seo): publish the RARE Dept brand alias and the displayed price offer
45777cd test(storefront): guard the production visual baseline in fixture regression
10adef7 fix(storefront): restore the approved production visual baseline
(+ docs(prelaunch) deste handoff)
```

## 3. Trabalho do Qoder

`10adef7` (restauração do visual aprovado de produção), `45777cd` (guarda de regressão visual) e
`7e734ca` (SEO) preservados como estavam. O RBAC que o Qoder/sessão anterior deixou em stage foi
commitado com as mensagens prontas (`ba1d695`, `b9e67ec`) depois dos gates. Backup original intacto
em `E:\rare-qoder-backup-20261113\`. Um Vite órfão do Qoder ainda escuta em `127.0.0.1:4173`
(PID iniciado em 2026-11-13 21:26, mesmo worktree); não foi encerrado por esta sessão.

## 4. RBAC

Ver `RBAC.md` (matriz, papel legado `ADMIN`, migração MANUAL de contas reais). Provas:
`admin-rbac-matrix.test.ts` (149 casos), `page-guards.test.ts`, `qa:admin-rbac` 9/9 (PostgreSQL
real), lab E2E `prelaunch-rbac-inventory.spec.ts` (SYSTEM e SELLER com senha + TOTP reais,
navegação, negação de cada área do outro papel, `/admin/sem-acesso`). Contas reais `ADMIN` continuam
com acesso total até a migração manual — **pré-requisito de produção**.

## 5. Analytics do site

- Tela `/admin/analytics/site` (`analytics.site`, ambos os papéis).
- Comportamental (`page_view`, `product_view`, `product_click`, `add_to_cart`): só com consentimento.
  Sem consentimento o cliente não cria id, não enfileira e não envia; a rota também não grava sem o
  cookie de consentimento (dupla barreira).
- Operacional (checkout iniciado, pagamento iniciado, compra confirmada): lido dos pedidos no
  servidor; o navegador não pode enviar (allowlist).
- Sem PII: ids aleatórios guardados só como HMAC com chave derivada do segredo de sessão; path sem
  query e áreas de conta/pedido colapsadas; sem IP (só chave do rate limit, já hasheada), sem
  user-agent (classe de dispositivo). Lote ≤ 20 eventos/8 KB, mesma origem, 60 req/min por endereço,
  bots ignorados, productId validado, `sendBeacon`/`keepalive` (não bloqueia navegação), retenção 400 dias.
- Provas: unit (contrato, rota, cliente sem DOM), `qa:site-analytics` 5/5 (PostgreSQL real), lab.
- Limitação: os números comportamentais são um piso (só quem aceitou); a tela diz isso.

## 6. Cookies / consentimento

- Banner com Aceitar / Recusar não essenciais / Configurar (mesmo peso visual; teste compara as cores).
- Painel com categoria, finalidade, cada cookie/chave, duração e origem; reabre por
  "Preferências de Cookies" no rodapé; Esc fecha (dialog nativo).
- Registro: cookie próprio `rare_cookie_consent` = `v{versão}.a{0|1}.{epoch}`, 180 dias, sem PII.
- Recusar/retirar apaga `rare_analytics_visitor` e `rare_analytics_session` e descarta a fila.
- `/politica-de-cookies` gerada do mesmo catálogo; teste falha se o código gravar cookie/chave não
  descrito ou se surgir outro módulo que grave storage.
- Prova principal (lab, navegador real): visitante novo e visitante que recusa → **zero requisições a
  `/api/analytics/events`, zero identificadores, zero linhas novas** durante home → catálogo → clique →
  produto → carrinho → reload. **PASS no lab Chromium (HTTPS)**; WebKit/Firefox: ver §11. e **PASS no staging real** pelo Chrome do usuário (§11).

## 7. Política de estoque

`Product.stockPolicy` (`STANDARD` padrão | `UNIQUE`), migration aditiva. UNIQUE: 1 = Disponível,
reservada = Reservada, 0 após venda = Vendida, 0 sem venda = Esgotada — nunca crítico por quantidade.
Crítico = inconsistência (estoque/reserva negativos, reserva > físico, reserva ≠ pedidos em aberto,
venda dupla, reserva dupla, vendida e ainda comprável/com unidade, >1 unidade). Auditoria em uma
única query (snapshot coerente). Prontidão: inconsistência bloqueia; reposição esgotada vira aviso;
peça única vendida não é pendência. Formulário recusa UNIQUE com mais de 1 unidade.
Provas: unit, `qa:inventory-policy` 9/9 (incl. 15× três checkouts disputando a peça: uma reserva),
lab E2E (Disponível → Vendida → Inconsistente, dashboard e prontidão).

## 8. SEO (`7e734ca`) e visual

- Auditoria: `isPublicIndexingEnabled` mantém produção `index, follow` e staging/preview
  `noindex, nofollow` (metadata, `X-Robots-Tag` e robots `Disallow: /`); canonical absoluto;
  OG/Twitter; JSON-LD Organization + WebSite (`alternateName`), Product + Offer (preço exibido),
  BreadcrumbList. `OnlineStore` não é usado (Organization é suficiente; opcional).
- **Achado:** o release guard exigia `offers` atrás da flag de checkout e falhava (`release:guard`
  e PR CI). Corrigido em `02375d4` para verificar a invariante real: o único `InStock` é o
  condicionado a `checkoutEnabled` (testado contra mutações). **Revisar:** é mudança em um guard.
- Sondas públicas só leitura (2026-11-14): produção (`main` 4ea73f5) robots/sitemap 200, 95 URLs,
  canonical `https://raredept.com.br`, JSON-LD presente; staging 401 + `noindex, nofollow`.
- `/politica-de-cookies` entrou no sitemap (prioridade 0.3).
- SEARCH_CONSOLE = **MANUAL** (passos em `SEO.md`); indexação não é imediata nem prometida.
- Visual: nenhum redesign; telas novas seguem a linguagem restaurada (font-black, rounded-lg,
  tema escuro do Admin). Regressão de fixture: states 8/8, matriz 44/44 (320–1920, screenshot, overflow, axe, skip-link; a falha inicial em `cart-paused`@1024 foi timeout de carregamento com a máquina saturada e passou isolada), suíte principal 111 passed / 6 skipped. Rodada contra o Vite órfão do Qoder (mesmo worktree, serve os arquivos atuais).

## 9. Asaas

**Staging real em `f9f0cc6` (Sandbox), 2026-11-14, pelo Chrome do operador.** Código de pagamento
não mudou neste ciclo; regressão local: `qa:bf-asaas` 8/8 e `qa:checkout-concurrency` 13/13.

| Fluxo | Evidência | Resultado |
|---|---|---|
| Refund antigo (`RARE-20261113-2XSVOT`, R$ 170) | Asaas: estorno "Concluído" (13/11 17:25); RARE: "Reembolsado", 1 solicitação | PASS (autorização crítica já dada) |
| Pix novo (`RARE-20261114-NNXGEW`) | Cliente QA sintético criado no staging; R$ 25 + frete fixo QA R$ 20 − RARE10 R$ 2,50 = **R$ 42,50** no servidor e na cobrança Asaas; cliente Asaas = "Cliente QA Pre-Launch 02"; "Confirmar pagamento" (ação de Sandbox) → webhook → pedido **Pago** | PASS |
| Analytics do servidor | Mesmo pedido: 1 checkout, 1 pagamento iniciado, 1 compra confirmada, top vendidos — com analytics comportamental recusado no navegador | PASS |
| Refund Pix pelo Admin | "ESTORNAR" uma vez (13:40:13) → Asaas "Aguardando autorização crítica" → **operador autorizou** → Asaas "Concluído R$ −42,50" (1 linha) → RARE **Reembolsado** via webhook | PASS |
| Cartão (`RARE-20261114-YSTPER`, R$ 42,50) | Redireciona para a fatura hospedada Asaas; **operador** preencheu o cartão de teste e resolveu o reCAPTCHA (não contornado); fatura "Pago com cartão" → webhook → pedido **Pago** (método card); cliente vê "Pago · Cartão" | PASS |
| Retorno à RARE após o cartão | Na época, `ASAAS_SUCCESS_REDIRECT` não estava ligado. **Resolvido no §16.5** (`RARE-20261114-BYCPRK`) | PASS (§16.5) |
| Refund cartão pelo Admin | "ESTORNAR" uma vez (13:45:44) → Asaas "Concluído R$ 42,50" sem autorização crítica (1 linha) → RARE **Reembolsado** | PASS |
| Estoque | Vendas baixaram o estoque; estornos não repõem (by design); prontidão "Estoque integro" depois de tudo | PASS |

Observação de negócio: com o único pedido pago estornado, o cliente volta a ver o cupom RARE10 de
primeira compra (o código conta só pedidos pagos). Confirmar se é a regra desejada.
Não exercitados no staging nesta sessão: fora de ordem, divergência de valor, expiração e corrida de
estoque (cobertos no ciclo anterior e nos QAs locais).
Fixtures deixadas no staging: cliente QA "Cliente QA Pre-Launch 02" (e-mail `@homologacao.rare.invalid`,
senha aleatória nunca exibida), endereço sintético e os dois pedidos reembolsados.

## 10. Testes e gates

| Gate | Resultado |
|---|---|
| `npm ci` | não executado localmente (um Vite órfão do Qoder segura arquivos de `node_modules` no Windows); executado pelo PR CI |
| `prisma generate` / `tsc --noEmit` / ESLint | PASS / PASS / PASS (0 avisos) |
| Unit (vitest) | **187 arquivos, 1949 testes PASS** (baseline do ciclo: 1851) |
| QA PostgreSQL real | admin-rbac 9/9 · inventory-policy 9/9 · site-analytics 5/5 · bf-asaas 8/8 · checkout-concurrency 13/13 |
| Build de produção | PASS (40 Server Actions verificadas no standalone) |
| `release:guard` | 6 OK, 2 WARNING (cron Vercel histórico; freeze ACTIVE), **0 FAIL** após `02375d4` |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| Secret scan | guard `secrets:repository` + `secrets:diff` OK; varredura do log do lab: 0 vazamentos |
| `git diff --check` | limpo |
| PR CI | **PASS** em `4e32250` (run `43609238216`) |
| Lab Chromium (HTTPS) | MFA/Admin 8/8, pagamentos asaas + desconhecido + stripe PASS, promoções 13/13 (inclui a11y), pre-launch 13/13; log 0 vazamentos; integridade de dados 0 anomalias |

## 11. Staging e navegadores

- Deploy: web = worker = PR HEAD `4e32250`, SUCCESS; pre-deploy: `release-freeze` avisou (ambiente restrito, liberado) e aplicou as 3 migrations aditivas (21 no total, "All migrations have been successfully applied"). `/api/health` 200; páginas 401 (gate) com `x-robots-tag: noindex, nofollow`.
- Deploy anterior que falhou (2026-11-13 23:25, `62de5a4`): `failed to download build driver` — falha da plataforma, não do código.
- **Runner automatizado no staging: NÃO EXECUTADO.** `scripts/qa-staging-prelaunch.ts` (contas SYSTEM/SELLER sintéticas apagadas no fim) foi bloqueado pelo classificador de permissões desta sessão (acesso ao Postgres de staging com credenciais do Railway e cadeia TLS autoassinada do proxy). Substituído parcialmente pela verificação manual guiada abaixo.
- Navegadores no lab: Chromium PASS (acima); **Firefox** (lab completo, HTTPS): MFA/Admin 8/8, pagamentos asaas + desconhecido + stripe, promoções 13/13 e pre-launch 13/13 PASS após corrigir uma corrida do teste (o spec semeava o carrinho antes da hidratação do CartProvider; usuário real não é afetado); log 0 vazamentos. **WebKit** (HTTPS): lab completo 40 ok; no rerun dos specs pre-launch, 11 ok + o teste de 8 telas × 10 larguras + axe percorreu 7 telas sem erro de layout/axe e **estourou o tempo (15 min) na 8ª** (`/admin/products?stock=unique`) — não concluído; o teste de teclado não rodou no WebKit.

**Staging real pelo navegador do usuário (Chrome "SkyLab", sessão já autenticada no gate e no Admin) — 2026-11-14:**
- Visitante sem decisão: banner com 3 opções; catálogo → clique no card → produto: **0 requisições a `/api/analytics`**, sem cookie de visitante.
- Recusar: banner some, registro `v1.a0` persiste após reload; catálogo → clique → produto → **adicionar ao carrinho**: **0 requisições**, sem cookie de visitante nem id de sessão.
- Aceitar (painel do rodapé): cookie de visitante criado, **2 POST `/api/analytics/events` → 204**.
- `/admin/analytics/site` (hoje): **1 visitante, 1 sessão, 4 páginas, 1 produto visto, 1 clique, 0 adições ao carrinho** — a adição feita durante a recusa não foi contada. Compras/checkouts 0 (servidor).
- Retirar pelo rodapé: volta a `a0` e o cookie de visitante é apagado. `/politica-de-cookies` lista os cookies reais. Estado final do navegador: recusado, carrinho de teste limpo.
- Conta usada no Admin: **"Admin legado (acesso total)"** — vê todas as áreas, inclusive `/admin/analytics/site` (comportamento transitório esperado). Papéis SYSTEM/SELLER **não** exercitados no staging (só no lab).
- Estoque: prontidão "Estoque integro" sobre os dados reais; produto QA `UNIQUE` criado pelo Admin: 2 unidades → **recusado** com a mensagem; 1 unidade → "Peça única · Disponível", fora do "Estoque crítico", painel "Peças únicas: 1 disponível(is) … sem alerta"; 0 unidades sem venda → "Esgotada" (cinza), fora do filtro de reposição esgotada, prontidão íntegra (só o aviso de mídia, esperado). **Produto QA apagado** em seguida. "Vendida"/"Inconsistente" no staging exigiriam pedido pago real: provados só no lab.

## 12. Bloqueios MANUAIS

- Migração das contas `ADMIN` reais para SYSTEM/SELLER (RBAC.md).
- Search Console (SEO.md).
- Runner automatizado no staging (permissão), Firefox/WebKit e papéis SYSTEM/SELLER no staging real, e o teste de 8 telas no WebKit (tempo).
- Asaas: retorno automático à loja após o cartão (M-11, opcional). Cliente QA sintético a desativar no staging quando não for mais útil.
- Atualizar a descrição do PR #2 (não editada por esta sessão).

## 13. Riscos

- Papel `ADMIN` legado com acesso total até a migração manual.
- Analytics comportamental é amostra (só consentidos); conversão por sessão é aproximada.
- `availability` ausente no Offer com checkout pausado: aviso esperado no Rich Results.
- Mudança no release guard (§8) precisa de olho independente.
- Último deploy de produção (`rare`, 2026-11-13 23:25) consta FAILED no Railway por
  `failed to download build driver` (plataforma); produção segue no deploy anterior. Fora do escopo.
- No staging real só o Chrome foi usado e só com a conta ADMIN legada; Firefox/WebKit e os papéis escopados têm prova apenas no lab.

## 14. Rollback

Migrations aditivas (nada a desfazer para voltar ao código anterior: colunas/tabelas extras são
ignoradas). Rollback de staging = novo deploy do SHA anterior (não usar "rollback" do Railway, que
restaura variáveis antigas). Sem produção neste ciclo.

## 15. Evidências

- Lab: `output/lab/*.json` e `server-*.log` (fora do Git); varredura de log sem vazamento.
- Staging: `output/staging-prelaunch/*.json` (fora do Git).
- QA PostgreSQL: saídas reproduzíveis com `npm run qa:*` (bancos descartáveis).

## 16. RARE-PRE-LAUNCH-04 (Resend + Suporte + retorno Asaas + RBAC + navegadores)

Mesma regra: sessão implementadora, **não aprova produção**. Produção não foi tocada.
INDEPENDENT_REVIEW_REQUIRED = YES · PR DRAFT · MERGE READY = NO · PRODUCTION READY = NO.

### 16.1 Commits

```
743c666 test(rbac): validate system and seller roles in staging
4662719 docs(prelaunch): record the RARE-PRE-LAUNCH-04 staging evidence
50d3a01 test(prelaunch): close the Firefox and WebKit matrix on real staging
a7c6c64 feat(admin): deactivate a customer account without deleting its history
9133ef6 fix(payments): return hosted Asaas checkout to the order without trusting the redirect
36df6bc feat(support): add durable customer support requests delivered through Resend
5b0b4b0 fix(promotions): preserve first-order coupon consumption after refund
```
(+ o commit deste documento, só `docs/`.) PR CI **PASS** em `50d3a01`; staging web = worker = `50d3a01` (SUCCESS; o Railway aguardou o CI).

### 16.2 RARE10 (regra nova)

`firstOrderCouponConsumedWhere`: o cupom é consumido por qualquer pedido do cliente que **já teve
pagamento confirmado** (`paidAt`, carimbado uma vez e nunca apagado) + pedidos legados em status pago.
Reembolso total/parcial e cancelamento após pagamento **não devolvem** o cupom; pendente, expirado,
falho e cancelado antes do pagamento não consomem. Aplicado no checkout (servidor), na página de
checkout e em Minha Conta. Prova em PostgreSQL (`npm run qa:support-coupon`): novo ✔ elegível,
pendente/falho/cancelado-antes ✔ elegíveis, pago ✘, pago + reembolso solicitado (parcial) ✘,
pago + reembolsado ✘, pago + cancelado ✘, legado pago sem `paidAt` ✘.
**Staging real:** o cliente QA com 2 pedidos pagos e depois reembolsados não vê mais o RARE10 em Minha Conta (antes do fix o cupom reaparecia).

### 16.3 Auditoria Resend (antes de codar)

| Peça | Classificação | Nota |
|---|---|---|
| `src/lib/resend-email.ts` | KEEP | Idempotency-Key do message id, erros classificados, sem retry no transporte |
| `src/lib/email-config.ts` | KEEP | `APP_ENV`/modo, allowlist `EMAIL_TEST_RECIPIENTS`, `EMAIL_FROM_ORDERS`, `EMAIL_SEND_NOT_BEFORE` |
| `transactional-email.ts` | KEEP (+2 kinds) | `support_request`, `support_confirmation` |
| `email-outbox*.ts` | ADAPT | a outbox exige `orderId`; o suporte tem fila durável própria e **reusa o mesmo provider** (sem 2ª stack) |
| SMTP/ZeptoMail | KEEP | transportes alternativos |
| `renderSupportContactEmail` | UNUSED | mantido (testado), não ligado |
| `EMAIL_FROM_SUPPORT` | UNUSED | não lido pelo código |

DNS público (`raredept.com.br`, Cloudflare): MX = Zoho (mx/mx2/mx3), SPF raiz `include:zohomail.com`,
DMARC `p=none` (rua/ruf para a caixa oficial). Resend já configurado no domínio raiz:
`resend._domainkey` (DKIM) e `send.` (MX/SPF de retorno). **Recebimento intacto; MX não foi tocado.**
Painel Resend: domínio `raredept.com.br` **Verified** (status do provedor, não só registro criado).
Chave existente: 1 ("Onboarding", envio, nunca usada; token irrecuperável). Nenhuma chave criada
por esta sessão. Subdomínio `mail.` não existe e não foi necessário.

### 16.4 Suporte

- `/suporte`: Nome, E-mail, Assunto (7 categorias, allowlist no servidor), Mensagem, Produto e Pedido
  opcionais. Produto resolvido por slug no servidor; pedido só se `order.customerId` = cliente logado
  (senão `order_not_found`, nada gravado — sem IDOR). Limites 100/254/5000, CR/LF barrado, HTML
  escapado, honeypot fora do Tab, rate limit por IP (5/15 min + 2/10 s) e por e-mail (5/h), sem CAPTCHA.
- Persistência antes de qualquer e-mail (`SupportRequest`, protocolo `SUP-XXXXXXXX`,
  `submissionKey` único → duplo clique = 1 solicitação). Entrega: e-mail da equipe
  (From = remetente oficial, **Reply-To = cliente**) + confirmação ao cliente ("Recebemos sua
  solicitação — SUP-…", sem prazo prometido). Idempotency-Key por solicitação e parte.
  Falha: PENDING com backoff (≤5 tentativas) ou FAILED; worker reprocessa; `/admin/support`
  (SELLER_ADMIN; SYSTEM_ADMIN negado) mostra status e permite reenviar (auditado).
- Caixa da equipe: `SUPPORT_INBOX_EMAIL` ou, na falta, `EMAIL_REPLY_TO` (mailbox real já existente,
  na allowlist do staging) — nenhuma caixa inventada.
- Peça única vendida: "Esta peça já foi vendida." + "Falar sobre esta peça" →
  `/suporte?produto=<slug>&categoria=SOLD_OUT_PRODUCT`; sem "Avise-me". Teste de componente.
- Analytics só com consentimento: `support_page_view`, `support_form_started`, `support_form_submitted` (sem PII).
- Título segue o template do site: "Suporte | RARE" (o resto do site usa `%s | RARE`, não "RARE Dept").
- Prova PostgreSQL (`qa:support-coupon`, 8/8): persistência, idempotência, IDOR, e-mail desligado →
  PENDING, queda do provedor → PENDING e reenvio único, concorrência (2 workers) → 1 envio por parte,
  falha permanente → FAILED + retry do operador, modo teste não envia a cliente fora da allowlist.
- **Staging real (SkyLab, 2026-11-14 16:34 BRT):** formulário enviado com duplo clique → protocolo
  `SUP-568TW6S3`, **1** registro em `/admin/support`, Equipe/Cliente "Pendente" (e-mail do staging
  está `disabled`).
- **E-mail real (2026-11-14 17:30 BRT), depois que o usuário configurou o Resend no staging:** a caixa de
  suporte não estava na allowlist de teste → a equipe de `SUP-568TW6S3` falhou com
  `EmailRecipientNotAllowlisted` (trava correta do modo `test`). Com autorização do usuário a caixa foi
  incluída em `EMAIL_TEST_RECIPIENTS` (web e worker, valor nunca exibido). Novo envio `SUP-FKS4EKTJ`:
  Resend **Delivered** para os dois; equipe com From `RARE <contato@raredept.com.br>`, **Reply-To = cliente**,
  tag `support_request`, assunto `[RARE Suporte] SUP-FKS4EKTJ — Pedido`, corpo com protocolo, categoria,
  nome, e-mail, data e mensagem; confirmação "Recebemos sua solicitação — SUP-FKS4EKTJ". O usuário
  confirmou o recebimento nas duas caixas. Reenvio de `SUP-568TW6S3` pelo `/admin/support` (SELLER):
  equipe ENVIADO; confirmação segue FALHOU porque o cliente QA (`.invalid`) não está na allowlist (correto).

### 16.5 Retorno do Asaas

Código pronto desde CYCLE-03: `callback.successUrl = /minha-conta/pedidos/<id>`, `autoRedirect: true`
quando `ASAAS_SUCCESS_REDIRECT=true`. A página é só leitura, escopada ao cliente, e agora avisa que a
confirmação pode levar instantes (só webhook/reconciliação marca pago).

O Asaas exige o domínio do `successUrl` no campo "Site" da conta, e salvar esse campo pede dados do
titular ("produto que vende", "regime tributário", "faturamento mensal"). Esta sessão não inventou
esses dados: **o usuário preencheu e salvou a conta Sandbox**. Depois disso, a sessão conferiu Site =
`https://rare-staging-staging.up.railway.app` e cadastro "Aprovado", e ligou
`ASAAS_SUCCESS_REDIRECT=true` **só no `rare-staging`** (`ASAAS_ENV=sandbox`). O redeploy terminou com
SUCCESS em `743c666`.

**Staging real (SkyLab, 2026-11-14 ~18:00 BRT), `RARE-20261114-BYCPRK`:**
- **Pedido:** cliente QA sintético novo "Cliente QA Pre-Launch 04" (e-mail `.invalid`, senha aleatória
  nunca exibida), endereço sintético, cartão. Total: R$ 25 + frete fixo R$ 20 − RARE10 R$ 2,50 = **R$ 42,50**.
- **Estoque do produto sintético:** antes 94 disponíveis / 0 reservados / 4 vendidos; com a fatura
  aberta 93 / **1** / 4.
- **Pagamento:** o **usuário** preencheu o cartão de teste e resolveu o reCAPTCHA, sem contorno.
- **Retorno automático:** a aba saiu de `sandbox.asaas.com` (referrer) direto para
  `/minha-conta/pedidos/<id>` do próprio cliente: "Pago · Cartão", R$ 42,50.
- **Ordem nos logs HTTP do `rare-staging`:** `POST /api/asaas/webhook` 200 às 21:01:20.57Z, **antes** do
  `GET /minha-conta/pedidos/<id>` 200 às 21:01:23.09Z. A página de retorno não grava nada (só leitura),
  então o "Pago" veio do webhook, não do redirect.
- **E-mail:** o worker tentou o `payment_approved` (21:01:28Z) e recusou com
  `EmailRecipientNotAllowlisted`, porque o cliente `.invalid` não está na allowlist do modo `test`
  (correto).
- **Estoque depois:** 93 / **0** / **5**; a reserva foi consumida pela venda.

Não exercitado no staging: o aviso "a confirmação pode levar alguns instantes" (`awaiting_payment`),
porque o webhook chegou antes do retorno. O aviso tem cobertura de teste unitário.
Fixtures: cliente "Cliente QA Pre-Launch 04", o endereço sintético e o pedido pago (não estornado),
mantidos como evidência.

### 16.6 RBAC

- Staging: **16 contas `ADMIN` legadas** ativas + **1 SYSTEM_ADMIN** + **1 SELLER_ADMIN** (contas QA criadas
  e com MFA cadastrado pelo usuário). As legadas precisam de papel (ou desativação) antes da produção.
- **RBAC real no staging (SkyLab, sessões reais com MFA, 2026-11-14):**

| Papel | UI / menu | URL direta | API | Server Action do outro papel |
|---|---|---|---|---|
| SELLER_ADMIN ("Administrador Vendedor") | só áreas comerciais + Analytics do site + Suporte | Usuários, Segurança, Prontidão, Configurações → Sem acesso; 9 páginas comerciais abrem | — (não há API só de sistema) | "Encerrar sessões" (ação de Usuários) contra a própria conta → **Sem acesso**, sessão continua viva |
| SYSTEM_ADMIN ("Administrador de Sistema") | só Usuários, Prontidão, Configurações, Segurança, Analytics do site, Conta; `/admin` → Usuários | Pedidos, Produtos, Promoções, Categorias, Clientes, Suporte, Analytics → Sem acesso | editor de imagens, upload e presign → redirect "Sem acesso", nenhum JSON | criar categoria, ocultar produto, reenviar suporte → **Sem acesso**; categoria de teste inexistente depois |

  Todas as tentativas de Server Action usaram IDs válidos do build em uso (sem `x-nextjs-action-not-found`).
  Uma tentativa anterior com ID de um build antigo respondeu 409 "action not found" e foi descartada como prova.
  As APIs negadas respondem redirect para "Sem acesso" em vez de 401/403 (já documentado; recusam e não expõem dados).
- Spec novo `tests/e2e/staging-rbac.spec.ts` (opt-in `STAGING_RBAC=1`, sem acesso ao banco): MFA real
  pela UI, menu, URL direta, API de mídia e **replay de Server Action** do outro papel (categoria
  criada por SYSTEM → recusada e inexistente; revogar sessões pelo SELLER → recusado e sessão viva).
  Não usado: as contas QA já estavam com MFA cadastrado; a prova acima foi feita pelo navegador.

### 16.7 Navegadores no staging real

Specs públicos contra o staging (gate via `railway run`, credenciais nunca impressas), produto real
`hml-camiseta-leve`: a11y (Axe por rota, inclusive `/suporte`), console, teclado, links, smoke de
release, resiliência e `/suporte` (320–1920 px, Axe, teclado, validação nativa sem POST).
**Firefox + WebKit: 91 passed, 9 skipped (cenários só de mobile/Chromium e skip link no WebKit), 0 failed.**
Causas raiz das falhas da 1ª rodada (nenhum timeout aumentado): produto fixo inexistente no staging;
Firefox recebe o 401 do gate em cada conexão nova (agora a credencial vai preemptiva, como o lab já
fazia no WebKit); o teste do skip link supunha banner de cookies já respondido; WebKit não percorre
links com Tab por padrão. Admin responsivo/teclado no staging real: **não executado** (depende das contas QA do §16.6).

### 16.8 Limpeza

Nova ação "Desativar conta" no detalhe do cliente (encerra sessões, mantém pedidos/pagamentos/suporte,
auditada). Cliente QA Pre-Launch 02: **desativado** no staging em 2026-11-14 (status Inativo, 2 pedidos reembolsados preservados, sessão encerrada → `/entrar`). Nada apagado. Solicitação de suporte `SUP-568TW6S3` mantida como evidência.

### 16.9 Gates

tsc 0 · ESLint 0 · Vitest 188 arquivos / 1977 testes · `qa:support-coupon` 8/8 (PostgreSQL) · `prisma validate` OK · migration sem drift · release guard 6 OK / 2 WARNING (cron Vercel legado; freeze de produção ativo) / 0 FAIL · `npm audit --omit=dev` 0 · varredura de segredos no diff do ciclo: limpa.

### 16.10 MANUAL (pendente do usuário)

| # | Ação | Desbloqueia |
|---|---|---|
| 1 | ~~Resend no staging~~ **FEITO** pelo usuário; allowlist completada nesta sessão. Em produção: chave própria, `EMAIL_DELIVERY_MODE` de produção e caixa `@raredept.com.br` | — |
| 2 | ~~Asaas Sandbox: Site + dados do titular~~ **FEITO** pelo usuário; `ASAAS_SUCCESS_REDIRECT=true` ligado no `rare-staging`; retorno provado (§16.5). Em produção: Site `https://raredept.com.br` na conta Asaas de produção antes de ligar a flag lá | — |
| 3 | ~~Contas QA SYSTEM/SELLER~~ **FEITO**; RBAC real provado. Admin responsivo em Firefox/WebKit no staging real segue só no lab | — |
| 4 | Atribuir papel às 16 contas `ADMIN` legadas do staging (ou desativar as QA antigas); idem em produção antes do go-live | fim do acesso total legado |

### 16.11 Veredito desta sessão

STAGING = **PASS** (escopo do RARE-PRE-LAUNCH-04). Provados no staging real:
- suporte persistente e e-mail real pelo Resend;
- RARE10;
- RBAC real (UI, URL, API e Server Action);
- matriz Firefox/WebKit dos specs públicos;
- **retorno automático do Asaas, com "Pago" só via webhook e estoque coerente**;
- CI/SHA.

Ressalva para o revisor: o Admin responsivo/teclado em Firefox/WebKit tem prova só no lab, não no
staging real. MERGE READY = NO · PRODUCTION READY = NO · revisão independente obrigatória.
INDEPENDENT_CLAUDE_REVIEW ainda não deu GO, então o clean slate de produção segue bloqueado.

## 17. RARE-PRE-LAUNCH-06 — NO-GO REMEDIATION (auditoria independente de `a91a05a`)

Escopo: só os achados da auditoria — HIGH-1 (freeze/M-20), MEDIUM-1 (runbook Clean Slate),
MEDIUM-2 (Admin WebKit), LOW (release-smoke). Nada de merge, Clean Slate real ou abertura de
checkout. **INDEPENDENT_REAUDIT_REQUIRED = YES. Esta sessão não emite GO.**

### 17.1 Commits (a partir de `a91a05a`)

```
(este commit) fix(security): clear the release freeze after real staging passed
0327296 test(admin): run the Admin responsive and keyboard matrix on real staging
0f4cf6d fix(security): record verified production containment for the release freeze
a0e3d1a docs(release): add a rehearsed production clean-slate runbook
985dd30 test(admin): complete the WebKit responsive and keyboard matrix
5587309 test(seo): align paused-checkout smoke with the availability contract
```

### 17.2 HIGH-1 — freeze e M-20

- **Vercel (somente leitura, painel/API autenticados do dono):** a conta tem só o time "RARE DEPT",
  com **0 projetos e 0 deployments**; o projeto `rare` de `.vercel/repo.json` não existe mais.
  VERCEL_CRON_ACTIVE = NO; nenhuma ação na Vercel.
- **Callers:** Railway `rare-cron` (worker persistente, sem `cronSchedule`) é o owner primário; nenhum
  serviço Railway com agenda; GitHub Actions sem `schedule`; `cron:release-expired` só manual.
  HTTP cron caller = NONE.
- **Incidente novo e contenção:** no inventário, o detalhe de um lote de variáveis do painel Activity
  do Railway exibiu valores do lote de 2026-11-13 19:16 (cron, sessão, chave MFA, parte da Stripe LIVE
  antiga). O web de produção ainda rodava esse lote porque o deploy das 23:25 havia falhado. Com
  autorização explícita do dono, o web foi redeployado do mesmo `main@4ea73f5` sem mudar variáveis
  (deployment 02:41 UTC SUCCESS; 19:16 REMOVED). Runtime: health ok, checkout 503, cron sem credencial 401.
- **Cron de produção sem chamada mutável:** rotação registrada, runtime posterior à última troca,
  `CRON_SECRET_PREVIOUS` ausente, código de produção só aceita o corrente, nenhum caller.
- **`RELEASE_SECURITY_FREEZE` em produção:** ausente (`rare` e `rare-cron`).
- **Registro:** todas as 11 condições `true`; `stagingRealPassed` só depois do Admin WebKit no staging
  real (§17.4). `state = CLEARED` em 2026-11-15, `clearedBy` = "Pedro Spoto — Responsável técnico pelo
  projeto RARE" (texto dado pelo responsável). `legacyStripeCredentialStatus = MANUAL_PENDING`.
- **Gate de produção** (ambiente sanitizado, sem segredo real): CLEARED + `PAYMENT_PROVIDER=disabled` →
  exit 0; `STRIPE_SECRET_KEY`, `CRON_SECRET_PREVIOUS`, provider `stripe`/ausente ou
  `RELEASE_SECURITY_FREEZE=ACTIVE` → exit 1. Guard não alterado; testes 47/47.
- **M-20:** contenção interna RELEASE-BLOCKING = CLOSED; revogação externa Stripe = MANUAL_PENDING.
- Evidência: [`docs/security/evidence/RELEASE_FREEZE_CLOSURE_20261114.md`](../../security/evidence/RELEASE_FREEZE_CLOSURE_20261114.md);
  incidente e fechamento atualizados sem apagar histórico.
- Recomendação ao dono: nova troca controlada de `CRON_SECRET`/`ADMIN_SESSION_SECRET` com deploy
  confirmado antes do go-live; não abrir detalhes de lotes de variáveis do Railway em sessões de agente.

### 17.3 MEDIUM-1 — Clean Slate

- Runbook executável: [`docs/runbooks/PRODUCTION_CLEAN_SLATE.md`](../../runbooks/PRODUCTION_CLEAN_SLATE.md)
  (pré-condições, ordem dos Admins, grafo real, reversão de estoque pelo ledger, SQL com guards,
  verificação, B1/B2, rollback).
- Ensaio: [`PRODUCTION_CLEAN_SLATE_REHEARSAL.md`](PRODUCTION_CLEAN_SLATE_REHEARSAL.md) sobre o backup
  real de produção de 2026-09-19 (sha256 conferido; o de 2026-11-13 não está nesta máquina), restore
  descartável, migrations do candidato sem drift, Admins pela UI real (SYSTEM via `admin:create` →
  MFA → troca de senha; SELLER criado pelo SYSTEM; legados desativados por último), guards
  fail-closed, reset, integridade 0, suporte/auditoria preservados, rollback por restore com
  contagens idênticas.
- Código: `admin:create` cria a conta de bootstrap com `mustChangePassword=true`.

### 17.4 MEDIUM-2 — Admin WebKit

- Diagnóstico (lab, WebKit/Windows): páginas carregam em ~1,5 s, mas cada chamada do driver custava
  ~2,5 s e crescia ao longo da execução; o teste único de 80 navegações passava de 15 min. Aba nova por
  tela não resolveu sozinha (medido). No staging real o mesmo WebKit roda cada tela em ~6–7 s: a
  lentidão é do ambiente do lab.
- Harness: um teste por tela, checagem de h1/overflow e log de foco dentro da página; mesmas 8 telas ×
  10 larguras + axe; nenhum timeout aumentado.
- Lab WebKit 20/20 (teclado incluído; Tab do WebKit pula links e alcança botões/campos/selects, que são
  os controles exigidos). Lab Firefox 20/20; lab Chromium 20/20.
- **Staging real:** WebKit 15/15 e Firefox 15/15 — RBAC dos dois papéis, 10 telas × 10 larguras + axe,
  teclado nos dois papéis; contas QA novas por browser, desativadas depois; 0 vazamento.

### 17.5 LOW — release smoke

Checkout OFF não exige ausência de Offer: o validador `productOfferContractIssue`
(`src/lib/product-offer-contract.ts`) reprova `InStock` com checkout pausado (qualquer grafia) e
aceita Offer com preço; testes cobrem OFF, ON com estoque (InStock permitido) e peça vendida
(OutOfStock). O guard estático do produtor continua valendo.

### 17.6 Gates, CI e staging

tsc 0 · ESLint 0 · Vitest **188 arquivos / 1981 testes** · `prisma validate` OK · build OK ·
release guard **7 OK / 1 WARNING** (`vercel.json` ainda descreve o cron legado; o projeto Vercel não
existe mais) **/ 0 FAIL**, com `secrets:repository` e `secrets:diff` OK · `npm audit --omit=dev` 0 ·
`qa:support-coupon` 8/8 (PostgreSQL). Lab: WebKit 20/20, Firefox 20/20, Chromium 20/20 (0 vazamento,
0 anomalia). CI e SHA de web/worker do staging do HEAD final: no relatório final e no PR (um documento
não registra o CI do próprio commit).

### 17.7 Veredito desta sessão

Todos os achados da auditoria tratados. MERGE READY = NO · PRODUCTION READY = NO · PR DRAFT ·
INDEPENDENT_REAUDIT_REQUIRED = YES. Próximo: RARE-INDEPENDENT-PREPROD-REAUDIT-02, cobrindo ao menos
`a91a05a..NEW_SHA`, `scripts/release-freeze.mjs`, `RELEASE_FREEZE.json`, a evidência M-20, o estado
Vercel, o ensaio do Clean Slate, o Admin WebKit, o release smoke e CI/staging SHA.
