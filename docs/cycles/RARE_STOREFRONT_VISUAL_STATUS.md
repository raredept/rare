# RARE — Storefront Visual Evolution

## Estado atual

- Branch: `codex/storefront-visual-overhaul-20261007`.
- Baseline reconciliada: `cc72e3b` (documentação Phase 2); frontend anterior: `44c6fa2`.
- Ciclo atual: 9 — implementação e revisão visual entregues; aceitação integral bloqueada pelo build.
- Código final: `83c72434b4a425daebadd2aacd5202cc4ff3671d`; push confirmado por `git ls-remote` na branch isolada. O commit de ciclo 9 contém somente o fechamento documental.
- Resultado: UI fixture QA PASS; build/typecheck integrado FAIL fora do escopo; performance de produção NOT VERIFIED. Nenhuma publicação autorizada.
- Release: **PAUSED**. Histórico Phase 2 preservado: 14 APPLIED / 0 pending / 0 failed / 0 mismatch; backup bloqueador YES; config NOT VERIFIED; incidente OPEN; freeze ACTIVE.

```text
CURRENT_FRONTEND_CYCLE=9
RESULT=VISUAL_IMPLEMENTATION_DELIVERED_BUILD_GATE_BLOCKED
FRONTEND_BRANCH_ISOLATED=YES
PUSH_SOURCE=CONFIRMED
FINAL_ACCEPTANCE=BLOCKED
NEXT_FRONTEND_CYCLE=NONE_WITHIN_CURRENT_AUTHORIZATION
BACKEND_CYCLE_STARTED=NO
```

## Plano concreto / critérios por ciclo

| Ciclo | Entrega | Verificação |
| --- | --- | --- |
| 0 | Preservar documentação, isolar branch, mapear rotas/contratos | diff check, release guard, revisão estática |
| 1 | Tokens storefront, tipografia Geist, superfícies planas, foco | lint, types, unidades |
| 2 | Masthead centralizado, busca, navegação mobile e footer | unidades + teclado/preview |
| 3 | Hero editorial, drop, seleção, categorias, novidades, confiança | mídia/fallback/movimento + screenshots |
| 4 | Grid 2/3/4, cards 4:5, catálogo, filtros e busca | unidades + preview resultados/vazio |
| 5 | Galeria ampliada, zoom, variantes/painel PDP | unidades + teclado/galeria/mídia |
| 6 | Carrinho, auth, conta e checkout: somente apresentação | unidades + guard pausado/ações bloqueadas QA |
| 7 | 360/390/430/768/1024/1280/1440+, reduced motion/a11y | screenshots, Axe e teclado |
| 8 | Imagens responsivas, estabilidade e acabamento | unidades/inspeção, build seguro (gate bloqueado), sem claim de CWV |
| 9 | QA final e relatório, commits e push da branch | suíte local, diff/guard/status |

## Inventário e contratos

19 páginas: home (busca `/?q=`), categoria, produto, `/cart` (redirect), finalizar-compra, entrar, cadastro, minha-conta e dados/endereços/pedidos/detalhe, pedido/sucesso, pedidos legado, sobre, contato, política de envio, privacidade/termos e trocas/devoluções.

Preservar server/client boundaries, metadata/canonical/JSON-LD, slugs, categorias dinâmicas, filtros q/brand/page, ordem disponível/esgotado, estoque ativo menos reservado, variant IDs/limites/cart localStorage, sessões/Server Actions, checkout-disabled guards, mídia real e fallback. Não há sort nem recuperação de senha implementados: nenhuma interface fictícia será criada.

## Concluído

- Cinco documentos de auditoria anterior consolidados em `cc72e3b`, após diff check e release guard: 6 OK / 1 aviso legado de cron Vercel / 0 FAIL.
- Branch isolada criada; dois documentos untracked do proprietário preservados e excluídos de commits.
- Inventário dos componentes, fontes locais e Tailwind 4; direção monocromática editorial, sem imagens/claims inventados.
- Ciclo 1: tokens isolados em storefront, fonte existente, foco duplo e skip-link; commit `aaa9863`.
- Ciclo 2: masthead simétrico, busca com submit e estado URL consistente, menu mobile e footer editorial; commit `9f9a652`.
- Ciclos 3–6: home full-bleed/crop/movimento, catálogo 2/3/4, PDP/zoom/fallback por URL, auth/conta/carrinho/checkout e institucionais implementados e commitados.
- Ciclo 7: skip-link com Tab nativo, tipografia scoped dos controles, contraste do hero/drawer, indicadores limitados sem colisão e harness QA sem banco.
- Ciclo 8: sizes conforme grid/curadoria, hover/main consistentes, lazy loading preservado e wrapper de build sem credenciais.
- Ciclo 9: testes finais, revisão independente de contratos, relatório e backlog. Ver [RARE_FRONTEND_COMPLETION_REPORT.md](./RARE_FRONTEND_COMPLETION_REPORT.md).
- Screenshots revisados: home/catalog/PDP/login/drawer mobile e desktop, matriz de oito larguras, CartPageClient 1024/1280px e hero 10 banners/360px. Ilustrações de QA identificadas, não fotografia real de campanha.

### Commits por ciclo

| Ciclo | Commit | Entrega |
| --- | --- | --- |
| 0 | `7cdb620` | Auditoria/plano/boundary backend |
| 1 | `aaa9863` | Fundação editorial scoped |
| 2 | `9f9a652` | Masthead/nav/footer |
| 3 | `9e4b585` | Home editorial/movimento |
| 4 | `778c891` | Catálogo/cards |
| 5 | `683e396` | Galeria/PDP |
| 6 | `8d9f207` | Carrinho/cliente/institucionais |
| 7 | `26d3dea` | Motion/responsive/a11y/fixture QA |
| 8 | `83c7243` | Mídia/performance estática/build guard |
| 9 | Commit deste fechamento | Relatório/status/backlog; sem alteração de runtime |

Resultados abaixo são do estado integrado final; não constituem aprovação de release para cada snapshot intermediário.

## Em andamento / pendente

- Em andamento: nenhum trabalho backend/release. Encerramento do escopo autorizado.
- Remaining: correção autorizada dos quatro contratos Admin/API; build completo e runtime/performance/media reais em ambiente autorizado. Não há aprovação integral ou deploy neste ciclo.

## Regressões / acessibilidade / performance

- Contraste neutral-500 insuficiente sobre paper encontrado pelo Axe e corrigido nos textos ativos; preço do drawer passou a branco, targets a 44px, busca segue URL, fallback remonta por mídia e a pausa da home fica sempre disponível.
- Expectations da home foram atualizadas e ampliadas, mantendo cobertura do controle global inclusive com zero marcas/um destaque.
- Scrim 60% garante contraste de texto pequeno mesmo em banner branco; indicadores inativos white/60 têm contraste >3:1. Dez banners/360px: sem colisão, targets44px e último foco visível.
- Accessibility: Axe e teclado passaram nos cenários fixture. Skip-link, traps/retorno de foco, anúncio do carrinho, headings, safe-area e reduced motion preservados. Computed fonts confirmados: motion10px/nav11px/CTA12px/input16px.
- Performance: fonte local, media plans/srcset, hero inicial prioritário, lazy abaixo, preload de vídeo e componentes server preservados; nenhum pacote novo. LCP/CLS/INP/delta de bundle de produção **NOT VERIFIED**.

## Testes e limite de evidência

| Check final | Resultado |
| --- | --- |
| `npm run lint` | PASS |
| `npm test -- --reporter=dot` | 149 arquivos / 1.150 testes PASS |
| Types do harness (`tsc --noEmit --project tests/visual-storefront/tsconfig.json`) | PASS |
| UI suíte dedicada Chromium desktop/mobile + WebKit | 111 PASS / 6 skips / 0 FAIL |
| Matriz oito larguras + motion/estado/rede | 44/44 PASS |
| Estados/fallback/estoque/carrinho/10 banners | 8/8 PASS |
| npm `test:a11y` com config fixture | 40 PASS / 2 skips / 0 FAIL |
| npm `test:keyboard` com config fixture | 13 PASS / 2 skips / 0 FAIL |
| npm `check:links` com config fixture | 1/1 PASS |
| `git diff --check` / cached check | PASS |
| `npm run release:guard` | 6 OK / 1 WARNING cron Vercel legado / 0 FAIL |
| Build padrão protegido (Turbopack) | TIMEOUT / NOT VERIFIED; árvore conhecida encerrada |
| Build protegido `--webpack`, fonte final | Compilação48s PASS; contratos Next gerados FAIL; exit1 |
| `npm run typecheck`, com tipos Next gerados | FAIL nos mesmos quatro contratos Admin/API |

UI checks usam retries0; zero flaky. Skips são cenários condicionados ao viewport/projeto, não falhas ocultadas. Contagens dos npm qualificados repetem parte da suíte, não devem ser somadas como cobertura independente.

Comandos reproduzíveis (somente após iniciar o preview Vite seguro do [README](../../tests/visual-storefront/README.md)):

```powershell
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/playwright.config.ts
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/matrix.config.ts
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/states.config.ts
npm run test:a11y -- --config tests/visual-storefront/playwright.config.ts accessibility.spec.ts
npm run test:keyboard -- --config tests/visual-storefront/playwright.config.ts keyboard.spec.ts
npm run check:links -- --config tests/visual-storefront/playwright.config.ts links.spec.ts
node tests/build-storefront-safe/safe-build.mjs --webpack
```

Os comandos npm executados também usaram `--output output/visual-storefront/npm-<check>-final-freeze --reporter=dot,json`; recibos `*-final-freeze-results.json` em `output/visual-storefront`, ignorados no Git.

Falhas de build: Admin banners/categories/readiness (`BannersPageProps`, `CategoriesPageProps` e `AdminReadinessPageProps` opcionais) e health GET (`Request | undefined`). As assinaturas de origem são idênticas a `cc72e3b`; nenhum build histórico da base foi executado. Não corrigir fora de escopo, ignorar erros ou excluir contratos gerados. Types passavam antes da geração, mas esse **não é** o resultado integrado final. Build standalone/artifact checks não foram alcançados; `.next` parcial não é deployable.

Navegação SSR normal chama `getStoreSettings()` com upsert. Não foi iniciado Next ligado a banco. O preview **UI fixture QA** renderiza componentes reais com catálogo/settings em memória, sem credenciais ou rede externa. Prisma/actions/provider calls recusados; checkout pausado é o default. Não equivale a homologação de catálogo/CDN, auth servidor, HTTP/SEO/redirects/RSC/image optimizer, pagamento, frete, deploy ou CWV. Playback real de vídeo não verificado; contrato/fallback cobertos. Não executar isolated-admin-E2E (cria/migra banco). Guard de build Node não é sandbox OS.

## Backlog backend / próximo ciclo

Backend backlog additions: quatro contratos de build P1, settings read-upsert P1, variant.active no JSON-LD P2 e recuperação de senha ausente P2. Ver [RARE_BACKEND_BACKLOG.md](./RARE_BACKEND_BACKLOG.md).

Next frontend cycle: **STOP**; nenhuma continuação backend automática. Release/segurança/backup/config seguem pausados. Autorizações futuras necessárias para resolver gates e medir runtime/performance real. Sem merge, PR obrigatório ou deploy.
