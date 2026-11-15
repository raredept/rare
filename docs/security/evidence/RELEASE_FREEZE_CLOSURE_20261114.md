# Release freeze (M-20) — evidência de contenção, 2026-11-14/15 (RARE-PRE-LAUNCH-06)

Escopo: as condições de `docs/security/RELEASE_FREEZE.json` (policy 2) ainda abertas depois da
auditoria independente de `a91a05a` (NO-GO, HIGH-1). Sem valores de segredo, prefixos, hashes de
segredo, URLs de banco ou PII. Horários em UTC.

**Resultado: freeze continua `ACTIVE`.** Contenção interna de produção fechada (cron, sessão, Stripe
desconectada, checkout OFF). Falta `stagingRealPassed` (Admin WebKit no staging real) e a assinatura
de quem libera (`clearedBy`). Revogação externa da Stripe: `MANUAL_PENDING`.

## 1. Incidente novo durante este ciclo

- **2026-11-14 ~22:45**, durante o inventário somente leitura do Railway: a sessão do agente abriu, no
  painel "Activity" do projeto, o lote de mudanças de 2026-11-13 19:16 do serviço `rare`
  (production). O diálogo mostra valores antigos e novos de variáveis em texto: `CRON_SECRET`,
  `ADMIN_SESSION_SECRET` (antigo e novo daquele lote), `ADMIN_MFA_ENCRYPTION_KEY` (daquele lote) e
  parte inicial da chave Stripe LIVE antiga. Os valores entraram na saída de ferramenta da sessão; o
  diálogo foi fechado na hora e nenhum valor foi copiado para arquivo, commit ou documento.
- Agravante encontrado no mesmo inventário: o lote seguinte (2026-11-13 23:25, nova troca de cron,
  sessão e chave MFA) teve o deploy do web **FAILED** ("failed to download build driver"). O web de
  produção seguia rodando o snapshot das 19:16, isto é, os valores agora expostos.
- **Contenção, autorizada pelo dono em chat:** redeploy do web `rare` em produção a partir de `main`
  (`4ea73f50cafdbf67e16dc71de985052075feca42`, o mesmo commit), sem alterar variáveis.
  - `railway redeploy --from-source` 2026-11-15 02:40:03 → deployment substituída por outra de
    02:41:56 (`df74bc60…`, mesmo commit, origem não determinada — provável retentativa automática do
    Railway) → **SUCCESS** 02:45.
  - A deployment das 19:16 (`dedcb1ee…`) ficou **REMOVED**: os valores expostos saíram do runtime.
  - O worker `rare-cron` já estava no lote das 23:25 (`48918ca5…`, SUCCESS) e não foi tocado.
  - Runtime depois: `/api/health` ok_with_warnings, `configuration.errors` vazio; `POST /api/checkout`
    → 503; `/` e `/admin/login` → 200; `GET /api/cron/release-expired-inventory` sem credencial → 401.
- Os valores atuais (lote 23:25) **não** foram vistos nesta sessão. Não há como afirmar daqui se
  outra sessão abriu o diálogo daquele lote; recomendação ao dono: uma nova troca controlada de
  `CRON_SECRET` e `ADMIN_SESSION_SECRET`, aplicada **com deploy confirmado**, antes do go-live, e não
  abrir o detalhe de lotes de variáveis do painel Activity em sessões de agente.
- `ADMIN_MFA_ENCRYPTION_KEY`: o código de produção (`main`) não usa MFA; a chave vale para o futuro
  release. A do lote 19:16 foi exposta e já foi substituída no lote 23:25.

## 2. Matriz

| Condição | Evidência | Estado |
|---|---|---|
| Sessão staging | rotação e sessão antiga recusada (CYCLE-FINAL-RELEASE-01, 2026-11-13) | true |
| Sessão produção | segredo trocado em 19:16 e 23:25; runtime agora no lote 23:25 (deploy 02:41 SUCCESS, 19:16 REMOVED); sem fallback de segredo anterior no código | true |
| Cron staging | trocado, anterior ausente; staging no candidato que ignora `CRON_SECRET_PREVIOUS` | true |
| Cron produção | ver §3 | true |
| Stripe staging desconectada | sem variáveis Stripe no web/worker de staging (registro 2026-11-13) | true |
| Stripe produção desconectada | lote 19:16 "remove compromised Stripe"; leitura somente de nomes em 2026-11-15: nenhuma variável `STRIPE*`/`MERCADO*` em `rare` e `rare-cron`; runtime agora carregado depois disso | true |
| Novos pagamentos Stripe impossíveis | `PAYMENT_PROVIDER=disabled`, `CHECKOUT_ENABLED=false` em `rare` e `rare-cron`; `POST /api/checkout` 503; candidato recusa provider ausente/stripe/desconhecido | true |
| Sem fallback Stripe | candidato: só Asaas inicia pagamento (testes e `release-freeze` recusam `STRIPE_*`) | true |
| Asaas Sandbox real | ver §5 | true |
| Staging real | ver §6 | **false** |
| Checkout inicial OFF | `CHECKOUT_ENABLED=false`, `PAYMENT_PROVIDER=disabled` em produção; runbook do Clean Slate mantém OFF | true |
| Stripe externa | revogação/expiração das chaves e webhooks antigos no painel Stripe não comprovada | MANUAL_PENDING |

## 3. Cron de produção — prova sem chamada mutável

O endpoint executa `releaseExpiredReservations()` quando aceita a credencial, então nenhum segredo
(antigo ou novo) foi enviado a ele. A prova é a combinação:

1. Rotação registrada: `CRON_SECRET` alterado no `rare` em 2026-11-13 19:16 e de novo 23:25 (painel
   Activity, só títulos e horários; o valor do lote 19:16 difere do anterior e o de 23:25 difere de 19:16).
2. Runtime atual carregou o valor de 23:25: a única deployment ativa do web é de 2026-11-15 02:41,
   posterior à mudança; o Railway aplica variáveis no deploy.
3. `CRON_SECRET` presente (64 caracteres) e igual no web e no `rare-cron` (comparação local de igualdade,
   sem imprimir); `CRON_SECRET_PREVIOUS` **ausente** nos dois.
4. Código de produção (`main@4ea73f5`, `route.ts:18–29`): aceita `CRON_SECRET` e, só se existir,
   `CRON_SECRET_PREVIOUS`. Como o anterior está ausente, só o valor corrente é aceito; o valor
   pré-incidente e o de 19:16 são recusados. O candidato nem lê `CRON_SECRET_PREVIOUS`.
5. Sem credencial: 401 (verificado 02:46).
6. Chamadores inventariados (§4): nenhum chamador HTTP ativo além do script manual.

## 4. Chamadores do cron

| Chamador | Estado (observado 2026-11-14/15) |
|---|---|
| Vercel | conta do dono só tem o time "RARE DEPT" (Hobby): **0 projetos, 0 deployments** (time e escopo pessoal, API do painel e UI). O projeto `prj_9C4c…` de `.vercel/repo.json` não existe mais; `/rare-dept/rare` → 404. **VERCEL_CRON_ACTIVE = NO.** Nenhuma ação tomada. |
| Railway `rare-cron` (produção) | `npm run checkout:worker`, sem `cronSchedule`, restart ALWAYS, SUCCESS em `4ea73f5`. Worker persistente; não chama HTTP. **Owner primário.** |
| Railway `rare` / Redis / Postgres (produção) | sem `cronSchedule` |
| Railway staging (`rare-staging`, `rare-checkout-worker-staging`) | sem `cronSchedule` |
| GitHub Actions | só `.github/workflows/pr-ci.yml`; nenhum `schedule` |
| `npm run cron:release-expired` | manual (`scripts/call-release-expired-cron.mjs`); sem agendamento |
| Outros | nenhum outro agendador conhecido; `vercel.json` ainda descreve o cron legado, mas não há projeto Vercel para executá-lo |

**PRIMARY OWNER: Railway persistent checkout worker (`rare-cron`). HTTP cron caller: NONE.**

## 5. Asaas Sandbox real

Staging real, conta Sandbox aprovada, webhook real:
- Pix criado, pago por evento real, estornado pelo Admin com autorização crítica → Reembolsado
  (`CLAUDE_PREPROD_REVIEW.md` §9).
- Cartão na fatura hospedada (cartão de teste e reCAPTCHA pelo operador) → webhook → Pago; estorno
  pelo Admin → Reembolsado (§9).
- Retorno automático da fatura para `/minha-conta/pedidos/<id>` com Pago só via webhook
  (`RARE-20261114-BYCPRK`, §16.5, commit `a91a05a`).
- Replay de evento real → duplicate, 1 linha de inbox, 1 venda; entrega controlada de evento antigo
  não regrediu o pedido (não é emissão fora de ordem pelo Asaas); valor divergente real não pagou o
  pedido; corrida de estoque com 5 clientes → 1 venda; expiração natural → 1 liberação
  (`docs/cycles/rare-bf-mfa-asaas/cycles/CYCLE-FINAL-RELEASE-01.md`, 2026-11-13).

## 6. Staging real

Já provado no staging real: RBAC SYSTEM_ADMIN e SELLER_ADMIN (UI, URL, API, Server Action), Resend
real, suporte, Asaas (§5), vitrine em Chromium/Firefox/WebKit, cookies/analytics, estoque, CI e
web = worker = SHA (`CLAUDE_PREPROD_REVIEW.md` §11 e §16). **Pendente:** Admin responsivo/teclado em
WebKit no staging real (MEDIUM-2). No lab o Admin WebKit fechou 20/20 (`985dd30`), mas a condição
exige o staging real.

## 7. Flag de ambiente

`RELEASE_SECURITY_FREEZE` está **ausente** em `rare` e `rare-cron` de produção (lida só por nome).
Não ativa o freeze; nada a remover no release.

## 8. Teste do guard

Ver `CLAUDE_PREPROD_REVIEW.md` §17 (registro ACTIVE: produção bloqueada; casos fail-closed).
