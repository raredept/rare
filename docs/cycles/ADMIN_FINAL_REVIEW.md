# RARE — Final Admin Review

Data: 2026-10-03. Branch: `codex/admin-dashboard-reconciled-20261002`.
Base conferida: `4ea73f50cafdbf67e16dc71de985052075feca42`.
Backup anterior à revisão: `backup/admin-final-pre-review` em `20e5461`.
Este relatório complementa `ADMIN_MAIN_RECONCILIATION.md`; não comprova produção.

## Achados e correções

| ID | Prioridade | Evidência / impacto | Correção |
| --- | --- | --- | --- |
| FR-01 | P2 | Upload lia multipart sem limite real; push lia JSON sem limite/quota. Cliente podia omitir ou mentir Content-Length e consumir memória. | Leitura limitada antes de parsing, cancelamento do stream, 413, content type explícito; push POST/DELETE com quota por Admin. |
| FR-02 | P2 | `q=a&q=b` causava TypeError em produtos/clientes; category repetida também não era validada. | Tipos reais de searchParams; arrays ignorados, texto limitado a 100 caracteres e página repetida normalizada para 1. |
| FR-03 | P2 | Clientes/pedidos ordenados só por createdAt, permitindo empates e inconsistência entre páginas. | Desempate por ID; limites 25/50 preservados, com regressões unitárias. |
| FR-04 | P2 | Conteúdo válido longo causou 439 px de overflow no Dashboard e 846 px de clipping interno em produtos a 320 px; Prontidão também estourava. | Wrapping/min-width/trilhas flexíveis, painel de pedidos recentes empilhado até 2xl; fixture descartável e assertion de clipping, sem esconder dados. |

Referências: FR-01 `src/app/api/admin/uploads/route.ts:48` e
`src/app/api/admin/push-subscriptions/route.ts:47`; FR-02
`src/app/admin/(protected)/products/page.tsx:25`; FR-03
`src/app/admin/(protected)/customers/page.tsx:46` e `orders/page.tsx:65`; FR-04
`products/page.tsx:125`, `page.tsx:103` e `readiness/page.tsx:132` sob o mesmo
diretório protected. Regressão em `tests/e2e/admin-responsive.spec.ts:24`.
Testes novos reproduziram as falhas antes
das correções. As skills de segurança, PostgreSQL, storefront e Playwright
orientaram limites de payload, ordenação, wrapping e assertions geométricas.

## Autorização e mutações

Todas as actions abaixo chamam `requireAdmin()` antes de dados/mutações. A função
confere assinatura/expiração, credentialVersion, sessionVersion, conta ativa,
role ADMIN e troca obrigatória de senha no servidor. Origin/Host é conferido pelo
Next nas Server Actions; APIs mutáveis exigem same-origin explicitamente.

| Arquivo de actions | Exports revisados | Validação e efeitos |
| --- | --- | --- |
| banners | createBanner, updateBanner, toggleBannerActive, deleteBanner, moveBannerUp, moveBannerDown (sufixo Action) | ID limitado, campos selecionados/schema; exclusão/reordenação transacionais, sem mass assignment. |
| categories | saveCategory, deleteCategory, toggleCategoryActive (Action) | ID, schema e conflito de slug; update/create selecionam campos; exclusão preserva regras FK. |
| products | saveProduct, toggleProductActive, deleteProduct (Action) | ID/schema/mídia, transação e snapshots de pedidos preservados. |
| orders | updateOrderStatusAction | Enum manual restrito; serviço transacional de transições/reservas, sem simular aprovação Stripe. |
| notifications | markAllAdminNotificationsReadAction, markAdminNotificationReadAction | ID individual validado; marcar todas é operação administrativa explícita. |
| settings | saveSettingsAction | Allowlist/schema, feedback controlado e chave store fixa; não escreve commerce flags. |

Não foi encontrado bypass novo de auth, revogação, primeiro acesso, CSRF ou
mass assignment. APIs editor/presign continuam protegidas; editor já limita bytes
reais e presign permanece 410. IDs/redirecionamentos ficam em rotas internas.
Não houve alteração de regras comerciais, schema ou migrations.

Segunda leitura do diff completo concluída após o gate verde, incluindo testes,
lockfile, configuração e relatórios históricos. Sem novo achado bloqueante,
TODO/FIXME/HACK, ts-ignore, any inseguro ou código morto introduzido. Os dois
console.log novos são marcadores sem dados sensíveis de scripts QA, não da app.
Sem refactor cosmético adicional. `git diff --check` passou.

## Gate final

| Gate | Resultado nesta sessão |
| --- | --- |
| Install | PASS, npm ci; lockfile reproduzido |
| Lint / TypeScript | PASS |
| Unit/integration | PASS, 147 arquivos / 1.133 testes |
| Admin/auth | PASS, seleção explícita de 21 arquivos / 139 testes, três execuções consecutivas |
| Admin provisioning | PASS, qa:admin-access em dois bancos descartáveis; admin existente e nova senha preservados |
| Prisma validate / generate | PASS, 7.9.1 |
| Migrations QA / SQL real | PASS, 14 migrations no banco descartável e três ciclos de contratos por execução |
| E2E completo | PASS, 178 / 62 skips / 0 flaky / 0 unexpected; 405,6 s |
| Admin accessibility | PASS, 54 testes nos três projetos |
| Responsive / drawer | PASS, oito larguras e onze rotas, clipping interno, Tab/Shift+Tab/Escape/resize/scroll/foco/navegação e Axe |
| Build realmente limpo | PASS, cache esvaziado para backup por movimentos atômicos; standalone/assets e 28 Server Actions conferidos |
| Release guard / secret scan | PASS, 6 OK / 1 warning cron / 0 FAIL |
| App readiness local | PASS sem bloqueios técnicos, com avisos operacionais |
| rare_dev / shadow | Não alterados; db:check retorna erro esperado por duas migrations pendentes e warning de shadow |

Evidências locais ignoradas pelo Git: `output/final-review-*.log`,
`output/final-audit-*.json`, `output/playwright/integrated-results.json` e
screenshots/report em `output/playwright/`. Runner final confirmou porta 3100
liberada, banco/storage QA removidos e ausência de env do webServer no JSON.
Baseline teve um ECONNRESET isolado na leitura de mídia já persistida; o gate
final passou o mesmo cenário, com retries=0 e assertions intactas. Conteúdo longo
revelou as falhas de layout documentadas acima. Após instalação limpa, uma
tentativa de build teve pacotes locais incompletos; instalação foi repetida,
resoluções conferidas antes/depois da movimentação atômica e novo build vazio passou.

Skips finais: 24 de checkout staging (opt-in/STAGING_E2E e ambiente/credenciais
externas; comércio intencionalmente desligado), 24 da galeria multi-imagem
(opt-in PLAYWRIGHT_MULTI_IMAGE_SLUG, não há fixture multi-imagem declarada) e
14 de redundância de matriz (2 menu Axe + 2 teclado mobile + 2 forced-colors +
2 responsive com matriz própria + 6 cenários isolados reservados ao projeto
desktop/mobile). Nenhum skip de credencial Admin, falta de registro de detalhe
ou falha real. Os 54 cenários Admin foram efetivamente executados.

## Dependências

Next/ESLint config `16.3.8`, Prisma/client/adapter `7.9.1`, Nodemailer `10.0.13`,
fast-uri `3.1.8`. Revisado o diff inteiro do lockfile: nesta revisão somente
brace-expansion `1.1.18 → 1.1.21` e `5.0.9 → 5.0.12`, ip-address `10.7.0 → 10.7.3`.
`npm ci --no-audit --no-fund` validou o lockfile, sem downgrade/force/override novo.

Auditoria runtime: **3 high, 0 critical/moderate**, uma cadeia Prisma/config/deepmerge-ts.
Completa: **16 high, 0 critical/moderate**, incluindo tooling de ESLint/Lighthouse.
Braces ainda não tem patch compatível publicado; a alternativa sugerida pelo npm
troca ESLint config por major antigo. Lighthouse sugere major 13.5.0. Não aplicados.
Registry consultado nesta sessão: Prisma estável 7.10.0 ainda usa config 7.10.0,
que fixa deepmerge-ts 7.1.5; latest aponta para Prisma 8 RC. Não há atualização
Prisma compatível que elimine essa cadeia. Deepmerge 8 exige mudança major.
[Advisory upstream](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx)
e [issue no Prisma](https://github.com/prisma/orm/issues/30052).

## Banco e shadow

`rare_dev` foi somente inspecionado: migrate status/db:check retorna erro pelas
duas migrations pendentes `20260920120000_analytics_paid_at_index` e
`20260921120000_session_version`. Não aplicadas nesta sessão.
O shadow local é outro banco, mas contém objetos; isso sozinho não prova drift.
Com shadowDatabaseUrl explícito, Prisma faz soft reset no início de migrate dev
e pode deixar o replay anterior. O warning agora pede confirmar isolamento e
ausência de dados reais, sem prescrever limpeza manual. Nenhum shadow foi limpo.
`migrate deploy`, usado no QA descartável, não depende de shadow.
[Documentação Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database).

## Cron: configuração no repositório, não inventário live

| Origem | Job / frequência | Caminho |
| --- | --- | --- |
| vercel.json | Diário, expressão `0 3 * * *`: 03:00 UTC / 00:00 São Paulo | GET /api/cron/release-expired-inventory → releaseExpiredReservations → runCheckoutExpiryBatch |
| railway.cron.json | Worker contínuo, cronSchedule null e restart ALWAYS; polling 15.000 ms menos duração do batch, mínimo 100 ms | npm run checkout:worker → scripts/checkout-expiry-worker.ts → mesmo batch; também processa outbox se e-mail habilitado |

[Vercel documenta UTC](https://vercel.com/docs/cron-jobs). Ambos podem disputar
a mesma fila se configurados no mesmo DB. Claim usa leaseToken e FOR UPDATE
SKIP LOCKED; isso reduz dupla execução, mas não elimina trabalho/requisições
redundantes ou necessidade de confirmar ownership operacional. O arquivo Railway
não descreve um cron agendado: descreve processo persistente. Não foi verificado
nem desativado qualquer serviço externo. Warning do release guard preservado.

## PR e limites

Busca por head/base não encontrou PR. Criação Draft pela integração retornou
**403 Resource not accessible by integration**. Nenhum token foi obtido,
permissão contornada, PR marcado Ready, check remoto aprovado ou merge executado.

URL de criação: https://github.com/raredept/rare/pull/new/codex/admin-dashboard-reconciled-20261002
Título: `refactor(admin): reconcile dashboard master cycle with current main`.

Corpo pronto (usar junto da descrição de `ADMIN_MAIN_RECONCILIATION.md`):

> Final review: bounded Admin payloads/rate limits, deterministic pagination,
> repeated query parameters and long-content responsive regressions corrected.
> Final local gate and known warnings are recorded in docs/cycles/ADMIN_FINAL_REVIEW.md.
> Runtime audit retains the upstream Prisma/deepmerge-ts chain; developer tooling
> advisories remain documented, without forced major changes. Main ancestry was
> checked; validate GitHub checks/mergeability before review approval. No production
> deploy, merge, commerce activation, live secrets/infra changes, or real DB migration/reset.
> Before production: authorized release, migration state confirmation, external
> storage/payment/shipping/email homologation and cron ownership confirmation.

Comércio continuou desligado: defaults/guards e QA impõem checkout/shipping false
e EMAIL_DRIVER disabled. Readiness local não equivale a homologação externa:
storage local, frete fixo e cinco produtos ativos sem dimensões permanecem avisos.
Os dois documentos pessoais não rastreados foram preservados fora dos commits.
**Merge ready depende ainda de PR existente e checks/mergeabilidade verificáveis.**
