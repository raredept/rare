# CYCLE-03 — Publicação e revisão do PR (2026-11-06)

Branch publicada em `origin/cycle/rare-bf-mfa-asaas-01` e aberta como **Draft PR** para `main`: https://github.com/raredept/rare/pull/2. Sem merge, sem deploy, sem flags de produção, sem migrations fora do PostgreSQL local, sem cobranças.

## Revisão do diff completo `main...cycle/rare-bf-mfa-asaas-01`

| # | Sev. | Achado | Correção | Commit |
|---|---|---|---|---|
| 1 | Low | Com `PAYMENT_PROVIDER=asaas` a vitrine ainda citava Stripe ("crédito ou débito") e Mercado Pago, anunciava 15 min para cartão (servidor reserva 30 no Asaas) e o redirect pós-cartão (`ASAAS_SUCCESS_REDIRECT=true`) caía em `/pedido/sucesso`, que só entende sessão Stripe | texto segue o provedor; página do Pix usa o provedor do próprio pedido; retorno do Asaas vai para `/minha-conta/pedidos/[id]` (autenticado, escopado ao cliente); testes de regressão | `a962402` |
| 2 | Info | Fixtures de teste com formato de chave Asaas real (`$aact_prod_`/`$aact_hmlg_` + base64), falsas mas no formato que scanners procuram | chaves montadas em tempo de execução | `c7ddf73` |

Verificado sem achados: secrets, arquivos temporários/`output/`, `console.*`/`debugger`/`.only`, bypass de MFA, rotas/actions Admin sem `requireAdmin`/`getCurrentAdmin`, cookie pendente acessando API, regressão do Stripe com `PAYMENT_PROVIDER` vazio, mistura Sandbox/Production, migrations destrutivas, preço vindo do browser, webhook sem idempotência, dados sensíveis em logs.

Risco residual: o primeiro cadastro de MFA de um admin legado acontece após a senha (TOFU). Cadastrar os admins logo após o deploy e ter um segundo admin com MFA (M-09).

## Gates (commit `c7ddf73`)

tsc PASS · eslint PASS · vitest 164 arquivos / 1464 testes PASS · build PASS · release guard 6 OK / 1 WARNING pré-existente / 0 FAIL · `npm audit --omit=dev` 0 (avisos só em dev deps: vitest mocker, basic-ftp via lighthouse, brace-expansion). QA em PostgreSQL real (`qa:bf-asaas`, `qa:checkout-concurrency`) não reexecutado: as correções não tocam banco nem regras de estoque.
