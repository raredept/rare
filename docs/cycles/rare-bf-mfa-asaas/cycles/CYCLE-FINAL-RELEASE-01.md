# RARE-FINAL-RELEASE-01 — execução em andamento

Data operacional: 2026-11-13 (America/Sao_Paulo). Base do trabalho: PR #2, Draft,
head remoto inicial `b30599ce30d6d33a6a839f5948bb3b45396383b7`, main
`4ea73f50cafdbf67e16dc71de985052075feca42`. Nenhum merge ou deploy de produção.

## Política autorizada e correções

- Novos pagamentos exigem seleção explícita de Asaas. Ausência de provider,
  `stripe`, `disabled` e valores desconhecidos recusam checkout antes de reservar
  estoque ou chamar um provedor. Stripe permanece apenas para reconciliação histórica.
- Rollback: `CHECKOUT_ENABLED=false`, `PAYMENT_PROVIDER=disabled`. Não restaurar
  credenciais comprometidas por rollback de deployment.
- O cron recusa `CRON_SECRET_PREVIOUS`; só o segredo corrente é aceito.
- Readiness e evidências operacionais passam a exigir Asaas Sandbox e webhook
  Asaas. Evidência histórica Stripe não satisfaz esses gates.
- Política de freeze v2 exige contenção interna nos dois ambientes, remoção das
  credenciais Stripe dos consumers ativos, ausência de novos pagamentos/fallback,
  staging e Sandbox reais aprovados, e produção inicialmente com checkout fechado.
  Revogação externa Stripe pode permanecer `MANUAL_PENDING`, sem ser declarada feita.
  O registro real permanece **ACTIVE**, com todos os gates externos ainda falsos.
- Atualização transitiva do lockfile eliminou os dois alertas baixos do audit.
- Revisão posterior reproduziu dois problemas adicionais: o CLI de readiness
  ainda dizia que Stripe estava configurado; e o webhook media caracteres após
  carregar o corpo inteiro, aceitando mais de 64 KiB com texto UTF-8 multibyte.
  Corrigidos com diagnóstico Asaas/fail-closed e leitura limitada por bytes.
  Regressões: CLI em quatro providers e webhook multibyte/stream interrompido.

## Railway e Asaas — evidência real

Projeto `Rare`, environment `staging`, verificado na UI SkyLab e por
`RAILWAY_ENVIRONMENT_NAME` no console do PostgreSQL.

| Recurso | Identidade |
|---|---|
| Project | `72ed12be-9a2a-4e13-8594-30ffd8ffa565` |
| Environment | `d8399691-dacf-41e9-a9d5-060c97672e39` |
| Web | `rare-staging`, `3f4b79f6-2819-45a6-986d-584dc7ac803a` |
| Worker | `rare-checkout-worker-staging`, `2bfcf6af-11f4-459f-9089-a841ae25e57f` |
| PostgreSQL | `Postgres-MlyZ`, `ed0a374e-79da-4aab-9e3a-bb684fb829d1` |
| Redis | `Redis-w0Fa`, `6f6d7a25-00aa-44ba-9c52-92c194a0a082` |
| Staging domain | `rare-staging-staging.up.railway.app` |

Web ainda usa `integration/pre-go-live`. O executor observado é
`PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy`, sem arquivo
config-as-code selecionado. Precisa ser alinhado ao guard e à branch do PR antes
do deploy candidato. Source/SHA do worker e SHA completo do web ainda pendentes.

Depois da auditoria do backup, ficaram **preparadas, sem aplicar deploy**, alterações
do web: branch `cycle/rare-bf-mfa-asaas-01`, pre-deploy incluindo o freeze guard e
`ADMIN_MFA_ENCRYPTION_KEY` gerada com 32 bytes aleatórios independentes. Presença da
variável e alterações pendentes confirmadas na UI; carregamento pelo runtime não
comprovado. Sessão/cron, token do webhook e worker ainda precisam de configuração.
O CLI autenticado nesta máquina continua sem acesso ao projeto Rare (consulta
somente leitura recusada); solicitado login pela conta do perfil SkyLab, sem tokens
no chat. Produção não alterada.

Conta Asaas Sandbox criada, confirmação de email e SMS concluídas pelo proprietário.
Chave Sandbox emitida e transferida diretamente à variável `ASAAS_API_KEY` do web
staging; prefixo Sandbox confirmado sem divulgar valor. Sem teste de API ou cobrança
Sandbox ainda. Worker, token do webhook e configuração final continuam pendentes.

O proprietário acionou o deploy da alteração de variável durante uma interrupção.
O build ainda usava o código antigo. Foi abortado enquanto estava em BUILDING e
passou a REMOVED; o deployment antigo continuou ACTIVE. Isso não é deploy do PR,
nem prova de aplicação de migrations ou de carregamento da chave no processo ativo.

## Backup e auditoria M-21

Snapshots indisponíveis no plano atual (UI exige upgrade para Pro); nenhum snapshot
existente. Criado backup lógico no console do Postgres de staging com `umask 077`,
`pg_dump -Fc`, usando as variáveis internas da própria conexão. Retorno zero.

- Arquivo: `rare-staging-pre-release-20261113.dump`.
- Criação: 2026-11-13 17:52:10 UTC / 14:52:10 America/Sao_Paulo.
- Volume: `/var/lib/postgresql/data/rare-staging-pre-release-20261113.dump`.
- Cópia baixada fora do repositório, em Downloads do proprietário: 104450 bytes.
- SHA-256 da cópia local: `b749cfd4c65da37ddaf063ae358c0045b53334d187b17b951b138a5daf97ee50`.
- Formato custom 1.16, 143 entradas; origem PostgreSQL/pg_dump 18.6.
- Leitura por pg_restore PASS. Restauração em PostgreSQL 17 local isolado PASS.
- Histórico do snapshot: **15 APPLIED / 3 PENDING**, zero failed, rolled-back,
  checksum mismatch, migrations extras ou anomalias.
- Drift do snapshot contra as 15 migrations aplicadas: **nenhuma diferença**.
- Ensaio das três migrations pendentes na cópia local: **PASS**.
- Status após ensaio: schema atualizado; drift contra schema do candidato: zero.
- Nove consultas de integridade na cópia restaurada após ensaio: zero anomalias.

Pendentes no staging real: `20261106120000_admin_mfa_audit`,
`20261106130000_promotions`, `20261106140000_asaas_payments`.
Este ensaio não aplicou migrations no staging. Revalidar o histórico se o banco
ou o código mudarem antes do deploy. Dados do backup não entram no Git ou relatório.

## Validação local desta execução

| Gate | Resultado |
|---|---|
| npm ci / build standalone | PASS; 35 Server Actions verificadas |
| TypeScript / lint | PASS |
| Unit | PASS: 177 arquivos, 1618 testes após correção do limite do webhook |
| npm audit --omit=dev | PASS: zero vulnerabilidades |
| PostgreSQL QA Asaas/BF | PASS: 8 provas, transporte simulado |
| PostgreSQL QA reconciliação | PASS: 13 provas, novas cobranças Stripe recusadas, zero chamadas externas |
| Lab Chromium | PASS: Asaas 24, desconhecido 2, Stripe desativado 2 |
| Logs/integridade Chromium | zero vazamentos em 67 valores verificados; zero anomalias |
| Lab WebKit | PASS: 24 + 2 + 2; matriz 320–1920 e axe PASS; regressão de pagamentos repetida após rebuild: 3 + 2 + 2 PASS |
| Lab Firefox | PASS: 24 + 2 + 2, incluindo limite UTF-8 do webhook, MFA, promoções, responsividade e axe |
| Pagamentos Chromium após rebuild | PASS: 3 + 2 + 2, incluindo limite UTF-8 e ausência de persistência do evento rejeitado |
| Logs/integridade das rodadas finais | zero vazamentos detectados; nove contagens de integridade zeradas |
| Release guard | PASS: 6 OK, 2 WARNING (cron Vercel histórico e freeze ACTIVE), zero FAIL |
| CLI de readiness | Regressão reproduzida antes da correção; 4/4 PASS após (unset/stripe/unknown/asaas) |
| Webhook limitado por bytes | Regressão reproduzida (200 em vez de 413); testes direcionados 18/18 PASS após |

Commit `06a5994b676d5bc79125a379e1fdb3aabc3c3ef6` publicado, PR mantido Draft e
descrição atualizada. CI GitHub run `43478479815` PASS nesse commit. Correções
posteriores de readiness/webhook publicadas em `23f2a6039cbd0ad16bdb6d822f993293969ef22a`:
CI run `43481118153` PASS, incluindo build. Build local atualizado PASS; Firefox completo
e regressões de pagamentos Chromium/WebKit concluídos sequencialmente, sem sobreposição.

## Avanço real após autenticação do CLI

- Acesso ao projeto Rare confirmado pela conta do workspace correto. O bloqueio de
  autenticação do CLI descrito acima foi resolvido pelo proprietário.
- Web publicou `23f2a6039cbd0ad16bdb6d822f993293969ef22a` (deployment
  `8c816911-42e0-4194-8dd0-2c5afe4d1d62`); worker ainda em
  `f15e5b670c6627088bb2c072df30cf1cffea3597`, `integration/pre-go-live`.
- Auditoria oficial contra o banco **real** de staging, em transação READ ONLY:
  **18 APPLIED / 0 PENDING / 0 FAILED / 0 ROLLED_BACK / 0 CHECKSUM_MISMATCH /
  0 EXTRA**. Checksums correspondem à variante LF do Git; CRLF local não é drift.
- Primeira chamada real e somente leitura ao Asaas Sandbox: HTTPS e autenticação
  **PASS (HTTP 200)**. Não houve cobrança nesta verificação.
- Preparado patch único, ainda sem commit/deploy neste checkpoint, para web e worker:
  branch candidata, CI obrigatório, Asaas Sandbox, MFA, segredos novos independentes
  para sessão/cron/webhook, remoção de credenciais Stripe e checkout fechado.
  Somente o web executa migrations; worker inicia com o freeze guard.
- Produção foi inventariada somente para leitura: web e worker em `main @ 4ea73f5`.
  Nenhuma variável, migration ou deployment de produção alterado.

Testes locais e transporte simulado não satisfazem Sandbox real, MFA em staging,
webhook real, mobile/a11y no domínio de staging ou os gates do freeze.

## Gates restantes

1. Conter sessões/cron em staging e produção; provar rejeição dos segredos antigos.
2. Remover credenciais Stripe dos consumers ativos e comprovar checkout fechado.
3. Alinhar web/worker à branch candidata, guard, variáveis e secrets independentes.
4. Aplicar migrations em staging, validar web/worker SHA, health e readiness.
5. Homologar MFA, Admin, promoções/BF QA, preço/estoque, Asaas Sandbox e webhook real.
6. E2E dos três browsers, responsividade 320–1920, acessibilidade e revisão de logs em staging.
7. CI do head final, revisão do diff completo e reauditoria independente.
8. Só então considerar merge e produção segura, com backup próprio e checkout fechado.
9. Revogação Stripe externa e revisão de uso indevido seguem MANUAL_PENDING.
10. Asaas Production, piloto financeiro humano e campanha comercial seguem pendentes.

STAGING: PARTIAL. MERGE READY: NÃO. PRODUCTION READY: NÃO. PR: DRAFT.
