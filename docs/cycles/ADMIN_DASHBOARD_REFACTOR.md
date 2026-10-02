# RARE — Admin Dashboard Master Cycle

Data: 2026-10-02  
Branch: `codex/admin-dashboard-refactor-20261002`  
HEAD inicial: `7f52b1954c826276c3f7581cf8fdd7b53f896a8e`

## Baseline

| Gate | Resultado inicial |
| --- | --- |
| Install | PASS — `npm ci --no-audit --no-fund` |
| Lint | BLOQUEADO — ESLint percorria `.claude/worktrees/**/.next/**` e não terminava em tempo razoável |
| TypeScript | PASS |
| Unit/integration | PASS — 113 arquivos, 734 testes |
| E2E | PASS — 120 testes, 15 skips condicionais |
| Build | PASS — Next.js 16.3.4 |
| Banco/migrations | PASS com warning de objetos existentes no shadow database |
| Segurança | 6 achados de produção: 1 crítico, 4 altos e 1 moderado |

Os arquivos não rastreados `PROJECT_CONTEXT.md` e `V1_7_27_INVENTARIO_CREDENCIAIS_E_PLANO_HOMOLOGACAO.md` já existiam e foram preservados fora dos commits.

## Cycles concluídos

### Cycle 0 — Discovery e baseline

- Mapeadas as rotas, APIs, Server Actions, autenticação, modelos Prisma, queries, scripts e testes do Admin.
- Lidas as referências locais do Next.js 16 para autenticação, Server Actions, forms, layouts, loading, errors e caching antes das alterações.
- Confirmado PostgreSQL/Prisma, App Router e proteção server-side por `requireAdmin()`.
- Detectados três problemas prioritários: dashboard com leituras irrestritas, listas sem paginação e API de push liberada durante a troca obrigatória de senha.

### Cycles 1–4 — Arquitetura, shell, navegação e UX

- Sidebar reorganizada em Operação, Catálogo e Sistema, com ícones e estado ativo.
- Header contextual com breadcrumb, ação para a loja e sinal de notificações.
- Menu mobile com overlay semântico, Escape, foco preso ao diálogo, restauração ao acionador e controle de scroll.
- Conteúdo com largura máxima previsível e alvos interativos mínimos de 44 px.
- Adicionado `error.tsx` seguro e melhorado o `loading.tsx` com status acessível.
- Dashboard deixou de ser uma grade plana de 12 cards e passou a priorizar receita, pagamentos pendentes, ticket, ações e alertas operacionais.

Commit: `ac050c6 refactor: rebuild responsive admin shell`

### Cycles 5 e 8 — Data layer e performance

- Pedidos deixaram de ser carregados integralmente para agregação em JavaScript.
- Receita, contagem por status, top produtos, estoque baixo e esgotados passaram a ser agregados no PostgreSQL.
- Consultas de pedidos recentes e notificações permanecem limitadas.
- Semântica de receita ficou explícita: estados pagos (`paid`, `processing`, `shipped`, `delivered`); janelas de 7/30 dias usam `paidAt`.
- Datas administrativas novas usam `America/Sao_Paulo`; moeda continua em centavos e BRL.
- Pedidos, clientes e produtos passaram a ter paginação server-side de 25 itens, busca/filtros na URL e seleção mínima de campos.
- Clientes agregam receita apenas para os IDs da página atual.
- Filtros de estoque consideram disponibilidade real (`stock - reservedStock`) no banco.

Commits:

- `381ae13 refactor: aggregate admin dashboard metrics`
- `a04192e refactor: paginate admin operational lists`

### Cycles 6, 7 e 14 — Segurança, actions e validação

- Corrigido o bypass de primeiro acesso em `/api/admin/push-subscriptions`: nenhuma mutação é permitida enquanto `mustChangePassword` estiver ativo.
- Adicionada validação same-origin às mutações de push e centralizada a mesma regra dos uploads/editor.
- Payloads de push agora são estritos e respostas de autenticação não são armazenadas em cache.
- IDs de entidades nas Server Actions são normalizados e limitados antes das queries.
- Configurações inválidas retornam feedback controlado em vez de expor erro de schema.
- Confirmado que todas as actions administrativas sensíveis chamam `requireAdmin()` no servidor; o layout não é usado como fronteira de autorização.
- Next.js, ESLint config, Nodemailer e fast-uri receberam atualizações de patch compatíveis.
- O advisory residual `deepmerge-ts` permanece na cadeia de tooling do Prisma; a correção sugerida pelo npm exige downgrade major para Prisma 6.12 e não foi aplicada.

Commits:

- `b4c1abf fix: harden admin mutations and patch runtime dependencies`
- `c00055c fix: validate admin action inputs consistently`

### Cycles 9–12 — Responsividade, acessibilidade e reutilização

- Navegação móvel substituiu a faixa horizontal de links.
- Filtros e paginação são reutilizáveis e preservam estado por query string.
- Tabelas administrativas mantêm os dados essenciais em layouts empilhados no mobile.
- Empty states foram mantidos/adicionados em dashboard e listas.
- Navegação, badges e botões icon-only receberam nomes acessíveis.
- `prefers-reduced-motion` existente foi preservado.

### Cycles 13, 15 e 16 — Testes, regressão e final gate

- Criados testes para agregações, paginação, IDs administrativos e mutações de push.
- Dois testes de páginas Admin foram renomeados de `.test.tsx` para `.test.ts`, passando a ser coletados pela configuração real do Vitest.
- Uma regressão de mock descoberta pela suíte integral foi corrigida sem enfraquecer assertions.
- Storefront, rotas privadas, acessibilidade, teclado, links e resiliência foram exercitados pela suíte E2E.

Commits:

- `5160638 test: cover paginated product admin data`

## Final gate

| Gate | Resultado final |
| --- | --- |
| Lint | PASS |
| TypeScript | PASS |
| Unit/integration | PASS — 117 arquivos, 742 testes |
| Admin tests | PASS — 11 arquivos, 42 testes no recorte final |
| E2E | PASS — 120 testes, 15 skips condicionais, 3 navegadores/perfis |
| Build | PASS — Next.js 16.3.8, standalone e 28 Server Actions verificadas |
| DB/migrations | PASS; warning não bloqueante no shadow database |
| App readiness | PASS sem bloqueios; warnings operacionais documentados abaixo |
| Release guard | PASS — 6 checks; 1 warning de cron legado |
| npm audit produção | DOCUMENTADO — 3 entradas altas da mesma cadeia Prisma/deepmerge-ts; 0 crítico/moderado |

## Pendências e ação manual

1. Executar `npm run qa:e2e:isolated` com banco descartável configurado para validar login Admin, troca obrigatória de senha, uploads e overflow autenticado. Esses 15 cenários foram pulados com segurança no E2E normal porque o ambiente descartável não estava disponível.
2. Revisar visualmente o Admin autenticado em 320, 375, 390, 768, 1024, 1280, 1440 e 1920 px; a estrutura foi corrigida, mas o fluxo isolado autenticado depende do item anterior.
3. Não abrir vendas enquanto `CHECKOUT_ENABLED=false`, storage local, frete fixo legado e cinco produtos ativos sem dimensões persistirem.
4. Confirmar que o cron legado de `vercel.json` não executa em paralelo ao cron da Railway.
5. Recriar/limpar o shadow database antes de um futuro `prisma migrate dev`.
6. Acompanhar atualização upstream do Prisma que remova `deepmerge-ts < 8`; não usar `npm audit fix --force` nem fazer downgrade para Prisma 6.

## Limites desta execução

- Nenhum deploy, push, PR, merge, secret, DNS, Stripe, frete, e-mail, pedido real ou configuração de produção foi alterado.
- Nenhuma migration foi criada ou aplicada.
- Métricas do dashboard usam somente dados reais do banco; não foram adicionados placeholders ou KPIs fictícios.

## Riscos conhecidos e próximos cycles

1. O resumo de prontidão e as pendências de catálogo no dashboard ainda precisam ler os detalhes do catálogo para manter o diagnóstico exato. O histórico de pedidos e as listas grandes já foram eliminados do caminho pesado; um próximo cycle pode materializar/agregar os sinais de catálogo quando o volume justificar.
2. Categorias e banners permanecem sem paginação por serem conjuntos editoriais de baixa cardinalidade. Adicionar paginação caso o modelo de operação mude.
3. Substituir a confirmação nativa das exclusões por um diálogo acessível do próprio design system, preservando prevenção de duplo envio e foco.
