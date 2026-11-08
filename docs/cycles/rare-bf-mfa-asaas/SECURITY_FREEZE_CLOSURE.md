# Security freeze — fechamento do incidente de credenciais (M-20) e gate do banco de staging (M-21)

**Estado em 2026-11-08 (CYCLE-07):** `RELEASE_SECURITY_FREEZE = ACTIVE` · **M-20 = OPEN (BLOCKED_EXTERNAL; produção: PRODUCTION ROTATION READY — HUMAN AUTHORIZATION REQUIRED)** · **M-21 = OPEN**.

Nenhum valor de credencial aparece neste documento, nem prefixo, sufixo, fingerprint ou hash. Só estados: PRESENT / ABSENT / ROTATED / REVOKED / REJECTED / ACCEPTED / VALIDATED / BLOCKED_EXTERNAL.

Fontes (histórico preservado): [`CREDENTIAL_INCIDENT_202610.md`](../../security/CREDENTIAL_INCIDENT_202610.md), [`CREDENTIAL_ROTATION_APPROVAL.md`](../../security/CREDENTIAL_ROTATION_APPROVAL.md), [`STAGING_DATABASE_GATE.md`](../../security/STAGING_DATABASE_GATE.md), [`RAILWAY_BACKUP_SUPPORT_HANDOFF.md`](../../security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md). Execução deste ciclo: [`cycles/CYCLE-06-SECURITY-STAGING.md`](cycles/CYCLE-06-SECURITY-STAGING.md).

## 1. O incidente, sem valores

- **Quando e como:** 2026-10-04. Um helper de PowerShell chamado `Compare` colidiu com o alias `Compare-Object` e imprimiu valores de credenciais na saída de ferramenta/conversa de um agente. Foi um erro de diagnóstico, não uma vulnerabilidade da aplicação.
- **Ambientes afetados: staging E produção.** O M-20 foi registrado no CYCLE-05 como "de staging"; a fonte diz explicitamente que as mesmas quatro categorias de **produção** (inclusive a chave Stripe **LIVE**) também foram expostas. A contenção de produção é urgente e independe deste PR.
- **Uso indevido:** nem provado nem excluído.
- **Rotação:** nenhuma. A Phase S (staging) abortou em 2026-10-06 antes de qualquer mutação; a Phase P (produção) nunca foi autorizada.
- **Onde houve exposição:**
  - a conversa/saída de ferramenta original;
  - cópias locais da chave Stripe TEST (seção 3);
  - histórico do PowerShell com URLs de banco antigas, de validade desconhecida.

  O Git não teve exposição confirmada (seção 3).

## 2. Matriz de contenção (atualizada em 2026-11-08, CYCLE-07)

Ordem por risco real: P0–P3 em produção (dinheiro real, todos os clientes) antes de P4–P7 em staging. Nenhuma linha avançou: **nenhuma substituta foi criada, nenhum consumidor foi atualizado, nenhuma antiga foi revogada.** O acesso a Railway, Stripe e Vercel está bloqueado nesta máquina, e produção exige autorização humana explícita.

| # | Ambiente | Credencial | Provedor / consumidores | Comprometida | Substituta criada | Consumidores atualizados | Antiga revogada | Antiga rejeitada | Nova validada | Dono | Evidência |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | produção | Stripe API key (**LIVE**) | Stripe live → `rare` (web) e `rare-cron` (`checkout:worker` / expiração) | SIM | NÃO | NÃO | NÃO | UNKNOWN (sem cópia local, não sondada) | NÃO | dono da conta Stripe + operador Railway | incidente §Affected credential matrix |
| P1 | produção | Stripe webhook signing secret | Stripe live → `rare` `/api/stripe/webhook` | SIM | NÃO | NÃO | NÃO | UNKNOWN | NÃO | dono Stripe + operador | idem |
| P2 | produção | `ADMIN_SESSION_SECRET` (`AUTH_SECRET` ABSENT) | app → `rare` web + proxy; Admin (8 h) e cliente (30 d) | SIM | NÃO | NÃO | NÃO | UNKNOWN | NÃO | operador | idem |
| P3 | produção | `CRON_SECRET` | app → validador em `rare`; PRESENT e não usado em `rare-cron`; cron da Vercel (GET 03:00) **UNKNOWN**; script `cron:release-expired` | SIM | NÃO | NÃO | NÃO | UNKNOWN | NÃO | operador + dono da Vercel | idem; seção 2.2 |
| P4 | staging | Stripe API key (TEST) | Stripe test → `rare-staging` (web) e `rare-checkout-worker-staging` | SIM | NÃO | NÃO | NÃO | **NÃO — ainda ACEITA** (HTTP 200 em 2026-11-07T14:50Z e 2026-11-08T16:10Z) | NÃO | dono Stripe + operador | [evidência](../../security/evidence/CREDENTIAL_INCIDENT_202610_CLOSURE.md) |
| P5 | staging | Stripe webhook signing secret | Stripe test → `rare-staging` `/api/stripe/webhook` | SIM | NÃO | NÃO | NÃO | UNKNOWN | NÃO | dono Stripe + operador | incidente |
| P6 | staging | `ADMIN_SESSION_SECRET` (`AUTH_SECRET` ABSENT) | app → `rare-staging` web + proxy | SIM | NÃO | NÃO | NÃO | UNKNOWN | NÃO | operador | incidente |
| P7 | staging | `CRON_SECRET` | app → validador em `rare-staging`; worker não usa; nenhum chamador HTTP conhecido (o gate Basic bloqueia qualquer um) | SIM | NÃO | NÃO | NÃO | UNKNOWN | NÃO | operador | incidente; seção 5.4 |

Não há motivo documentado para mudar essa ordem. A única exceção prática: P4 (Stripe TEST) é a **única antiga com prova positiva de que ainda funciona**. Pode ser feita junto com P0, no mesmo acesso à Stripe, sem esperar P1–P3.

### 2.1 Consumidores no código (verificado nesta branch)

| Segredo | Lido por | Processos |
|---|---|---|
| `STRIPE_SECRET_KEY` | `src/lib/env.ts` → cliente Stripe em cache por processo (`src/lib/stripe.ts`), checkout, expiração (`src/lib/checkout-expiry.ts`), modo do webhook, readiness, config-drift | web **e** worker (`npm run checkout:worker`); scripts de QA usam valores falsos |
| `STRIPE_WEBHOOK_SECRET` | `src/lib/env.ts` → `/api/stripe/webhook` (um único segredo, `constructEvent` sobre o corpo cru) | web |
| `ADMIN_SESSION_SECRET` / `AUTH_SECRET` (fallback) | `src/lib/auth.ts`, `src/lib/customer-auth.ts`, `src/proxy.ts`; `admin-mfa-config.ts` só para garantir que a chave do MFA é diferente | web (inclusive o proxy) |
| `CRON_SECRET` (+ `CRON_SECRET_PREVIOUS` opcional) | `/api/cron/release-expired-inventory` (**GET e POST**); chamador `scripts/call-release-expired-cron.mjs` (`npm run cron:release-expired`, POST) | validador no web; chamadores na seção 2.2 |

### 2.2 Chamadores de cron (P3 / P7)

| Chamador | Estado |
|---|---|
| `rare-cron` (Railway, produção) | Roda `checkout:worker` sem agenda (`railway.cron.json`); tem `CRON_SECRET` mas não o usa (incidente, 2026-10-06) |
| Vercel cron (`vercel.json`: GET `/api/cron/release-expired-inventory` às 03:00) | **UNKNOWN.** O repositório está vinculado ao projeto Vercel `rare` (`.vercel/repo.json`), mas nenhum navegador desta máquina tem sessão na Vercel. Se o projeto estiver ativo com `CRON_SECRET` e acesso ao banco de produção, ele é um chamador real. O dono precisa conferir antes de P3. |
| `npm run cron:release-expired` (manual) | Existe; uso real UNKNOWN |
| GitHub Actions | Nenhum (0 workflows de cron, 0 secrets) |
| Agendadores externos | UNKNOWN |

### 2.3 Revisão de atividade na Stripe

**BLOCKED_EXTERNAL.** Nenhum dos 4 navegadores conectados tem sessão na Stripe, então Workbench, request logs e eventos não foram lidos.
- Única atividade observada: as duas sondas desta investigação (`GET /v1/balance`, modo teste, 2026-11-07T14:50Z e 2026-11-08T16:10Z), reconhecidas.
- Classificação: **NOT REVIEWED** — nem "NO UNRECOGNIZED ACTIVITY FOUND", nem o contrário. O dono precisa revisar os logs das chaves LIVE e TEST desde 2026-10-04: IPs, endpoints e horários inesperados, criação de pagamento, reembolso, mutação de cliente ou de endpoint de webhook, dados bancários e payouts. Se houver algo, **INCIDENT ESCALATION REQUIRED**.

## 3. Varreduras (2026-11-07)

A única credencial comprometida disponível localmente é a chave Stripe TEST, a mesma do staging segundo o incidente. A varredura carregou essa chave **em memória** a partir do `.env` raiz, sem imprimir, gravar ou derivar nada dela, e reportou só FOUND / NOT FOUND com caminhos.

| Superfície | Resultado |
|---|---|
| Git — todos os refs + reflog do repositório compartilhado (2 173 blobs) | **NOT FOUND** |
| Worktrees `melhor-envio…`, `operational-evidence…`, `rare-audit-hardening…`, `rare-bf-mfa-asaas-01`, `rare-bf-mfa-asaas-pr…`, `rare-security-audit…` | **NOT FOUND** |
| Checkout principal `E:\rare` (45 104 arquivos, sem `node_modules`) | FOUND só nos armazenamentos já registrados: `.env` (configuração local) e `output/{final-review-clean-artifacts-20261003, final-review-next-backup-20261003, integration-clean-artifacts-20261003, next-pre-reconcile}/standalone/.env` |
| `.next/standalone/.env` citado no incidente | **ABSENT** (não existe mais) |
| Histórico de shell (PSReadLine, bash) | NOT FOUND para esta chave. As URLs de banco antigas já registradas no incidente seguem para triagem privada do dono. |
| Transcripts do Claude Code (88) e saídas temporárias de ferramenta (1 133) | NOT FOUND |
| Padrões no histórico Git (chaves live, `whsec_`, Asaas, chave privada, URL de banco com senha, AWS, GitHub, Resend) | só literais sintéticos em testes (`db.example`, chaves falsas de fixture, Asaas falsas de antes de `c7ddf73`). A RARE nem tem conta Asaas. |
| GitHub Actions | 0 secrets de repositório, 0 de ambiente, 0 de organização; o workflow `PR CI` não usa nenhum |
| Build/bundle do navegador | `release:guard` verifica `.next/static`: 0 achados |

Limites:
- webhook, sessão, cron e as credenciais de produção não têm valor disponível localmente, então foram cobertos só por padrão, não por valor;
- objetos Git inalcançáveis, clones de terceiros e o registro original da conversa ficam fora do escopo.

## 4. O freeze agora é código

Até aqui `RELEASE_SECURITY_FREEZE=ACTIVE` era só texto: nada impedia um deploy de produção. Agora:

- **Registro único:** [`docs/security/RELEASE_FREEZE.json`](../../security/RELEASE_FREEZE.json), versionado com `state: "ACTIVE"`.
- **`scripts/release-freeze.mjs`** decide pelo registro:
  - Só o valor exato `CLEARED`, com `closure.clearedAt` (data ISO), `closure.clearedBy` e `closure.evidence` (arquivo existente no repositório), libera.
  - Registro ausente ou ilegível, estado desconhecido, `false`, `0`, `off`, `disabled` ou `cleared` em minúsculas: o freeze continua **ACTIVE**.
  - A variável de ambiente `RELEASE_SECURITY_FREEZE` só pode **ativar** o freeze; nunca libera.
  - Alvo: qualquer sinal de produção ou desconhecido em `--target`, `RELEASE_TARGET`, `APP_ENV` ou `RAILWAY_ENVIRONMENT_NAME` conta como produção.
  - Com o freeze ativo, produção **falha fechado** (exit 1); staging e desenvolvimento só avisam, para que a rotação no staging possa acontecer.
- **Onde roda:**
  - pre-deploy do Railway no web (`railway.json`, antes do `migrate deploy`) e no worker (`railway.cron.json`);
  - `npm run release:guard`: FAIL com `RELEASE_TARGET=production`, WARNING no CI do PR.
- **Testes:** `src/lib/release-freeze.test.ts` (34 casos), cobrindo bypass por valores equivalentes, registro malformado, evidência faltando, alvo ambíguo e a CLI.
- **Limite:** não verificado no Railway (sem acesso). Se a imagem não tiver `scripts/` ou `docs/`, o pre-deploy falha fechado — inclusive no staging — e precisa de ajuste antes do deploy.

**Como liberar** (só depois da seção 7):
1. Editar o registro com `state: "CLEARED"` e `closure` completo, apontando para este documento atualizado com a evidência sanitizada.
2. Commit revisado.
3. O histórico do incidente nunca é apagado.

## 5. Roteiro do operador — Phase S (staging)

Pré-requisitos (M-01): conta com acesso ao projeto Railway **Rare** (`72ed12be-9a2a-4e13-8594-30ffd8ffa565`), ambiente **staging** (`d8399691-dacf-41e9-a9d5-060c97672e39`), serviços `rare-staging` (web) e `rare-checkout-worker-staging` (worker), e acesso ao modo **teste** da conta Stripe do staging. Nunca usar o workspace da DuraPets.

Regras:
- Valores só no Dashboard do Railway/Stripe ou via variável de ambiente; nunca como argumento de linha de comando, em arquivo versionado ou em relatório.
- Rollback nunca restaura valor comprometido: se algo falhar, gere outro valor novo.

### 5.1 Preparação (somente leitura)

1. `railway link` no projeto/ambiente acima; confirmar os IDs dos serviços e anotar os IDs das deployments atuais (referência de rollback de **imagem**, não de variáveis).
2. Histórico do banco (seção 6): rodar `npm run db:history-audit -- --expect=staging` a partir desta branch. Esperado com o staging ainda em `4ea73f5`: 14 APPLIED, 4 PENDING, `clean: true`.
   - Assim, o `migrate deploy` do redeploy do código atual (`4ea73f5`) é um no-op — o bloqueio que abortou a Phase S em 2026-10-06 foi resolvido pela auditoria de 2026-10-07.
   - Se não sair limpo: **parar**.
3. Antes da troca, abrir uma sessão de Admin e uma de cliente no staging, em perfis de navegador separados, e não fechá-las — elas servem de "cookie antigo" para a prova 5.4.

### 5.2 Gerar valores novos sem exibi-los

```bash
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" | clip
```

Cole direto no campo da variável no Dashboard do Railway (um valor por variável, gerado na hora). Nunca reutilize o mesmo valor em duas variáveis; `ADMIN_MFA_ENCRYPTION_KEY` (quando este PR for publicado) é outra chave, diferente de todas.

### 5.3 Trocar, em uma única ativação

1. **Webhook Stripe (test):** Dashboard → Developers → Webhooks → endpoint `https://rare-staging-staging.up.railway.app/api/stripe/webhook` → **Roll secret**, expiração imediata.
   - Conferir antes que não há entregas pendentes que importem: o staging não tem venda real.
   - Novo valor em `STRIPE_WEBHOOK_SECRET` do **web**.
2. **Chave Stripe TEST:** Dashboard (test) → Developers → API keys → **Roll key** da chave secreta, expiração imediata. Novo valor em `STRIPE_SECRET_KEY` do **web e do worker**.
3. **Sessão:** novo `ADMIN_SESSION_SECRET` no web. `AUTH_SECRET` continua ausente.
4. **Cron:** novo `CRON_SECRET` no web; `CRON_SECRET_PREVIOUS` continua ausente.
5. **Redeploy do web e do worker** (não "restart": restart reaproveita a deployment e não prova que as variáveis novas foram carregadas).
6. `/api/health` → 200.

### 5.4 Provas (NEW WORKS / OLD FAILS)

`scripts/rotation-probe.mjs` lê o segredo de uma variável de ambiente, recusa chave LIVE e hosts de produção, e imprime só status. Com `railway run`, o valor vem do próprio serviço e não passa pelo terminal:

```bash
railway run -s rare-staging -- sh -c 'PROBE_STRIPE_KEY="$STRIPE_SECRET_KEY" node scripts/rotation-probe.mjs stripe-key --expect=accepted'
```

```bash
railway run -s rare-staging -- sh -c 'PROBE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" node scripts/rotation-probe.mjs stripe-webhook --url=https://rare-staging-staging.up.railway.app/api/stripe/webhook --expect=accepted'
```

Para os valores **antigos**, exporte-os do cofre do dono para `PROBE_STRIPE_KEY` / `PROBE_WEBHOOK_SECRET` (o Stripe TEST antigo ainda está no `.env` local até a seção 5.5) e rode os mesmos comandos com `--expect=rejected`.

| Prova | Esperado |
|---|---|
| Stripe TEST nova | `stripe-key` ACCEPTED (PASS) |
| Stripe TEST antiga | `stripe-key` REJECTED (PASS) — hoje dá **FAIL**: a chave antiga ainda é aceita |
| Webhook novo | `stripe-webhook` ACCEPTED, e "Send test webhook" do Dashboard entregue com 200 |
| Webhook antigo | `stripe-webhook` REJECTED (HTTP 400) |
| Sessão antiga | recarregar as sessões abertas em 5.1 → voltam ao login (Admin e cliente) |
| Sessão nova | login novo de Admin e de cliente funciona. No código atual o Admin é só senha; depois do deploy deste PR, MFA obrigatório. |
| MFA depois da troca | trocar o segredo de sessão **não** remove MFA: o TOTP é cifrado com `ADMIN_MFA_ENCRYPTION_KEY` e os códigos de recuperação são hashes independentes. Só as sessões caem. |
| Cron | **Não dá para provar por HTTP no staging.** O gate Basic do staging usa o mesmo header `Authorization` do Bearer do cron e responde 401 antes da rota — a sonda reporta `BLOCKED_BY_STAGING_GATE`. Evidência possível: variável trocada (data de atualização no Railway), `CRON_SECRET_PREVIOUS` ausente e os testes do validador. Não isentar a rota do gate para provar: isso abriria um segredo comprometido à internet. |

### 5.5 Cópias locais

Depois que a chave TEST antiga estiver REJECTED:
- substituir (ou remover) `STRIPE_SECRET_KEY` no `.env` local do dono;
- apagar as 4 cópias `output/*/standalone/.env` (são saídas de build descartáveis);
- triagem privada do histórico do PowerShell.

Nada disso foi alterado neste ciclo: são arquivos do dono, e a revogação vem primeiro.

## 6. M-21 — banco de staging

| Item | Estado |
|---|---|
| Identidade | Postgres-MlyZ (ServiceID `ed0a374e-79da-4aab-9e3a-bb684fb829d1`) no ambiente staging, distinto de produção — **verificada em 2026-10-07** pela auditoria SSH somente leitura ([STAGING_DATABASE_GATE](../../security/STAGING_DATABASE_GATE.md)) |
| Histórico de migrations | **VERIFICADO em 2026-10-07:** 14 APPLIED, 0 PENDING, 0 FAILED, 0 ROLLED_BACK, 0 CHECKSUM_MISMATCH, 0 EXTRA; checksums iguais aos blobs canônicos de `4ea73f5`. O CYCLE-05 descreveu esse histórico como "desconhecido" — isso estava desatualizado e foi corrigido. |
| Estado atual | não reverificado (sem acesso). Esperado para esta branch: 14 APPLIED + 4 PENDING (`pix_mercadopago`, `admin_mfa_audit`, `promotions`, `asaas_payments`, todas aditivas). |
| Backup | **NÃO EXISTE** — última listagem: 0 snapshots / 0 schedules; bloqueio do provedor documentado em [RAILWAY_BACKUP_SUPPORT_HANDOFF](../../security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md) |
| Drift de schema (catálogos) | não inspecionado |
| Ferramenta | `npm run db:history-audit -- --expect=staging [--expect-database=… --expect-host=…]` |

Sobre a ferramenta:
- somente leitura: transação `READ ONLY`, timeouts e `ROLLBACK`;
- não carrega `.env` e recusa produção;
- testada no PostgreSQL descartável: 18/18, caso do staging 14+4, adulterações e recusas.

Para fechar o M-21:
1. Backup criado e com caminho de restauração conhecido.
2. `db:history-audit` limpo no momento do deploy.
3. Drift checado com `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, que só lê o banco. A saída tem de corresponder exatamente às 4 migrations pendentes; qualquer outra instrução é drift: **parar**.
4. Plano revisado.

Só então: `migrate deploy` (nunca `db push`) e `migrate status` = "up to date".

## 7. Critério de fechamento do M-20 e de liberação do freeze

| Credencial | Staging (Phase S) | Produção (Phase P) |
|---|---|---|
| Stripe API key | ROTATED / OLD REJECTED | ROTATED / OLD REJECTED |
| Webhook signing secret | ROTATED / OLD REJECTED | ROTATED / OLD REJECTED |
| Session secret | ROTATED / OLD REJECTED | ROTATED / OLD REJECTED |
| Cron secret | ROTATED / OLD REMOVED (prova por configuração, 5.4) | ROTATED / OLD REJECTED (sem gate em produção, prova HTTP possível) |
| Varredura de segredos | PASS | PASS |
| Release guard | PASS | PASS |
| Evidência | COMPLETA e sanitizada | COMPLETA e sanitizada |

Estado em 2026-11-07: **nenhuma linha atendida**. O M-20 só fecha com as duas colunas, porque o incidente é um só. Fechar só o staging deixaria o freeze liberando um release enquanto a chave LIVE comprometida continua ativa.

## 8. Produção (P0–P3) — PRODUCTION ROTATION READY / HUMAN AUTHORIZATION REQUIRED

Nada foi feito em produção. Este roteiro está pronto para o dono executar ou autorizar explicitamente; nenhum agente deve executá-lo sem essa autorização.

### 8.1 Como o Railway ativa variáveis (documentação oficial, lida em 2026-11-08)

| Pergunta | Resposta | Fonte |
|---|---|---|
| Trocar variáveis gera deployment nova? | **SIM**: as mudanças ficam "staged" e, ao aplicar, os serviços afetados são reimplantados | docs.railway.com/guides/variables; /deployments/staged-changes |
| Essa deployment roda o pre-deploy (`migrate deploy`)? | **Não documentado explicitamente**; o pre-deploy roda "entre o build e o deploy". Tratar como **SIM** (fail-safe). | /guides/pre-deploy-command |
| Restart roda o pre-deploy? | Não documentado. Restart restaura a imagem e a configuração originais: **não prova** que as variáveis novas foram carregadas. | /deployments/deployment-actions |
| Rollback restaura variáveis? | **SIM: imagem E variáveis.** Um rollback depois da rotação **traria de volta os segredos comprometidos**. | /deployments/deployment-actions |
| Dá para gravar variáveis sem reimplantar? | Alt+Deploy grava sem reimplantar, mas a deployment em execução não as carrega. Não serve como ativação. | /deployments/staged-changes |

Consequências:
- **Antes de aplicar variáveis em produção**, provar somente leitura que `migrate deploy` será no-op: `npx prisma migrate status` contra o banco de produção, autorizado pelo dono. O `db:history-audit` desta branch recusa produção de propósito. Se houver pendência ou falha: **parar**.
- **DO NOT ROLLBACK COMPROMISED SECRETS.** Rollback de código, se necessário, é feito com redeploy do artefato conhecido mantendo as variáveis novas. Nunca pelo botão de rollback, que restauraria as antigas.
- O pre-deploy de produção atual é o do `main` (`4ea73f5`), que **não** tem o guard do freeze. O guard só passa a valer em produção quando este PR for mergeado — e o merge exige o freeze CLEARED.

### 8.2 Decisão do dono: segurança × disponibilidade

```
SECURITY:     expirar a chave LIVE comprometida imediatamente
AVAILABILITY: checkout, expiração e reconciliação falham até web e rare-cron carregarem a substituta
```

Se a produção estiver com `CHECKOUT_ENABLED=false` (vendas pausadas — confirmar, não verificado daqui), o custo de indisponibilidade cai, mas pedidos existentes ainda dependem da chave para expirar e reconciliar. A escolha é do dono. Se houver sobreposição: **explícita, com prazo fixo, aprovada pelo dono, a menor possível** — minutos, não dias.

### 8.3 Sequência

1. **Revisar os logs** da Stripe (seção 2.3) antes de tocar em qualquer coisa: a revisão é evidência do período de exposição.
2. **P0 — Stripe LIVE:** Dashboard (live) → API keys → "Roll key" da chave secreta, expiração conforme 8.2. Inserir a substituta direto no Railway (`STRIPE_SECRET_KEY`) do **web e do `rare-cron`**; nunca em `.env`, chat ou terminal. Aplicar a mudança (deploy) depois da checagem de 8.1.
   - Nova: a sonda não aceita chave live de propósito. Use um teste live somente leitura feito pelo dono, por exemplo `GET /v1/balance` pelo Workbench, e registre só o status.
   - Antiga: 401 depois de expirar.
3. **P1 — webhook live:** endpoint de produção `…/api/stripe/webhook` → conferir URL, `livemode`, habilitado e os 6 eventos tratados (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`) → Roll secret → `STRIPE_WEBHOOK_SECRET` no web.
   - Prova: "Send test webhook" entregue com 200; evento assinado com o segredo antigo → 400.
   - Eventos que falharam no intervalo: reprocessar pelo Dashboard, um a um. O dedup por `StripeEvent` mantém tudo idempotente — sem replay às cegas, sem recriar pagamento.
4. **P2 — sessão:** novo `ADMIN_SESSION_SECRET` no web (`AUTH_SECRET` continua ausente). Todos os Admins e clientes são deslogados — é o esperado.
   - Prova: cookie antigo de Admin e de cliente → login; login novo funciona. Em produção ainda **não há MFA** — ele chega com este PR.
5. **P3 — cron:** só depois de inventariar os chamadores (2.2, em especial a Vercel). Novo `CRON_SECRET` no web e em cada chamador real; `CRON_SECRET_PREVIOUS` ausente.
   - Prova: em produção não há gate Basic, então a prova por HTTP é possível — antigo → 401, ausente → 401. Um segredo válido **executa** o job de expiração.

### 8.4 Fechamento

O freeze só sai de ACTIVE com as 8 linhas da seção 2 em ROTATED / OLD REVOKED / OLD REJECTED / NEW VALIDATED, com evidência em [`docs/security/evidence/CREDENTIAL_INCIDENT_202610_CLOSURE.md`](../../security/evidence/CREDENTIAL_INCIDENT_202610_CLOSURE.md). Com 7 de 8 linhas resolvidas, o freeze continua ACTIVE.

## 9. Cópias locais e histórico de shell (2026-11-08)

| Item | Estado | Ação |
|---|---|---|
| `.env` raiz (`STRIPE_SECRET_KEY` TEST comprometida) | PRESENT | Trocar ou remover **depois** que a antiga estiver REJECTED (P4) |
| `output/*/standalone/.env` (4 cópias, mesma chave TEST) | PRESENT | Apagar depois de P4 (são saídas de build descartáveis); preservar relatórios não sensíveis da mesma pasta |
| `.next/standalone/.env` | ABSENT | — |
| Histórico do PowerShell | 11 ocorrências de **uma** URL PostgreSQL com credencial, host **Neon** (não Railway); nenhuma chave Stripe, `whsec_`, Asaas ou Bearer | Fora das 4 categorias. O dono identifica o projeto Neon e decide se a credencial ainda vale (se valer, girar a senha no Neon); só então a limpeza seletiva. Não foi testada: autenticar num banco com credencial vazada não é verificação segura. |

Nenhuma cópia foi alterada neste ciclo: a revogação no provedor vem primeiro.
