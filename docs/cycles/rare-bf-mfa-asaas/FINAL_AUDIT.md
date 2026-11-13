> **Atualização vigente — 2026-11-13:** ver [RARE-FINAL-RELEASE-01](cycles/CYCLE-FINAL-RELEASE-01.md).
> Asaas é o único provider autorizado para novos pagamentos. Stripe não é fallback;
> rollback fecha checkout (`PAYMENT_PROVIDER=disabled`, `CHECKOUT_ENABLED=false`).
> Staging real publicado: web/worker c93f2f4, 18 migrations aplicadas, zero pendentes/drift.
> MFA real Chromium/Firefox/WebKit: 8/8 em cada. Sessões antigas rejeitadas nos dois ambientes.
> Produção contida no main anterior, checkout OFF; Stripe removida dos consumers ativos.
> Primeiro Pix Sandbox calculou R$ 170 corretamente; formato real do ID revelou bug corrigido
> em 54e0ac8, aguardando CI/deploy/reteste. Lifecycle, promoções e E2E comercial em andamento.
> Freeze ACTIVE, PR Draft. As seções abaixo preservam evidência histórica dos ciclos anteriores.
# RARE BF / MFA / ASAAS — FINAL CYCLE REPORT

## Atualização CYCLE-07 — contenção P0 do incidente de credenciais (2026-11-08)

- **M-20 OPEN.** Incidente em **staging e produção** (Stripe LIVE incluída). Nenhuma credencial foi girada: Railway e Stripe inacessíveis desta máquina, e produção exige autorização humana. Estado: **PRODUCTION ROTATION READY — HUMAN AUTHORIZATION REQUIRED**.
- A chave Stripe **TEST** antiga **continua aceita** (HTTP 200, 2026-11-07 e 2026-11-08). A revisão de atividade na Stripe não foi feita (NOT REVIEWED, M-22). O cron da Vercel é UNKNOWN (M-23).
- Railway: aplicar variáveis gera nova deployment (tratar o pre-deploy `migrate deploy` como executado), e **rollback restaura as variáveis antigas** — nunca usar rollback depois da rotação.
- `RELEASE_SECURITY_FREEZE` continua **ACTIVE** (guard em código, 34 testes). Matriz P0–P7 e roteiro: [SECURITY_FREEZE_CLOSURE.md](SECURITY_FREEZE_CLOSURE.md); evidência: [CREDENTIAL_INCIDENT_202610_CLOSURE.md](../../security/evidence/CREDENTIAL_INCIDENT_202610_CLOSURE.md); relatório: [cycles/CYCLE-07-P0-CREDENTIAL-CONTAINMENT.md](cycles/CYCLE-07-P0-CREDENTIAL-CONTAINMENT.md).
- MERGE READY: **NÃO**. PRODUCTION RELEASE READY: **NÃO**. STAGING REAL: **NÃO EXECUTADO**.

## Atualização CYCLE-05 — integração com `codex/backend-evolution-20261007` (2026-11-07)

- **M-14 resolvido**: a evolução de backend/redesign (`bc2c10c`) foi integrada por merge explícito (`21729fb`) e provada com a regressão completa antes de chegar à branch do PR. 7 conflitos textuais + 11 auto-merges revisados; nada do ciclo (MFA, Promoções, Black Friday, Asaas, `PAYMENT_PROVIDER`, preço no servidor, rollback Stripe, drivers de e-mail) nem da evolução de backend (shell do Admin, endurecimento de APIs, redesign, testes) se perdeu. Classificação em [BACKEND_EVOLUTION_RECONCILIATION.md](BACKEND_EVOLUTION_RECONCILIATION.md); execução em [cycles/CYCLE-05-BACKEND-RECONCILIATION.md](cycles/CYCLE-05-BACKEND-RECONCILIATION.md).
- Merge bruto: único dano real foi contraste (preço riscado sobre o novo fundo da loja). Revisão encontrou mais 6 problemas semânticos/visuais/de teste; todos corrigidos em commits próprios.
- Regressão final: tsc/lint PASS · unit 173/1542 · build PASS · release guard 0 FAIL · audit 0 · migrations 18 sem drift · QA PostgreSQL 8 + 12 · lab Chromium, Firefox e WebKit PASS (os 2 casos que falharam nas rodadas longas eram do ambiente de teste, corrigidos e repetidos) · suíte isolada e matriz responsiva do Admin do backend PASS · 0 vazamentos em log · 0 anomalias de dados.
- Novo bloqueio registrado pela linha de backend: incidente de credenciais aberto (M-20). **Correção do CYCLE-06:** o incidente cobre staging **e produção**; e o histórico de migrations do staging já estava verificado em 2026-10-07 (M-21 pendente só por backup/revalidação). Ver [SECURITY_FREEZE_CLOSURE.md](SECURITY_FREEZE_CLOSURE.md).
- STAGING PASS: **NÃO** (continua BLOCKED_EXTERNAL). MERGE READY: **NÃO**. PRODUCTION READY: **NÃO**.

## Atualização CYCLE-04 — homologação de staging (2026-11-07)

- **Staging real: NÃO EXECUTADO** (BLOCKED_EXTERNAL: sem acesso ao projeto RARE no Railway — M-01). Nenhuma variável, migration ou deploy em staging; produção intocada; nenhuma cobrança.
- **Laboratório staging-like** (`npm run qa:staging-lab`, build de produção com `APP_ENV=staging`): MFA, autorização do Admin, Promoções, campanha QA de Black Friday, preço no servidor, replay de server action, janela agendada, webhook (sem rede), roteamento por `PAYMENT_PROVIDER` (asaas/desconhecido/stripe), responsividade 320–1920, axe, analytics e log — PASS em Chromium e WebKit.
- **5 bugs corrigidos** (checkout falando "Stripe" sem provedor disponível; 3 problemas de contraste no Admin escuro, incluindo o preview da campanha; 2 overflows), mais uma regressão de especificidade introduzida e corrigida no mesmo ciclo. Detalhe e commits em `cycles/CYCLE-04-STAGING.md`.
- **CI** no GitHub (`PR CI`) passa no PR #2.
- STAGING PASS: **NÃO**. MERGE READY: **NÃO**. PRODUCTION READY: **NÃO**.

Data: 2026-11-06 (America/Sao_Paulo). Evidência local (Windows do dono + PostgreSQL 17 isolado). Staging e produção **não** foram tocados.

## BASE
- Initial branch: `integration/pre-go-live` (worktree principal estava em `codex/backend-evolution-20261007@bc2c10c`, preservada)
- Initial commit: `f15e5b6`
- Cycle branch: `cycle/rare-bf-mfa-asaas-01` (worktree `.claude/worktrees/rare-bf-mfa-asaas-01`; publicada depois como Draft PR https://github.com/raredept/rare/pull/2 — ver `cycles/CYCLE-03.md`)
- Final commit: commit `docs(cycle): …` que contém este arquivo (logo após `912f6e5`)

## CYCLES
- Executed: CYCLE-01 (implementação), CYCLE-02 (reauditoria, 4 correções + 1 ajuste de processo)

## BLACK FRIDAY
- Admin campaign: PASS — seed cria DRAFT editável, sem desconto inventado
- Homepage: PASS (código/testes) — campanha ACTIVE + destaque, sem hardcode
- Scheduling: PASS — status derivado de datas, fuso São Paulo, sem deploy
- Products: PASS — só produtos cuja promoção vencedora é a campanha
- Prices: PASS — servidor, % calculado
- Countdown: PASS — só com `endsAt`, não reinicia, recarrega ao fim
- Mobile: NOT VERIFIED (MANUAL)
- Accessibility: PASS em código (rótulos, sr-only, desconto não só por cor); NOT VERIFIED em navegador

## PROMOTIONS
- CRUD: PASS (sem exclusão física; encerrar/duplicar)
- Scheduling: PASS · Scopes: PASS · Priority: PASS · Pricing: PASS
- Audit log: PASS · Preview: PASS (desktop/mobile, não publica) · Server-side validation: PASS

## MFA
- Enrollment: PASS · TOTP: PASS · Recovery codes: PASS (hash, uso único, regeneração com TOTP)
- Rate limit: PASS · Session enforcement: PASS · Legacy admins: PASS (cadastro obrigatório)
- Reset: PASS (CLI com confirmação, audit, revoga sessões) · Bypass tests: PASS local; staging MANUAL

## ADMIN SECURITY
- Authentication: PASS · Authorization: PASS · IDOR/BOLA: PASS (ids validados, single-tenant Admin)
- Open redirect: PASS · Session revocation: PASS · Direct APIs: PASS · Server Actions: PASS
- Testes adversariais contra staging (headers, Cloudflare): NOT EXECUTED (MANUAL)

## ASAAS
- Sandbox: NOT EXECUTED (sem chave — MANUAL)
- API client: PASS (conferido com docs.asaas.com) · Customer mapping: PASS · Payments: PASS (mock + PG)
- Pix: PASS (mock) · Card: PASS (fatura hospedada, sem PAN/CVV) · Installments: não oferecido (decisão pendente)
- Webhook: PASS · Webhook auth: PASS · Idempotency: PASS · Out-of-order: PASS
- Refund/cancel: PASS (reembolso via Admin; DELETE antes de liberar estoque) · Production guard: PASS

## STRIPE MIGRATION
- Stripe retained: SIM · Rollback: `PAYMENT_PROVIDER=stripe` · Removal ready: NÃO · Removed: NÃO

## CHECKOUT
- Server-side pricing: PASS · Promotion: PASS · Shipping: PASS (usa preço promocional) · Stock: PASS (5 compradores/1 unidade = 1 vencedor) · Payment: PASS (mock)

## ANALYTICS
- Promotion metrics: PASS · Sales: PASS · Discount: PASS · Black Friday: PASS via período/promoção (top produtos por campanha = FUTURE FEATURE)

## DATABASE
- Migrations: 3 aditivas, PASS em PG vazio, sem drift · Indexes: criados; query plans de produção não medidos
- Staging: MANUAL · Production plan: 13_PRODUCTION_PLAN

## TESTS
- Lint: PASS · TypeScript: PASS · Unit: PASS (163 arquivos / 1461) · Integration: PASS (QA PG 8 + 12 provas)
- Admin E2E: NOT EXECUTED · Public E2E: NOT EXECUTED · Commercial E2E: NOT EXECUTED
- Security: PASS (unit/integração) · Build: PASS · Release guard: PASS (0 FAIL, 1 WARNING pré-existente)

## STAGING
- Promotion / Black Friday / MFA / Asaas / Checkout / Webhook / Stock: NOT EXECUTED — sem acesso ao projeto RARE no Railway

## SECURITY
- Critical: 0 · High: 0 · Medium: 0 abertos (1 corrigido) · Low: 1 aceito (S-04 pré-existente), 2 corrigidos
- Remaining: só MANUAL / EXTERNAL / BUSINESS DECISION / ACCEPTED RISK

## MANUAL REMAINING
1. Acesso ao Railway do projeto RARE e publicação em staging (M-01, M-04, M-05)
2. Conta/chave Asaas Sandbox e depois produção (M-02, M-10)
3. `ADMIN_MFA_ENCRYPTION_KEY` por ambiente (M-03)
4. Revisão visual/mobile/acessibilidade (M-13)
5. ~~Push + PR da branch (M-15)~~ feito: Draft PR https://github.com/raredept/rare/pull/2 (CYCLE-03)

## BLOCKERS BEFORE MERGE
1. Staging com roteiro 12_STAGING em PASS
2. ~~Resolver conflito com a linha de redesign `codex/backend-evolution-20261007`~~ feito no CYCLE-05 (M-14)
3. Revisão humana do PR
4. Incidente de credenciais de staging encerrado e `RELEASE_SECURITY_FREEZE` levantado (M-20)

## BLOCKERS BEFORE PRODUCTION DEPLOY
1. `ADMIN_MFA_ENCRYPTION_KEY` de produção configurada antes do deploy (senão ninguém entra no Admin)
2. Testes adversariais §28 em staging
3. Backup do banco

## BLOCKERS BEFORE BLACK FRIDAY
1. Decisão comercial: produtos, desconto, datas, banner (M-06)
2. Preview aprovado + checagem mobile/acessibilidade
3. MFA em produção concluído (o Admin precisa entrar para ativar)

## BLOCKERS BEFORE ASAAS GO-LIVE
1. Asaas Sandbox PASS em staging (Pix, cartão, expiração, reembolso, webhook)
2. Conta de produção, chave `$aact_prod_`, webhook com token próprio
3. Piloto real controlado PASS

- MERGE READY: NÃO
- PRODUCTION DEPLOY READY: NÃO
- BLACK FRIDAY READY: NÃO
- MFA READY: NÃO (código pronto; falta chave + cadastro em staging)
- ASAAS SANDBOX READY: SIM para iniciar o teste (código + roteiro prontos); Sandbox PASS ainda não obtido
- ASAAS PRODUCTION READY: NÃO
- STRIPE REMOVAL READY: NÃO

FINAL REAUDIT: No additional actionable findings (no escopo verificável localmente)

TREE CLEAN: SIM (worktree do ciclo)
