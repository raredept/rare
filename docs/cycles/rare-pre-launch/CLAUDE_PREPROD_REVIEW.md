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
| Retorno à RARE após o cartão | `ASAAS_SUCCESS_REDIRECT` não ligado no staging (M-11, opcional, exige domínio cadastrado no Asaas); a fatura não redireciona; o cliente volta à loja e vê o pedido pago | MANUAL (M-11) |
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
confirmação pode levar instantes (só webhook/reconciliação marca pago). **Staging: não ligado.** O
Asaas exige o domínio do `successUrl` no campo "Site" da conta; ao tentar salvar só esse campo, o
Asaas exigiu "produto que vende", "regime tributário" e "faturamento mensal" (dados do titular, não
inventados) e avisa que alterar dados comerciais pode reabrir análise e apagar chaves Pix. Edição
descartada; nada salvo. → MANUAL.

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
| 2 | Asaas Sandbox → Minha Conta → Informações: preencher os dados exigidos e o Site `https://rare-staging-staging.up.railway.app`; depois `ASAAS_SUCCESS_REDIRECT=true` no `rare-staging` | retorno automático após o cartão |
| 3 | ~~Contas QA SYSTEM/SELLER~~ **FEITO**; RBAC real provado. Admin responsivo em Firefox/WebKit no staging real segue só no lab | — |
| 4 | Atribuir papel às 16 contas `ADMIN` legadas do staging (ou desativar as QA antigas); idem em produção antes do go-live | fim do acesso total legado |

### 16.11 Veredito desta sessão

STAGING = **PARTIAL**: suporte persistente, e-mail real pelo Resend, RARE10, RBAC real (UI, URL, API e Server Action), matriz Firefox/WebKit e CI/SHA provados. Falta o **retorno automático do Asaas** (§16.10 item 2). O Admin responsivo em Firefox/WebKit no staging real também não foi rodado. MERGE READY = NO · PRODUCTION READY = NO · revisão independente obrigatória.
