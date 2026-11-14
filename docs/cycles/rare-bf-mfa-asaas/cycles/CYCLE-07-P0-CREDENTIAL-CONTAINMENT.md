# CYCLE-07 — Contenção P0 do incidente de credenciais (RARE-BF-MFA-ASAAS-05), 2026-11-08

Objetivo: conter o incidente (rotacionar, revogar, provar que as antigas falham, verificar abuso, limpar cópias, documentar) e só então liberar o freeze. Sem features novas.

**Resultado:**
- **M-20 continua OPEN.**
- Produção: **PRODUCTION ROTATION READY — HUMAN AUTHORIZATION REQUIRED.**
- Staging: BLOCKED_EXTERNAL.
- Nenhuma credencial foi criada, trocada ou revogada, e nada em staging ou produção foi tocado.

## Estado inicial

`cycle/rare-bf-mfa-asaas-01` = `b1fd497` (= origin), árvore limpa; PR #2 OPEN, Draft, não mergeado, CI Gates PASS em `b1fd497`; `main` = `4ea73f5` (0 atrás).

## Acessos (2026-11-08)

| Sistema | Estado |
|---|---|
| Railway | CLI logado na conta do Pedro, `Unauthorized` para o projeto vinculado; nenhum projeto Rare visível (só um workspace pessoal vazio e o da DuraPets, não tocado) → **BLOCKED_EXTERNAL** |
| Stripe Dashboard | Nenhum dos 4 Chromes conectados tem sessão (todos caem no login; não logamos) → **BLOCKED_EXTERNAL** |
| Vercel | Sem sessão no navegador em uso → cron da Vercel **UNKNOWN** |
| GitHub | PR e CI acessíveis (Browser 4) |

## O que foi verificado

- **Stripe TEST antiga ainda ACEITA:** `rotation-probe stripe-key --expect=rejected` → HTTP 200, verdict FAIL, em 2026-11-08T16:10Z. É a segunda prova (a primeira foi em 2026-11-07T14:50Z).
- **Consumidores no código:**
  - Stripe API key: web e worker.
  - Webhook: web.
  - Sessão: web e proxy (Admin e cliente).
  - Cron: rota GET e POST. Chamadores possíveis: `rare-cron` (não usa), Vercel (UNKNOWN), script manual, nenhum no GitHub.
- **Ativação no Railway** (documentação oficial):
  - Variável aplicada gera nova deployment; tratar o pre-deploy (`migrate deploy`) como executado.
  - **Rollback restaura imagem e variáveis**: nunca usar rollback depois da rotação.
- **Histórico do shell:** uma URL PostgreSQL com credencial (host Neon, fora das 4 categorias), 11 ocorrências; nenhuma chave Stripe, `whsec_`, Asaas ou Bearer. Validade não testada.
- **Atividade na Stripe:** NOT REVIEWED (sem acesso). Única atividade observada: as duas sondas desta investigação.

## Entregas

- `SECURITY_FREEZE_CLOSURE.md`:
  - matriz de contenção com 8 linhas (P0–P3 produção, P4–P7 staging) e todos os campos pedidos;
  - consumidores e chamadores de cron;
  - fatos de ativação do Railway;
  - roteiro de produção pronto para autorização, com o trade-off segurança × disponibilidade;
  - cópias locais.
- `docs/security/evidence/CREDENTIAL_INCIDENT_202610_CLOSURE.md` — registro sanitizado de evidência (NOT CLOSED).
- Seção datada no incidente; M-20, M-21 e novas ações manuais em `15_MANUAL_ACTIONS.md`; `12_STAGING.md`, `FINAL_AUDIT.md`; este relatório e o CYCLE-06.
- Nenhuma mudança de código. O freeze continua `ACTIVE`, e os 34 testes do guard seguem PASS.

## Reauditoria

| Pergunta | Resposta |
|---|---|
| Algum segredo antigo ainda é aceito? | **SIM** — Stripe TEST (provado); os outros 7 são UNKNOWN |
| Algum serviço ainda usa segredo antigo? | SIM — nenhum consumidor foi atualizado |
| Algum rollback pode restaurá-lo? | Hoje não há substituta; depois da rotação, **SIM**, se alguém usar rollback (o Railway restaura variáveis) |
| Algum worker esquecido? | `rare-cron` e `rare-checkout-worker-staging` usam a Stripe API key: precisam entrar na troca |
| Algum webhook ainda usa o segredo antigo? | SIM (os dois ambientes) |
| Algum chamador de cron esquecido? | Vercel UNKNOWN |
| Algum ambiente compartilha segredo? | Não, segundo o incidente (staging ≠ produção); não reverificado |
| Alguma cópia local com credencial ativa? | SIM — `.env` e 4 `standalone/.env` com a chave TEST, ainda aceita |

Logo, **M-20 continua aberto**.
