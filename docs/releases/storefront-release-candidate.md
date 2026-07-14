# Rare Dept — storefront release candidate

Data da revisão: 14/07/2026. Base funcional encontrada no início: `bd1adad`.
Comparação histórica dos 11 commits solicitados: `348c97a..0a9d21a`.

## Estado do histórico encontrado

O snapshot do pedido dizia `main` 11 commits à frente de `origin/main`, com HEAD
`0a9d21a`. Antes de qualquer `fetch` ou edição, o repositório já apresentava:

- `main`, `origin/main` e `HEAD` em `bd1adad`;
- zero commits à frente;
- worktree limpa e nenhuma operação Git em andamento;
- reflog de `origin/main` registrando um push às 00:06 de 13/07/2026;
- `bd1adad` como fix adicional posterior aos 11 commits.

Portanto, os 11 commits foram revisados pelo intervalo histórico que começa após
`348c97a`. O push anterior não foi executado por este ciclo.

## Resumo operacional

- Migração de hosting preparada para Railway com build standalone, migrations em
  pre-deploy e serviços web/cron separados.
- PostgreSQL e Redis compartilhado preparados em produção; preview ainda exige
  recursos separados e nova prova de health.
- Cron de reservas documentada em `railway.cron.json`; o cron legado de `vercel.json`
  permanece como warning que depende de confirmação externa.
- Backfill de variantes preparado com dry-run padrão, autorização dupla para produção,
  interrupção segura e proteção contra atualização concorrente; não executado.
- Melhor Envio, Stripe, e-mail e Push possuem código/guard/documentação preparatórios,
  mas permanecem não homologados e desabilitados neste RC.
- Storefront modernizado em header, menu mobile, Home, catálogo, produto, autenticação,
  carrinho e institucionais, sem nova rodada visual neste ciclo.
- Axe, Playwright, teclado, console, links e Lighthouse integrados ao QA.
- Metadata, robots, sitemap e JSON-LD reforçados; `Product.offers` não existe com
  checkout pausado.
- Manifest e service worker Admin preservados; não há cache offline do storefront.
- Error boundaries, observabilidade sanitizada, headers e scans de secrets fazem parte
  do gate. CSP permanece em planejamento, sem policy ampla neste release.

## Alterações visíveis

- Header e menu mobile com navegação e foco revisados.
- Home editorial com carrossel; indicadores agora preservam a aparência interna e têm
  alvo interativo real mínimo de 24 px.
- Catálogo e cards com hierarquia, mídia responsiva e mensagem de disponibilidade.
- Produto com galeria/zoom, descrição e ações coerentes com a pausa comercial.
- Carrinho e checkout exibem pausa e não oferecem finalização.
- Login, cadastro e conta usam shells/feedbacks acessíveis.
- Footer e páginas institucionais não prometem Pix, cartão, parcelamento ou frete ativo.

## Alterações técnicas

- Imagens: variantes persistidas, `srcSet`, fallback, backfill e orçamento de recursos.
- SEO: canonical sem `www`, metadata social sanitizada, robots por ambiente, sitemap
  público e structured data condicional.
- QA: Vitest, Playwright desktop/mobile/WebKit, Axe, teclado, console, links,
  resilience, smoke do RC e Lighthouse.
- Resiliência: 404 útil, error boundaries, fallback de sitemap e observabilidade sem PII.
- PWA: manifest e ícones; service worker exclusivamente para Push Admin em `/admin/`.
- Release: `release:guard`, `smoke:release` e `release:check` coordenam gates seguros.

## Revisão dos 11 commits

| Commit | Escopo | Arquivos principais | Depende de | Risco | Reversível | Banco | Config | Frontend | Integrações | Exige env | Cobertura automatizada |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `9edf947` Prepare safe integration homologation tooling | Dependências, Melhor Envio, e-mail, Push e backfill | `.env.example`, `package*.json`, `shipping.ts`, `transactional-email.ts`, `media-variant-backfill*` | Base `348c97a` | Médio/alto pelo backfill e providers | Sim; rollback de app, sem executar backfill | Sem schema; script opcional escreve quando autorizado | Sim | Admin pontual | Sim | Sim | Unitários para shipping, checkout, e-mail, Push e backfill |
| `c8040eb` Enforce product shipping readiness | Bloqueio de frete automático sem peso/medidas | `product-shipping-readiness*`, Admin produto, health, shipping, runbook | `9edf947` | Médio | Sim; manter frete off | Sem schema; lê campos existentes | Sim, readiness/docs | Admin | Melhor Envio/shipping | Condicional | Unitários e rotas/health |
| `0485d97` Harden media backfill interruption safeguards | SIGINT/SIGTERM e guard de produção | `backfill-media-variants.ts`, `media-backfill-cli.ts`, tests | `9edf947` | Médio | Sim; não altera dados sem `--apply` | Sem schema; escrita opcional não executada | Sim | Não | R2/backfill | Sim para apply | Unitários de CLI e interrupção |
| `4aa39eb` Modernize storefront foundations and navigation | Design system, header, menu e autenticação | `globals.css`, `header*`, `mobile-navigation.tsx`, auth forms/shell, commerce state | Independente dos scripts; base visual | Médio | Sim | Não | Não | Sim | Não | Lê checkout | Unitários de navegação/header/commerce |
| `e503858` Refine catalog and product presentation | Home, catálogo, card e produto | pages de Home/categoria/produto, `product-card.tsx`, `product-detail-client.tsx` | `4aa39eb` | Médio | Sim | Não | Não | Sim | Não | Lê checkout | Unitários de páginas/card/produto |
| `ec52205` Align paused checkout communication across storefront | Pausa comercial em carrinho e institucionais | layout, cart/checkout, footer, contato, políticas e conta | `4aa39eb`; estado comercial | Alto se inconsistente | Sim; manter flag off | Não | Não | Sim | Checkout/frete na comunicação | `CHECKOUT_ENABLED` | Unitários de carrinho, checkout e footer |
| `837c73a` Add automated storefront accessibility audits | Playwright, Axe, console, teclado, links e resilience | `playwright.config.ts`, `tests/e2e/*`, `package*.json` | Testa o storefront dos commits anteriores | Baixo/médio | Sim | Não | Sim | Não | Bloqueia requests externos | Variáveis só de teste | A própria suíte E2E/Axe |
| `4b347cc` Improve storefront performance and accessibility | Lighthouse, mídia, foco, feedback e performance | `run-lighthouse.mjs`, carousel, auth, produto, mídia, CSS | `837c73a`, `4aa39eb`, `e503858` | Médio | Sim | Não | Sim | Sim | Não | Lighthouse local | Unitários, Axe, E2E e Lighthouse |
| `f811c48` Strengthen storefront SEO and resilience | SEO, PWA, errors, observabilidade e JSON-LD | robots, sitemap, manifest, errors, `seo.ts`, `structured-data.tsx`, SW | UI/QA anteriores | Médio | Sim | Leituras do catálogo no sitemap | Sim | Sim | PWA/observabilidade | URL/checkout | Unitários e E2E/smoke |
| `053cbfe` Add storefront release and deployment safeguards | Orçamento, checklist e runbook | `docs/frontend-quality-budget.md`, deploy/checklist | Todos os commits funcionais anteriores | Baixo | Sim | Não | Documentação | Não | Operação | Não | Validado pela suíte documentada |
| `0a9d21a` Normalize storefront runbook formatting | Normalização documental | `docs/storefront-deploy-runbook.md` | `053cbfe` | Baixo | Sim | Não | Documentação | Não | Não | Não | Diff check |

### Commit adicional já presente no remoto

`bd1adad` — `Fix security headers test contract`: altera somente
`src/lib/security-headers.test.ts`, não banco/config/frontend/integração/env. Risco baixo,
reversível e coberto por Vitest; corrigiu compatibilidade do teste após a função de
headers deixar de aceitar env como argumento.

## Funcionalidades deliberadamente desabilitadas

- checkout e criação de pedido;
- Stripe live e Stripe test no preview do RC;
- cotação real do Melhor Envio e providers Correios/Frenet;
- e-mail transacional real;
- Web Push real;
- backfill com `--apply`, seed e bootstrap de produção;
- cron no preview, salvo laboratório isolado e autorizado.

## Pendências externas

- Cloudflare/DNS e confirmação do destino Railway;
- publicação real de preview/staging isolado;
- confirmação de que Vercel/cron legado não executa em paralelo;
- Melhor Envio sandbox e Stripe test em laboratório futuro;
- contratação/configuração de e-mail;
- QA manual em iPhone/leitor de tela;
- backup e rollback confirmados pelo responsável;
- plano CSP homologado em staging.

## Riscos conhecidos

- remedição do alvo dos indicadores do carrossel ainda precisa de nova medição
  Lighthouse completa;
- cinco produtos não têm peso/dimensões suficientes para frete automático;
- CSP ausente por decisão consciente;
- não existe cache offline do storefront;
- shadow database local pode emitir warning de objetos extras;
- storage local serve somente para desenvolvimento;
- frete fixo e `vercel.json` são legados a confirmar, sem ativação comercial neste RC.

## Revisão dos skips condicionais

Os números `6 skipped` no `test:e2e` e `2 skipped` no `test:a11y` não representam oito
cenários únicos. São três condições explícitas executadas em uma matriz de projetos;
o teste Axe mobile é contado novamente no comando dedicado.

| Arquivo e teste | Condição | Motivo | Esperado | Cobertura ausente | Outro viewport/ambiente | Pendência |
| --- | --- | --- | --- | --- | --- | --- |
| `tests/e2e/accessibility.spec.ts` — controles móveis/carrossel/menu | Ignora projetos diferentes de `chromium-mobile` | Menu drawer só existe no layout mobile | Sim | Não; roda no Pixel 7 e o restante das rotas Axe roda nos três projetos | Mobile Chromium | Indicadores dependem de múltiplos banners no E2E; teste determinístico cobre o markup |
| `tests/e2e/keyboard.spec.ts` — trap, Escape e retorno de foco do menu mobile | Ignora projetos diferentes de `chromium-mobile` | Cenário exclusivo do menu mobile | Sim | Não; header desktop possui teste próprio de foco | Mobile Chromium | QA manual em iPhone continua pendente |
| `tests/e2e/resilience.spec.ts` — forced colors | Ignora projetos diferentes de `chromium-desktop` | Emulação automatizada é validada no Chromium desktop | Sim | Cobertura automatizada não pretende simular forced-colors no WebKit/mobile | Chromium desktop/Windows High Contrast | Verificação manual de tecnologia assistiva antes de produção |

Nenhum skip foi adicionado para contornar falha. Cada chamada inclui condição e
justificativa; remover a condição criaria cenários inexistentes ou não suportados.

## Artefatos e higiene do Git

`release:guard` verifica o índice de arquivos rastreados. Não devem existir `.next`,
`node_modules`, output Lighthouse/Playwright, coverage, screenshots/vídeos/traces
temporários, banco/dump, logs, `.env`, chave, certificado, token ou storage local no Git.
`.gitignore` cobre esses grupos e preserva `.env.example`. Screenshots comparativas
deliberadas não foram removidas nem reinterpretadas neste ciclo.

## Rollback resumido

- Último remoto anterior ao lote, conforme reflog: `348c97a` (âncora de código; o
  deploy estável correspondente precisa ser confirmado na plataforma).
- Base funcional auditada no início: `bd1adad`.
- O hash publicável deve ser capturado com `git rev-parse HEAD` imediatamente antes
  da autorização; o documento não pode auto-referenciar o hash do commit que o contém.
- Como não há migration destrutiva neste lote, priorizar rollback de aplicação/deploy,
  preservar banco/Redis/storage e revalidar flags, health e smoke.

## Resultado local esperado

O candidato só pode receber `READY FOR PREVIEW` depois que `npm run release:check`
passar no HEAD final e o ambiente isolado executar `npm run smoke:release`. Sem deploy,
QA manual e autorização, a classificação máxima local é `READY FOR LOCAL RELEASE REVIEW`.
