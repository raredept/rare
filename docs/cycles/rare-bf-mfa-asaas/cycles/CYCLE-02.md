# CYCLE-02 — Reaudit → Fix → Validate (2026-11-06, 17:40–18:10)

## Reconciliação

Estado real conferido de novo (não confiado no relatório anterior): branch, worktrees, commits, gates. tsc/eslint/vitest/build PASS na entrada.

## Auditoria

- MFA/Auth (P0): fluxo pendente → sessão, proxy, `getCurrentAdmin`, todas as server actions, open redirect, replay, rate limit, reset, cripto. Sem bypass encontrado.
- Promoções: engine, stacking/cupom, validação/allowlist/XSS, transições, audit, vitrine, campanha, countdown, analytics, dashboard.
- Asaas: comparado com docs.asaas.com (auth, hosts, prefixos, webhook, eventos, Pix QR, bloqueio cautelar).
- QA em PostgreSQL real reexecutado.

## Achados e correções

| # | Sev. | Achado | Root cause | Correção | Commit |
|---|---|---|---|---|---|
| 1 | Medium | Pix `CONFIRMED` (bloqueio cautelar até 72 h, pode virar REFUNDED) tratado como liquidado sem alerta | mapeamento seguia só o status, sem o caso documentado do Pix | notificação `payment_pix_held` "não envie"; testes | `612cfa4` |
| 2 | — | QA de concorrência Stripe falhava | teste antigo usava o mesmo cliente nas duas compras; a loja substitui o checkout anterior por design (falha reproduzida na base `f15e5b6`) | corrida com dois compradores; QA do ciclo versionado + scripts npm | `ceb8088` |
| 3 | Low | `.env.example` com `CHECKOUT_ENABLED=false.` solto | inserção das variáveis novas partiu um comentário | linha restaurada; release guard falha em variável duplicada | `47ac4de` |
| 4 | Low | audit do MFA sem contagem de códigos | sanitizador descarta chaves com "recovery" | chaves `backupCodes*`; testes exigem a contagem | `912f6e5` |
| 5 | Info | `release:guard` FAIL por `output/` rastreado | relatório do ciclo commitado em pasta ignorada | relatórios versionados em `docs/cycles/rare-bf-mfa-asaas/`; `output/` só local | commit de docs |

Cada correção: reproduzida → teste de regressão → fix → testes alvo → suíte completa → QA PG.

## Saída

tsc PASS · eslint PASS · vitest 163/1461 PASS · build PASS · release guard 0 FAIL · audit 0 · migrate diff sem diferença · QA PG 8 + 12 provas PASS.

## Reauditoria final (olhar novo sobre as próprias correções)

- Alerta de Pix: mesma transação do pagamento, deduplicado por pedido, não afeta cartão nem Pix recebido; `type` é texto livre no schema.
- Guard de `.env.example`: detecta o defeito em `HEAD~` e passa no estado atual.
- Chaves de audit: nenhum outro leitor dependia dos nomes antigos (o retorno do reset mantém `recoveryCodesRemoved`).
- QA Stripe: os passos seguintes continuam usando o pedido vencedor, qualquer que seja o comprador.

Nenhum novo achado acionável. Não há CYCLE-03 local: o que resta depende de staging/credenciais (15_MANUAL_ACTIONS).
