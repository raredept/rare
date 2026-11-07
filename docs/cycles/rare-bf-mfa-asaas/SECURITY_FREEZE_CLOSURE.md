# Security freeze — fechamento do incidente de credenciais (M-20) e gate do banco de staging (M-21)

**Estado em 2026-11-07 (CYCLE-06):** `RELEASE_SECURITY_FREEZE = ACTIVE` · **M-20 = OPEN (BLOCKED_EXTERNAL)** · **M-21 = OPEN**.

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

## 2. Inventário

| Credencial | Ambiente | Provedor | Estado atual | Rotação | Revogação | Prova exigida | Dono |
|---|---|---|---|---|---|---|---|
| Stripe API key (TEST) | staging (web + worker) | Stripe, modo teste | COMPROMISED · **OLD ACCEPTED** (sonda 2026-11-07T14:50Z, HTTP 200) | nova chave secreta TEST no Dashboard; configurar em `rare-staging` e `rare-checkout-worker-staging` | expirar a antiga no Dashboard ("Roll key", expiração imediata) | `rotation-probe stripe-key`: nova ACCEPTED, antiga REJECTED | dono da conta Stripe + operador Railway |
| Stripe webhook signing secret | staging (web) | Stripe, endpoint `…/api/stripe/webhook` (test) | COMPROMISED · não verificável daqui | "Roll secret" no endpoint; configurar `STRIPE_WEBHOOK_SECRET` no web | expiração imediata do segredo antigo (o app aceita um só segredo) | `rotation-probe stripe-webhook`: novo ACCEPTED, antigo REJECTED; evento de teste do Dashboard entregue | dono Stripe + operador |
| `ADMIN_SESSION_SECRET` (Admin e cliente) | staging (web) | app (JWT) | COMPROMISED · `AUTH_SECRET` ABSENT | gerar ≥32 bytes CSPRNG; configurar no web; `AUTH_SECRET` continua ausente | o valor antigo sai de toda instância; sem fallback | sessão emitida antes da troca → volta ao login; login novo → funciona (Admin e cliente) | operador |
| `CRON_SECRET` | staging (web valida; worker não usa) | app (Bearer) | COMPROMISED · `CRON_SECRET_PREVIOUS` ABSENT · nenhum chamador HTTP conhecido no staging | gerar novo; configurar no web; não criar `CRON_SECRET_PREVIOUS` | o valor antigo sai do validador | ver limitação na seção 5.4 | operador |
| Stripe API key (**LIVE**) | **produção** | Stripe, modo live | COMPROMISED (fonte) · estado atual UNKNOWN | Phase P | Phase P | Phase P | dono — **fora deste ciclo, não autorizado aqui** |
| Stripe webhook signing secret | **produção** | Stripe | COMPROMISED · UNKNOWN | Phase P | Phase P | Phase P | dono |
| `ADMIN_SESSION_SECRET` | **produção** | app | COMPROMISED · UNKNOWN | Phase P (desloga todos os Admins **e clientes**) | Phase P | Phase P | dono |
| `CRON_SECRET` | **produção** (web + `rare-cron`; Vercel cron legado UNKNOWN) | app | COMPROMISED · UNKNOWN | Phase P, depois de inventariar os chamadores | Phase P | Phase P | dono |

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
