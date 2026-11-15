# CREDENTIAL_INCIDENT_202610 — evidência de fechamento

**Estado: NOT CLOSED.** `docs/security/RELEASE_FREEZE.json` continua `ACTIVE`. Este arquivo só recebe evidência sanitizada: nunca valor, prefixo identificável, hash ou fingerprint de credencial, nem cookie, header `Authorization`, URL com credencial ou corpo de resposta.

Plano, matriz e critério: [SECURITY_FREEZE_CLOSURE.md](../../cycles/rare-bf-mfa-asaas/SECURITY_FREEZE_CLOSURE.md). Incidente: [CREDENTIAL_INCIDENT_202610.md](../CREDENTIAL_INCIDENT_202610.md).

## Registro

Cada entrada: data/hora (UTC) · operador · ambiente · categoria · ação/prova · resultado (estado) · logs do provedor revisados · consumidores verificados.

| UTC | Operador | Ambiente | Categoria | Ação / prova | Resultado | Logs do provedor | Consumidores |
|---|---|---|---|---|---|---|---|
| 2026-11-07T14:50Z | agente (Claude Code), sessão do dono | staging | Stripe API key (TEST) | sonda somente leitura `GET /v1/balance` com a cópia local da chave comprometida | **OLD ACCEPTED** (HTTP 200) | NÃO revisados (sem acesso à Stripe) | NÃO verificados (sem acesso ao Railway) |
| 2026-11-08T16:10Z | agente (Claude Code), sessão do dono | staging | Stripe API key (TEST) | `scripts/rotation-probe.mjs stripe-key --expect=rejected` | **OLD ACCEPTED** (HTTP 200) — verdict FAIL | NÃO revisados | NÃO verificados |

## Pendente para fechar (todas as 8 linhas)

| Ambiente | Categoria | Substituta validada | Antiga revogada | Antiga rejeitada | Logs revisados | Consumidores verificados |
|---|---|---|---|---|---|---|
| produção | Stripe API key (LIVE) | — | — | — | — | — |
| produção | Stripe webhook signing secret | — | — | — | — | — |
| produção | `ADMIN_SESSION_SECRET` | — | — | — | n/a | — |
| produção | `CRON_SECRET` | — | — | — | n/a | — (inclui Vercel) |
| staging | Stripe API key (TEST) | — | — | **NÃO** (ainda aceita) | — | — |
| staging | Stripe webhook signing secret | — | — | — | — | — |
| staging | `ADMIN_SESSION_SECRET` | — | — | — | n/a | — |
| staging | `CRON_SECRET` | — | — | — (prova HTTP impossível no staging; ver closure §5.4) | n/a | — |

Fechamento:
1. Preencher todas as linhas.
2. Reexecutar a varredura de segredos.
3. Release guard PASS.
4. Só então editar `RELEASE_FREEZE.json` para `CLEARED`, com `closure.evidence` apontando para este arquivo.
