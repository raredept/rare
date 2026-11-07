# 15 — Ações manuais

Atualizado no CYCLE-04 (2026-11-07). "Lab" = laboratório local staging-like (`npm run qa:staging-lab`), que não substitui staging.

| # | Tipo | O que fazer | Bloqueia | Estado |
|---|---|---|---|---|
| M-01 | MANUAL | Dar a esta máquina acesso ao projeto **Rare** no Railway (convidar a conta do Railway CLI ou fazer `railway login` com a conta da RARE). Hoje: CLI `Unauthorized`, conector só vê o workspace da DuraPets, nenhum dos 4 Chromes abre o projeto | staging, tudo depois | **ABERTO** (reconfirmado no CYCLE-04) |
| M-02 | EXTERNAL | Criar conta Sandbox Asaas, gerar chave `$aact_hmlg_`, cadastrar chave Pix no Sandbox | Asaas Sandbox | ABERTO |
| M-03 | MANUAL | Gerar `ADMIN_MFA_ENCRYPTION_KEY` distinta para staging e produção (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), diferente de `ADMIN_SESSION_SECRET`/`AUTH_SECRET`; guardar no cofre; configurar no web **e** no worker | staging (MFA) e deploy de produção | ABERTO |
| M-04 | MANUAL | Executar o roteiro 12_STAGING e registrar PASS/FAIL | merge | ABERTO (lab equivalente PASS) |
| M-05 | MANUAL | Testes adversariais contra o domínio de staging (incluindo Cloudflare/headers reais) | produção | ABERTO (lab PASS) |
| M-06 | BUSINESS DECISION | Black Friday: produtos/categorias, % ou valor, datas, banner, subtítulo e CTA | Black Friday | ABERTO |
| M-07 | BUSINESS DECISION | Parcelamento no cartão (taxas da conta Asaas, número de parcelas) — hoje à vista | — (futuro) | ABERTO |
| M-08 | BUSINESS DECISION | Manter ou remover o Pix do Mercado Pago junto com o Stripe | remoção do Stripe | ABERTO |
| M-09 | BUSINESS DECISION | Segundo administrador com MFA em staging e produção | recomendado antes do MFA em produção | lab PASS (2 Admins + reset); staging ABERTO |
| M-10 | EXTERNAL | Conta Asaas de produção aprovada, chave `$aact_prod_`, webhook de produção com token novo; chave sem uso por 3 meses é desativada | Asaas produção | ABERTO |
| M-11 | MANUAL | Domínio da loja configurado no Asaas se quiser voltar à loja após o cartão (`ASAAS_SUCCESS_REDIRECT=true`; o retorno vai para `/minha-conta/pedidos/[id]`) | opcional | ABERTO |
| M-12 | MANUAL | Backup do banco antes das migrations de staging (se o plano permitir) e obrigatoriamente antes de produção | produção | ABERTO |
| M-13 | MANUAL | Revisão visual/mobile/acessibilidade com dados reais de staging | Black Friday | lab PASS (10 larguras × 12 telas, axe, Chromium + WebKit); staging ABERTO |
| M-14 | MANUAL | Resolver conflito com a linha de redesign `codex/backend-evolution-20261007` (fora deste ciclo) | merge | ABERTO |
| M-15 | FEITO | Push da branch e Draft PR https://github.com/raredept/rare/pull/2 | — | FEITO |
| M-16 | MANUAL | Apontar **web e worker** do staging para a branch `cycle/rare-bf-mfa-asaas-01` (as últimas fontes conhecidas eram branches antigas) e provar o SHA depois do deploy (o `/api/health` público não expõe SHA) | staging | ABERTO |
| M-17 | MANUAL | Variáveis de staging (web **e** worker), sem imprimir valores: `ADMIN_MFA_ENCRYPTION_KEY` (M-03), `ADMIN_MFA_REQUIRED=true`, `PAYMENT_PROVIDER=asaas`, `ASAAS_ENV=sandbox`, `ASAAS_API_KEY=$aact_hmlg_…` (M-02), `ASAAS_WEBHOOK_TOKEN` (32–255 caracteres aleatórios, diferente da chave e dos segredos de sessão), `ASAAS_PAYMENT_METHODS=pix,card`, `PROMOTIONS_ENABLED=true`, `BLACK_FRIDAY_HOME_ENABLED=true` | staging | ABERTO |
| M-18 | MANUAL | Webhook no painel Sandbox do Asaas: `https://rare-staging-staging.up.railway.app/api/asaas/webhook` (confirmar o domínio no Railway), token = `ASAAS_WEBHOOK_TOKEN` de staging, eventos listados em 12_STAGING | webhook real | ABERTO |
| M-19 | MANUAL | Instalar o Firefox do Playwright nesta máquina (`npx playwright install firefox`) para cobrir Firefox | E2E Firefox | ABERTO |
