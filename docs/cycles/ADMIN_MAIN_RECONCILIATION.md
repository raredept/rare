# RARE — MAIN RECONCILIATION REPORT

Data: 2026-10-02. Escopo: reconciliação local, QA descartável e publicação da
branch/PR, sem merge, deploy ou ativação comercial.

## Referências e estratégia

- Base original: `7f52b1954c826276c3f7581cf8fdd7b53f896a8e`.
- Main remota após fetch: `4ea73f50cafdbf67e16dc71de985052075feca42`.
- Branch original: `codex/admin-dashboard-refactor-20261002`.
- HEAD Admin antes: `f97090c9772bbc511544ba644e16bcb3b1b0880f`.
- Backup local confirmado: `backup/admin-dashboard-pre-reconcile`, no mesmo HEAD.
- Branch final: `codex/admin-dashboard-reconciled-20261002`.
- 70 commits da main incorporados como ancestral, não copiados para o diff.
- Estratégia: nova branch em origin/main + cherry-picks adaptados e
  reimplementação semântica do dashboard sobre analytics atual.
- O HEAD final é o commit de documentação que contém este relatório; consultar
  `git rev-parse HEAD` ou o HEAD publicado no PR (evita SHA autorreferente).

## Mapa de sobreposição antes da integração

150 caminhos alterados somente pela main, 23 somente pelo ciclo Admin e 16 por
ambos. A contagem considera caminhos de origem/destino das renomeações de testes.

| Ambos | Classificação / decisão |
| --- | --- |
| categories/actions.ts | SECURITY / BUSINESS: manter slug duplicado e adicionar validação de ID |
| orders/actions.ts | SECURITY / BUSINESS: manter transições e reserva da main, validar ID/status |
| products/actions.ts | SECURITY / BUSINESS: manter slug, frete e transações; adicionar IDs limitados |
| customers/page.tsx | AUTH / DATA / UI: guard por página + paginação e gastos agregados |
| orders/page.tsx | AUTH / DATA / UI: paginação e enum seguros da main; datas comerciais |
| products/page.tsx | AUTH / DATA / UI: guard, labels e chips da main + consultas limitadas |
| layout.tsx | AUTH / ARCHITECTURE / A11Y: guard, landmark e logout móvel + shell |
| loading.tsx | UI / A11Y: status acessível com texto anunciado |
| page.tsx | AUTH / ANALYTICS / UI: dashboard actions-first e camada compartilhada da main |
| page.test.ts | TESTS: preservar cobertura atual e testar contratos SQL complementares |
| push-subscriptions/route.ts | SECURITY: allowlist + origem + senha obrigatória + payload estrito |
| push-subscriptions/route.test.ts | TESTS / SECURITY: unir testes SSRF e novas restrições |
| globals.css | UI / A11Y: preservar cores/correções da main; altura mínima nos inputs |
| admin-nav.tsx | ARCHITECTURE / UI / A11Y: grupos/ícones + Analytics e badge semântico |
| admin-toast.tsx | SECURITY / UI: catálogo seguro da main, sem texto arbitrário da URL |
| admin-catalog-pages.test.ts | TESTS: mocks adaptados à consulta paginada |

Main-only relevante preservado: auth/sessionVersion, guards de todas as páginas,
normalização de redirects, checkout e expiração durável, webhooks, frete com
allowlist, SMTP/ZeptoMail/outbox, políticas de ambiente, CSP, migrations de paidAt
e sessão, Analytics/períodos/gráficos, catálogo completo e suítes atuais de QA.

Admin-only relevante incorporado: dependências corrigidas, origem compartilhada,
IDs limitados, loading/error, header/drawer, paginação de produtos/clientes e testes.
Os dois documentos locais preexistentes não rastreados não foram incluídos.

## Conflitos e consolidação

Conflitos Git em dez caminhos: push route, layout, loading, nav, orders action,
toast, customers page, orders page, products page e relatório histórico
(modify/delete pela ordem de incorporação). Todos resolvidos semanticamente;
nenhuma escolha automática de ours/theirs em arquivos importantes.

O dashboard antigo e `admin-dashboard-data.ts` não foram copiados: duplicariam
`admin-analytics.ts` e usariam outra janela/semântica. O objetivo foi incorporado
na arquitetura atual: ações antes dos números, receita explicitamente após
desconto/com frete, status pagos elegíveis e fuso America/Sao_Paulo por paidAt.
Ranking por productId, Analytics e calendário comercial da main permanecem.

Correções adicionais necessárias:

- Busca + categoria agora se combinam, sem sobrescrever um OR.
- Estoque crítico é filtrado/ordenado por estoque vendável no PostgreSQL antes
  do LIMIT; o antigo take 200 por estoque físico omitia itens muito reservados.
- Ordenação estável de produtos inclui ID; paginação limita offsets a 10 mil páginas.
- Catálogo de feedback seguro reconhece as novas mensagens de validação.
- Tabelas/filtros expansivos passam a xl para caber junto da sidebar de 288 px.
- Logout continua disponível sem abrir o drawer; Analytics aparece em menu/header.
- Drawer contém foco, restaura foco/scroll, fecha por Escape/navegação e ao entrar
  no breakpoint desktop. Testes repetem o ciclo de teclado três vezes por largura móvel.
- Testes atuais mantêm os nomes .test.tsx da main e todas as assertions úteis;
  renomeações antigas não são necessárias porque o Vitest atual já os coleta.
- Axe reutiliza cookies de uma autenticação, mas cria um documento novo por teste,
  evitando acumulação de trabalho no WebKit sem afrouxar assertions ou rate limits.

## Reauditoria de segurança

Todos os handlers/actions modificados continuam verificando Admin antes de dados
ou efeitos. Guards por página são verificados pela suíte estática da main.
Auth mantém assinatura/role, conta ativa, credentialVersion, sessionVersion,
senha temporária e revogação por logout/troca de senha. Testes adicionais cobrem
ausência de sessão e seleção obrigatória de conta ativa/Admin.

Orders mantém regras de transição e liberação de reservas da main. Products e
categories mantêm tratamento de slug duplicado/race. Banners/notifications têm
IDs limitados; settings usa safeParse com redirect de feedback conhecido.
Uploads/editor mantêm autorização, rate limit e limites existentes e compartilham
validação de origem. Push preserva allowlist SSRF e bloqueia senha temporária.
Customers e demais páginas/actions da main não foram rebaixadas.

Não houve alteração em schema ou histórico de migrations, secrets, infraestrutura,
flags live, pagamento, webhook, configuração comercial ou banco rare_dev.

## Final Gate

| Gate | Resultado da branch reconciliada |
| --- | --- |
| Install | PASS — npm ci limpo; Prisma gerado no postinstall |
| Lint | PASS |
| TypeScript | PASS |
| Unit / integration | PASS — 146 arquivos, 1.113 testes |
| Admin/auth subset | PASS — última seleção de 27 arquivos / 133 testes, três execuções consecutivas |
| SQL real | PASS — três ciclos de estoque vendável, busca + categoria, filtro de estoque e dashboard por paidAt |
| E2E integrado / isolated | PASS — 178 passed, 62 skipped, zero unexpected / flaky; 364,6 s |
| Admin accessibility | PASS — 54 cenários em Chromium desktop/mobile e WebKit (48 auditorias Axe + 6 verificações de teclado/semântica) |
| Responsividade | PASS — 11 rotas x 320/375/390/768/1024/1280/1440/1920; zero overflow; screenshots |
| Drawer triple gate | PASS — três ciclos em cada uma das quatro larguras móveis, incluindo Axe, Tab/Shift+Tab/Escape, foco, scroll e navegação; resize desktop também coberto |
| Prisma validate / generate | PASS — schema válido, Client 7.9.1 gerado |
| Migrations QA | PASS — todas as 14 migrations aplicadas do zero em banco localhost descartável |
| Build | PASS — Next 16.3.8, standalone com assets e 28 Server Actions verificadas |
| Release guard | PASS — 6 OK, 1 WARNING de cron legado, 0 FAIL; scan de fonte/diff/bundle e flags |
| Readiness | PASS sem erros bloqueantes, com warnings locais abaixo |
| db:check / migrate status local | WARNING compreendido — exit 1 por duas migrations da main pendentes; não é aprovação do rare_dev |
| Audit | WARNING compreendido — runtime 3 high; completo 12 high / 1 moderate |
| Dependências efetivas | Next/eslint-config-next 16.3.8; Nodemailer 10.0.13; fast-uri 3.1.8 |

O fluxo real de primeiro acesso, bloqueio de páginas/API/Server Action, troca de
senha e revogação da sessão antiga passou nas três execuções isoladas realizadas
durante a reconciliação. As duas primeiras execuções completas encontraram
regressões corrigidas; somente a terceira é o gate integrado final verde.
Não são alegadas três passagens verdes da suíte E2E inteira.

Os 62 skips não ocultam regressões: 24 Stripe staging sem credenciais/checkout,
24 galeria multifoto sem fixture opt-in, 6 cenários isolated exclusivos de outro
projeto, 2 matriz Admin já executada integralmente no desktop, 2 controles móveis
de acessibilidade, 2 teclado móvel e 2 alto contraste exclusivo de desktop.
Todos os 54 cenários Admin accessibility foram executados, sem skip.
Smoke cobre home, catálogo, produto, login/cadastro, carrinho, conta privada,
checkout desligado, metadata, links, health e recuperação de Server Action.

Cleanup confirmou banco e storage descartáveis removidos e porta 3100 liberada.
Relatório JSON final não contém config.webServer.env. Revisão visual efetuada nas
capturas de 320/1024/1440 e drawer 390; capturas das oito larguras estão preservadas.
Não houve alteração em fonte durante o gate E2E final.

## Advertências conhecidas e limites

- `db:check` / migrate status no rare_dev: duas migrations da main pendentes
  (`20260920120000_analytics_paid_at_index`, `20260921120000_session_version`).
  Shadow local já contém objetos. Não limpar/migrar bancos reais nesta sessão.
  O runner descartável aplica todas as 14 migrations do zero e testa SQL real.
- Readiness local: storage local, modo fixed legado, cinco produtos sem dimensões
  completas e checkout desabilitado. Não é aprovação de produção/venda aberta.
- Audit runtime: três high na cadeia Prisma/config/deepmerge-ts; o autofix propõe
  downgrade Prisma 6.12.0. Nenhum force fix. Advisory:
  https://github.com/advisories/GHSA-ggr8-5vv4-36mx (objetos recursivos, não JSON simples).
- Audit completo: 13 alertas (12 high, 1 moderate), dos quais dez adicionais são
  tooling/dev: Lighthouse/Puppeteer/basic-ftp/extract-zip e brace-expansion/ip-address.
  Atualizações maiores do tooling não foram introduzidas nesta reconciliação.
- Vitest avisa sobre futuro configLoader native/ESM; pg avisa sobre consultas
  concorrentes no adapter; warnings NO_COLOR são do runner. Sem falha funcional
  atribuída a esses avisos. O teste de recuperação de Server Action injeta erro
  de versão deliberadamente; não equivale a erro inesperado de produção.
- Cron: vercel.json ainda agenda a rota diariamente; railway.cron.json declara
  worker contínuo checkout:worker, cronSchedule null. Documentação mantém Vercel
  como rollback. O repositório não prova se o job Vercel está ativo externamente;
  manter warning e confirmar antes de desativar/remover configuração.

## Reprodutibilidade e evidência

`npm ci`; `npm run lint`; `npm run typecheck`; `npm run test`;
`npx prisma validate`; `npx prisma generate`; `npm run qa:e2e:isolated -- --all`;
`npm run build`; `npm run release:guard`; `npm run app:check`; `npm run db:check`;
`npx prisma migrate status`; `npm audit`; `npm audit --omit=dev`; `npm ls next nodemailer fast-uri`.

QA cria somente banco localhost `rare_qa_browser_<timestamp>_<hex>`, storage sob
output/qa-storage, credenciais temporárias e flags checkout/shipping/email off.
Contrato SQL testa três vezes estoque crítico após 220 variantes normais, filtros
combinados e receita por paidAt/exclusão de cancelados. Fixtures de cliente/pedidos
existem somente nesse banco para testar listas/details. Cleanup remove esse banco
e storage; relatório JSON remove env serializado. Credenciais externas de Admin
não são herdadas para o Axe.

O primeiro QA detectou CSS antigo do cache persistente: arquivo fonte tinha as
cores atuais, mas HTTP entregava valores da branch anterior. Cache/build anterior
foi movido, recuperável, para output/next-pre-reconcile. Evidência da execução fica
em output/playwright-stale-cache. Depois foram corrigidos chip e overflow reais.
A segunda execução foi preservada em output/playwright-reconciliation-run2;
inclui erros conhecidos do experimento de teste SQL substituído por script tsx
e timeout de detalhe de pedido sem fixture. O gate final usa fixtures próprias,
documentos Axe isolados e o contrato SQL executado antes do navegador.
QA agora desabilita apenas cache persistente de dev quando QA_DATABASE_URL existe;
comportamento normal/produção do cache não mudou.

Artefatos finais: output/playwright/integrated-results.json e screenshots da
matriz em output/playwright/results/admin-responsive-*/. Artefatos são ignorados
pelo Git e excluídos dos gates de fonte, sem excluir testes reais.

## Publicação e ações manuais

Push: concluído na branch `codex/admin-dashboard-reconciled-20261002`, sem force.
PR: não criado. `gh` não está disponível e a integração GitHub retornou
`403: Resource not accessible by integration` ao criar o PR; a permissão de push
do Git não concede escrita de pull requests a esse conector. Não houve tentativa
de contornar permissões ou obter tokens. Nenhum merge/deploy foi executado.

### PR preparado

- PR_TITLE: `refactor(admin): reconcile dashboard master cycle with current main`
- BASE: `main`
- HEAD: `codex/admin-dashboard-reconciled-20261002`
- Formulário: https://github.com/raredept/rare/pull/new/codex/admin-dashboard-reconciled-20261002

PR_BODY:

```markdown
## Admin Master Cycle reconciliado com a main atual

Base 4ea73f50 (70 commits incorporados). HEAD original f97090c9 preservado em
backup/admin-dashboard-pre-reconcile. Dez conflitos resolvidos semanticamente.

- Shell/header/drawer responsivos, foco/teclado, logout móvel e paginação limitada.
- Dashboard reutiliza analytics da main: paidAt, America/Sao_Paulo e productId.
- Estoque vendável filtrado/ordenado no SQL antes do LIMIT; filtros combinados.
- Guards, revogação de sessão/senha, allowlists, pedidos e slugs preservados.
- Next 16.3.8, Nodemailer 10.0.13, fast-uri 3.1.8; schema/migrations intactos.

PASS: lint/TypeScript; 1.113 unit/integration; 133 testes críticos x3; SQL real x3;
E2E 178 passed/62 skips condicionais/zero flaky; 54 Admin accessibility;
11 rotas x8 larguras; drawer x3 por largura móvel; Prisma; 14 migrations QA;
build standalone/28 Server Actions; release guard 6 OK/1 warning/0 FAIL.

Warnings: rare_dev com duas migrations pendentes (QA descartável migrou todas);
audit runtime 3 high Prisma/deepmerge-ts, completo 13 alertas; cron legado Vercel;
storage local/frete fixed/produtos sem dimensões. Stripe staging e galeria multifoto
opt-in não homologados. Detalhes em docs/cycles/ADMIN_MAIN_RECONCILIATION.md.

Sem merge, deploy, secrets, infraestrutura ou ativação comercial.
Dois documentos locais preexistentes não rastreados ficaram fora do PR.
```

1. Criar o PR com o conteúdo acima e revisar warnings antes de qualquer merge autorizado.
2. Aplicar migrations em desenvolvimento/deploy em operação separada autorizada;
   usar banco shadow realmente descartável quando necessário.
3. Confirmar cron Vercel externo e homologar Stripe/frete/email no ambiente correto,
   sem interpretar estes testes locais como ativação comercial.
