# 15 — Ações manuais

| # | Tipo | O que fazer | Bloqueia |
|---|---|---|---|
| M-01 | MANUAL | Dar acesso ao projeto RARE no Railway (MCP/CLI desta máquina estão em outro workspace) ou publicar staging você mesmo | staging, tudo depois |
| M-02 | EXTERNAL | Criar conta Sandbox Asaas, gerar chave `$aact_hmlg_`, cadastrar chave Pix no Sandbox | Asaas Sandbox |
| M-03 | MANUAL | Gerar `ADMIN_MFA_ENCRYPTION_KEY` distinta para staging e produção (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`); guardar no cofre de senhas | deploy de produção |
| M-04 | MANUAL | Executar o roteiro 12_STAGING e registrar PASS/FAIL | merge |
| M-05 | MANUAL | Testes adversariais §28 contra staging | produção |
| M-06 | BUSINESS DECISION | Black Friday: produtos/categorias, % ou valor, datas, banner, texto do subtítulo e CTA | Black Friday |
| M-07 | BUSINESS DECISION | Parcelamento no cartão (taxas da conta Asaas, número de parcelas) — hoje à vista | — (futuro) |
| M-08 | BUSINESS DECISION | Manter ou remover o Pix do Mercado Pago junto com o Stripe | remoção do Stripe |
| M-09 | BUSINESS DECISION | Segundo administrador com MFA | recomendado antes do MFA em produção |
| M-10 | EXTERNAL | Conta Asaas de produção aprovada, chave `$aact_prod_`, webhook de produção com token novo; lembrar que chave sem uso por 3 meses é desativada | Asaas produção |
| M-11 | MANUAL | Domínio da loja configurado no Asaas se quiser redirecionar após cartão (`ASAAS_SUCCESS_REDIRECT=true`) | opcional |
| M-12 | MANUAL | Backup do banco antes do deploy de produção | produção |
| M-13 | MANUAL | Revisar visual/mobile/acessibilidade das telas novas em navegador real | Black Friday |
| M-14 | MANUAL | Resolver conflito com a linha de redesign `codex/backend-evolution-20261007` | merge |
| M-15 | MANUAL | Push da branch `cycle/rare-bf-mfa-asaas-01` e abertura do PR (não feito: aguardando seu OK) | merge |
