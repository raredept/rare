# CYCLE-06 — Security freeze e prontidão de staging (RARE-BF-MFA-ASAAS-04), 2026-11-07

Objetivo pedido: rotacionar as credenciais comprometidas, provar a revogação, fechar M-20/M-21 e homologar o staging real. **Resultado: nada disso foi possível desta máquina**: Railway `Unauthorized` para o projeto Rare e nenhum acesso à Stripe. O ciclo fez o que era seguro, sem nenhuma mutação externa.

## Estado inicial

`cycle/rare-bf-mfa-asaas-01` = `e835585`, árvore limpa; PR #2 Draft, CI verde; `main` = `4ea73f5` (0 atrás).

## Achados

1. **O incidente cobre staging e produção.** As quatro categorias (Stripe API key, webhook signing secret, `ADMIN_SESSION_SECRET`, `CRON_SECRET`) foram expostas nos dois ambientes, inclusive a chave Stripe **LIVE**. O CYCLE-05 tinha registrado "de staging"; foi corrigido.
2. **A chave Stripe TEST comprometida ainda é aceita:** sonda somente leitura, HTTP 200 em 2026-11-07T14:50Z.
3. **O histórico de migrations do staging já estava verificado** em 2026-10-07 (14/14, limpo). O M-21 depende de backup (inexistente), de revalidação no momento do deploy e de checagem de drift.
4. **O freeze era só documental**: nada impedia um deploy de produção.
5. **Varreduras sem achado novo:**
   - Git (todos os refs + reflog, 2 173 blobs), 6 worktrees, históricos de shell e transcripts: NOT FOUND.
   - Cópias da chave TEST só nos locais já conhecidos (`.env` e 4 `output/*/standalone/.env`).
   - GitHub Actions: 0 secrets.
6. **No staging, o cron não pode ser provado por HTTP:** o gate Basic e o Bearer do cron disputam o mesmo header `Authorization`. A rota não foi isentada do gate, porque isso exporia o segredo comprometido.

## Entregas

| Commit | O quê |
|---|---|
| `3b19bd6` | Freeze em código: `docs/security/RELEASE_FREEZE.json` + `scripts/release-freeze.mjs` no pre-deploy do Railway (web e worker) e no release guard; 34 testes |
| `fd64cf3` | `npm run db:history-audit` — auditoria somente leitura de `_prisma_migrations` (testada em PG descartável) |
| `f37bfcb` | `scripts/rotation-probe.mjs` — provas NEW WORKS / OLD FAILS só com status (validada contra a rota real de webhook) |
| `b1fd497` | `SECURITY_FREEZE_CLOSURE.md`, seção datada no incidente, correção de M-20/M-21 |

Gates: tsc, lint, unit (176 / 1587), release guard 0 FAIL, CI do PR verde em `b1fd497`.

## Não feito

Rotação, revogação, configuração do staging, deploy, migrations, homologação real, Asaas Sandbox, E2E em staging — todos BLOCKED_EXTERNAL.
