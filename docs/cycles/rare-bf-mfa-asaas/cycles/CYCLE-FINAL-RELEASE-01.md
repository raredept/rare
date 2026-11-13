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

Checkpoint posterior de 2026-11-13:

- Web e worker **SUCCESS no mesmo SHA `0e605d63a163be318b33197e32ad0426dd347e7d`**;
  CI desse SHA (`43486038899`) PASS. Sources permanentes na branch do PR, aguardam CI.
- Configuração aplicada e relida nos dois serviços: Asaas/Sandbox, chave com prefixo
  correto, MFA obrigatório/chave 32 bytes, sessão e cron novos, token de webhook
  independente, ausência de `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e
  `CRON_SECRET_PREVIOUS`. Checkout fechado. Carregamento do token de webhook
  comprovado por HTTP: ausente 401, errado 401, correto 200.
- Cookie Admin QA assinado com o segredo de sessão antigo: **401** no endpoint
  protegido. Nenhuma chamada autenticada ao cron mutável foi usada como teste.
- Schema real: `prisma migrate status` atualizado e `migrate diff` **sem diferenças**.
  **M-21 CLOSED** para este snapshot/candidato: banco identificado, backup anterior
  restaurável, histórico e schema verificados, migrations aditivas aplicadas.
- **MFA/Admin Chromium em staging real: 8/8 PASS**, com contas QA novas e sintéticas:
  anônimo, cliente, pending, enrollment, TOTP errado/replay, recovery code único,
  logout/cookie copiado, rate limit, segundo Admin/reset e redirects hostis.
  Traces, vídeo, screenshots e snapshots automáticos do MFA desativados.
- Conta Sandbox com status geral APPROVED; chave Pix EVP criada e ACTIVE, sem
  divulgar seu valor. Webhook real cadastrado com 13 eventos tratados e endpoint
  staging. Cadastro/auth não equivalem à entrega real de evento, ainda pendente.
- Revisão adicional reproduziu falha de vínculo de cliente na conciliação Asaas:
  payment/order/reference eram verificados, mas o customer podia divergir.
  Agora o mapeamento persistido é obrigatório antes de qualquer alteração de pedido,
  estoque ou estado. Seis regressões falharam antes e passaram após a correção;
  targeted 50/50, unit 177 arquivos/1624 testes, TypeScript, lint, build, audit e
  release guard PASS. QA PostgreSQL BF/Asaas: 8/8 PASS (provider simulado).
  Essa correção ainda precisa de deploy e prova Sandbox real.

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

## Checkpoint real — 2026-11-13, contenção e primeiro Pix

- MFA/Admin em staging: **Chromium 8/8, Firefox 8/8, WebKit 8/8 PASS**.
  Contas sintéticas independentes; nenhuma evidência sensível de MFA salva.
- `c93f2f4` passou no CI (`43487504557`) e em web/worker de staging.
  Checkout Sandbox ativado atrás do gate de staging, com e-mails desabilitados.
  Fixtures próprias; frete fixo QA de R$ 20, com configuração anterior preservada
  para restauração. Nenhum preço comercial de produção alterado.
- Primeiro checkout real enviou R$ 1 no browser; banco e Asaas receberam
  **R$ 150 + R$ 20 = R$ 170**. Cupom RARE10 não acumulou desconto automático.
  Customer Sandbox criado e mapeado. Cobrança PENDING, pedido não marcado pago.
- **Finding real:** Asaas devolveu ID no formato `pay_0_...`; o parser aceitava
  somente sufixo alfanumérico. Criação ficou com resultado incerto e o webhook
  PAYMENT_CREATED real chegou, mas foi ignorado por perder o paymentId no parser.
  Corrigido o mesmo allowlist usado por leitura, Pix, refund, delete, recuperação
  por referência e inbox; barras, percent encoding e query continuam rejeitados.
  Três regressões falharam antes; targeted 78/78 e unit 177 arquivos/1627 PASS
  depois. TypeScript, lint, build, release guard, audit e QA PostgreSQL 8/8 PASS.
  A cobrança existente será revalidada após o novo deploy, sem retry cego de criação.
- Backup próprio de produção criado antes da contenção: 107490 bytes, SHA-256
  `7e69a26fdf31b600871525fb3ad9782fc46f1b38dc5d2bdfc010a61e602aab92`.
  Cópia fora do Git; restore local isolado PASS. Histórico: 14 aplicadas, 0 falhas,
  drift anterior zero; ensaio local das quatro aditivas e drift posterior PASS.
- Produção: rotação independente de sessão/cron, MFA encryption key própria
  configurada para o futuro release, credenciais Stripe removidas de web/worker,
  CHECKOUT_ENABLED=false e PAYMENT_PROVIDER=disabled relidos. Deploy de contenção
  manteve **main @ 4ea73f5**, sem merge nem código novo do PR.
- **Configuração efetiva:** o `preDeployCommand: []` preparado no Dashboard foi
  sobreposto pelo `railway.json` antigo no web. O comando efetivo verificou as 14
  migrations e registrou **No pending migrations to apply**; nenhuma migration
  nova foi aplicada em produção. Não tratar configuração armazenada como prova
  de configuração efetiva. Rejeição de sessões antigas e smoke ainda em verificação.

Freeze permanece ACTIVE; Sandbox lifecycle, E2E comercial/promotions e reauditoria
final ainda não passaram. Revogação Stripe externa continua MANUAL_PENDING.

### Reteste Sandbox e expiração

- `54e0ac8`: CI PASS (`43491473147`), web/worker SUCCESS no mesmo SHA.
  Nova criação Pix HTTP 200, dados Pix persistidos e retorno para a RARE.
- Cobrança original de criação incerta foi recuperada pelo webhook real
  PAYMENT_RECEIVED: pedido paid, total R$ 170 e uma única movimentação de venda.
- Outra cobrança Sandbox com referência desse pedido, mas cliente diferente,
  gerou PAYMENT_CREATED e PAYMENT_RECEIVED reais. Ambos processados como
  PAYMENT_MISMATCH; pedido seguiu awaiting_payment sem vínculo errado nem baixa.
  Só o evento da cobrança legítima o pagou depois.
- Revisão encontrou gaps no worker de expiração: cliente não conferido antes de
  DELETE, resultado payment_mismatch tratado como job pago e identidade perdida
  na resposta 404 após cancelamento. Três regressões reproduziram as falhas.
  Correção confere cliente antes do provider, preserva identidade do vínculo
  persistido no 404, mantém retry quando a aplicação rejeita o pagamento e não
  libera reserva quando a busca retorna múltiplas cobranças ainda ativas.
- Após correção: TypeScript/lint/build/audit/guard PASS, unit **177/1631**,
  QA PostgreSQL BF/Asaas 8/8 (transporte simulado). Deploy/reteste real pendentes.
- Produção: segredo de sessão antigo recusado para Admin (401) e cliente
  (307 para /entrar); controles com segredo novo passam autenticação (400 de
  validação no GET sem parâmetros e 200 na conta, respectivamente). Não foi
  login humano. Logs recentes de web/worker nos dois ambientes: zero matches
  dos segredos conhecidos/padrões de credencial; isso não é auditoria histórica
  de uso indevido no provedor Stripe.

### Checkpoint — matriz real e histórico de promoções (2026-11-13)

- `4a9ccf6`: CI `43493063221` PASS; web e worker SUCCESS no mesmo SHA.
  Health 200, banco OK e configuração sem erros. Migrations continuam completas.
- Corrida Sandbox: cinco clientes sintéticos, uma unidade promocional, um checkout
  HTTP 200 e quatro recusas por estoque. Provider recebeu R$ 170; webhook real
  RECEIVED pagou o vencedor, estoque 0/reservado 0, uma reserva e uma venda.
- Replay de evento real: HTTP 200/duplicate, uma linha de inbox e uma venda.
  Entrega controlada de CONFIRMED antigo consultou o RECEIVED real no provider;
  não regrediu o pedido. Isso não é emissão fora de ordem pelo próprio Asaas.
- Valor divergente real: cobrança alterada para R$ 169 no Sandbox e recebida;
  pedido de R$ 170 não pago. Depois do prazo, o worker permanece em retry com
  SESSION_ORDER_MISMATCH, sem concluir falsamente nem liberar estoque.
- Expiração natural de outro pedido QA: uma tentativa do worker, cobrança
  deleted=true no Asaas, pedido cancelado, uma única liberação e job completed.
- Estorno pelo Admin: uma solicitação/auditoria, mesmo após replay da ação;
  provider mantém um refund AWAITING_CRITICAL_ACTION_AUTHORIZATION. Autorização
  Sandbox e webhook final ainda pendentes. Estoque não foi reposto automaticamente.
- Checkout/Pix/pedido/webhook em Chromium, Firefox e WebKit: 3 PASS por browser;
  cenário de provider desconhecido não executado nesta configuração Asaas.
  Ampliação da matriz inclui Pix/pedido em dez larguras e axe (em execução).
  Fixtures concorrentes devem usar clientes separados: iniciar outro checkout
  do mesmo cliente encerra corretamente o anterior, mesmo antes dos 30 minutos.
- Promoções reais: validação/XSS/mass assignment, preview, ativação, edição,
  pausa/Origin/sessões e janela agendada passaram. Responsividade revelou
  overflow do actorLabel longo no histórico: 412 px em viewport de 320 px.
  Correção permite quebra de texto; fixture local usa e-mail longo para manter
  a regressão coberta. Reteste publicado ainda necessário.
- Após correção: TypeScript, lint, unit 177/1631, build, release guard (6 OK,
  2 warnings, 0 FAIL), audit runtime 0 e QA PostgreSQL 8/8 PASS.
- Cartão hospedado abriu no Sandbox por R$ 170; a tentativa automatizada recebeu
  erro do provider com recaptchaV2Enabled. Não houve confirmação nem prova de
  retorno. Controle nativo interrompido por não conseguir confirmar a URL;
  cartão permanece BLOCKED_EXTERNAL, sem tentativa de contornar reCAPTCHA.

PR continua Draft, freeze ACTIVE e staging PARTIAL. Nenhum merge ou deploy de
funcionalidades do PR em produção. Autorizações Sandbox, matriz completa e
reauditoria final permanecem gates reais.
