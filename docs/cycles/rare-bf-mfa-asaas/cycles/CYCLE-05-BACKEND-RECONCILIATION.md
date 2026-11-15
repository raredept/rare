# CYCLE-05 — Reconciliação com `codex/backend-evolution-20261007` (RARE-BF-MFA-ASAAS-03), 2026-11-07

Objetivo: integrar a linha de evolução de backend/redesign ao ciclo BF/MFA/Asaas sem perder nada de nenhum dos lados, provar o resultado com a regressão completa e só então atualizar o PR #2 (que continua Draft). Fecha **M-14**. Classificação arquivo a arquivo em [../BACKEND_EVOLUTION_RECONCILIATION.md](../BACKEND_EVOLUTION_RECONCILIATION.md).

Sem merge em `main`, sem staging/produção, sem Railway, sem Asaas/Stripe reais, sem migration fora de banco descartável, sem DNS, sem cobrança.

## BASES

| Item | Valor |
|---|---|
| Ciclo | `cycle/rare-bf-mfa-asaas-01` = `origin` = `d811724` (árvore limpa) |
| Backend | `codex/backend-evolution-20261007` = `bc2c10c` (não alterada) |
| Base comum | `main` = `4ea73f5` (não alterada) |
| Branch de integração | `integration/rare-bf-backend-evolution`, criada de `d811724` |
| Merge | `21729fb` (`--no-ff`, pais `d811724` + `bc2c10c`) |
| Divergência | ciclo 162 arquivos · backend 160 (67 A / 93 M / 0 D, 0 migrations) · interseção 18 |

## CONFLICTS

7 conflitos textuais, todos resolvidos à mão (sem `--ours`/`--theirs` global):

| Arquivo | Classe | Resolução |
|---|---|---|
| `package.json` | SUPERSEDED | pins do ciclo (`next` ^16.4.5, `nodemailer` ^10.3.1, `eslint-config-next` ^16.4.5); o backend só rebaixava versões |
| `package-lock.json` | SUPERSEDED | lockfile do ciclo, coerente com o manifesto; `npm ci` limpo |
| `src/app/admin/(protected)/page.tsx` | MERGE | layout/notas do backend + alertas e resumo de promoções |
| `src/components/admin/admin-nav.tsx` | MERGE | seções/ícones do backend + Promoções e Segurança |
| `src/components/store/cart-page-client.tsx` | MERGE (3 blocos) | lógica de pagamento por provedor, janela persistida e preço promocional do ciclo com o estilo do redesign |
| `src/components/store/product-card.tsx` | MERGE | `PriceTag` (preço do servidor) com tipografia do redesign |
| `src/components/store/product-detail-client.tsx` | MERGE | `PriceTag` + selo da promoção com tipografia do redesign |

Os 11 arquivos mesclados automaticamente também foram lidos e conferidos (lista no documento de reconciliação).

## SEMANTIC DECISIONS

- **Versões**: as do ciclo prevalecem (correções de segurança); nada de `npm audit fix --force`.
- **Shell do Admin**: o do backend (sidebar, header com menu móvel em diálogo, paginação, error boundary), com as seções do ciclo integradas no nav e no título do header.
- **Visual da loja**: o redesign do backend prevalece; os componentes do ciclo (preço promocional, selo, campanha Black Friday, seletor de pagamento) foram trazidos para a mesma linguagem — sem perder o comportamento (preço do servidor, desconto anunciado em texto, `sr-only`).
- **Comportamento de checkout**: o do ciclo prevalece integralmente (`PAYMENT_PROVIDER`, `paymentAvailable`, janela persistida, nota do provedor, sincronização de preço). O texto fixo "15 minutos" e "Stripe" do backend foi descartado.
- **Endurecimento do backend** (origem, corpo limitado, validação de ids, `strict()`): aceito sem mudança; o MFA continua exigido no proxy e em `getCurrentAdmin()`, que todas as rotas/APIs do Admin usam.
- **Docs do backend**: mantidos como histórico; o runbook de migrations ganhou nota com as 4 migrations do ciclo.

## BUGS FOUND

Regressão do merge bruto (`21729fb`, antes de qualquer correção):

| Gate | Ciclo `d811724` | Merge bruto `21729fb` | Introduzido pela integração |
|---|---|---|---|
| `npm ci` | PASS | PASS | — |
| `tsc --noEmit` | PASS | PASS | — |
| `eslint` | PASS | PASS | — |
| `vitest run` | 164 / 1465 PASS | 171 / 1522 PASS | — (+7 arquivos / +57 testes do backend) |
| `npm audit --omit=dev` | 0 | 0 | — |
| `npm run build` | PASS | PASS | — (o build do backend sozinho estava BLOCKED) |
| `release:guard` | 0 FAIL | 0 FAIL | — |
| `qa:bf-asaas` / `qa:checkout-concurrency` | 8 + 12 PASS | 8 + 12 PASS | — |
| `migrate deploy/status/diff` | PASS | PASS | — |
| Lab Chromium — fase asaas | 24 PASS | 17 PASS · **1 FAIL** · 1 skip | **axe: 2 violações de contraste** |
| Lab Chromium — desconhecido / stripe | 2 + 2 PASS | 2 + 2 PASS | — |
| Log / integridade (lab) | 0 / 0 | 0 vazamentos / 0 anomalias | — |

Bugs e correções (um commit cada):

| # | Sev. | Onde | Problema | Commit |
|---|---|---|---|---|
| B-01 | P2 | header do Admin (backend) | `/admin/promotions*` e `/admin/security` com título genérico "Admin" | `c774eb9` |
| B-02 | P1 (a11y) | nav do Admin (backend) | badge de não lidas voltou a `bg-white text-black` → ~1,05:1 no tema escuro (regressão de bug já corrigido no ciclo) + `aria-label` em `<span>` | `95dc417` |
| B-03 | P2 (visual) | home (redesign) | campanha Black Friday fora do `store-shell`: desalinhada do gutter e com cantos arredondados contra a borda | `dc79acd` |
| B-04 | P1 (a11y) | `PriceTag` × novo fundo `#f5f5f3` | preço original riscado `neutral-500` com 4,22–4,34:1 (axe serious) | `46a7e1f` |
| B-05 | P3 (doc) | `PENDING_MIGRATIONS.md` (backend) | contava 14 migrations; integrado tem 18 | `5a1c7e3` |
| B-06 | P2 (teste) | specs do lab | medição responsiva, screenshots e axe podiam ler o skeleton de loading (o React revela o boundary depois do `load`); a checagem da página do pedido podia passar no vazio; o axe pegava o carrossel do redesign no meio do fade | `615ce31` |
| B-07 | P3 (cobertura) | `admin-responsive.spec.ts` (backend) | matriz de 8 larguras não cobria Promoções, Nova promoção e Segurança | `25301c7` |
| B-08 | P3 (visual) | selo de promoção e contagem regressiva (ciclo) | no card estreito de 320 px o selo quebrava em duas caixas soltas; dígitos da contagem em `font-mono` caíam numa fonte serifada | `cecfc79` |
| B-09 | P3 (teste, Firefox) | `bf-mfa-admin-security.spec.ts` | depois do 2º cadastro de MFA o spec chamava `logout()` sem esperar a navegação de "Já guardei, continuar"; o Firefox aborta o `goto` (`NS_BINDING_ABORTED`) | `154429e` |
| B-10 | P3 (teste, WebKit) | `qa-staging-lab.ts` | o pedido Pix sintético é pagável por 25 min; a 1ª fase do WebKit levou 29 min e a fase stripe viu (corretamente) o Pix vencido. O lab renova a janela dessa fixture no começo de cada fase | `11b122a` |

B-09 e B-10 são do ambiente de teste, não do produto: no B-10 a página mostrou exatamente o estado esperado para um Pix fora do prazo ("Estamos conferindo o seu Pix", sem QR).

A segunda violação de axe do merge bruto (texto `#484847` sobre `#9b9b9a` no carrossel de destaques) era o slide no meio do fade de 350 ms, não contraste em repouso: corrigida no teste (B-06), não no produto.

## TESTS

Tabela completa (ciclo × merge bruto × integrado) em [11_TEST_MATRIX.md](../11_TEST_MATRIX.md#cycle-05-2026-11-07--integração-com-a-evolução-de-backend). Integrado final:

| Gate | Resultado |
|---|---|
| `npm ci` / `npm audit --omit=dev` | PASS / 0 vulnerabilidades |
| `tsc` / `eslint` | PASS / PASS |
| `vitest run` | 173 arquivos / 1542 testes PASS (+20 novos neste ciclo) |
| `npm run build` (type check do Next, standalone, 35 server actions) | PASS |
| `release:guard` | 0 FAIL, 1 WARNING pré-existente (`vercel.json`) |
| Migrations em PostgreSQL 17 descartável | 18 aplicadas, em dia, sem drift |
| `qa:bf-asaas` / `qa:checkout-concurrency` | 8 + 12 provas PASS, 0 chamadas a provedor |
| Lab Chromium | 24 + 2 + 2 PASS |
| Lab Firefox (HTTPS local) | 22 + 2 + 2 PASS na rodada completa; o caso que falhou por corrida no spec (B-09) foi corrigido e o spec de segurança repetido: 8/8 PASS |
| Lab WebKit (HTTPS local) | 24 + 2 PASS; fase stripe 1/2 por fixture vencida (B-10), corrigido e pagamentos repetidos: 3 + 2 + 2 PASS |
| Suíte isolada do Admin do backend | contrato de dados + desktop 2/2 + mobile 1/1 PASS |
| Matriz responsiva do Admin do backend | 8 larguras × 14 telas + drawer PASS |
| Log do servidor / integridade do banco | 0 vazamentos / 0 anomalias em todas as rodadas |

Limites honestos: a rodada longa completa do WebKit e do Firefox não foi repetida inteira depois de B-09/B-10 (só a 1ª fase do WebKit leva ~30 min); foram repetidos os specs afetados, nas fases afetadas. Staging real, Asaas Sandbox e Stripe TEST real continuam não executados.

## SECURITY

- Nenhum segredo no diff do backend (varredura de padrões: chaves Asaas/Stripe, webhook secrets, AWS, chaves privadas, URLs de banco com senha, Resend, GitHub, Mercado Pago): 0 ocorrências.
- O documento `docs/security/CREDENTIAL_INCIDENT_202610.md` do backend não contém valores, mas registra um **incidente P0 aberto**: quatro categorias de credenciais `COMPROMISED=YES; ROTATED=NO` e `RELEASE_SECURITY_FREEZE=ACTIVE`. Isso não é código e não foi resolvido aqui: entra como bloqueio antes de merge/deploy (M-20).
- MFA, autorização do Admin, origem das server actions, webhook do Asaas e guardas de ambiente: mesmos testes do CYCLE-04, PASS no integrado.
- Endurecimento novo do backend (origem/corpo/ids) não enfraquece nada do ciclo; não há helper duplicado.

## VISUAL

Revisão por screenshots do build integrado (lab, `output/lab/screens/`, e matriz do backend, `output/playwright/results/admin-responsive-*`; artefatos locais, não versionados):

| Tela | Resultado |
|---|---|
| Home com campanha QA de Black Friday, 1920 e 320 px | faixa inteira como o hero, conteúdo alinhado ao gutter do cabeçalho, selo/CTA/painel quadrados, preço riscado + final + `-25%`, contagem em fonte da loja (B-03, B-04, B-08) |
| Card, PDP, carrinho, checkout | preço do servidor com a tipografia do redesign; seletor Pix/cartão e nota do provedor coerentes com `PAYMENT_PROVIDER` |
| Admin (shell do backend) 320–1920 | sidebar por seções com Promoções e Segurança; título do header correto nas telas do ciclo (B-01); badge de não lidas legível nos dois estados (B-02); drawer móvel com foco contido, Esc e "Sair" |
| Central de Promoções 320 px | título "Promoções", filtros empilhados, tabela rolando dentro do próprio contêiner |

Responsividade medida (sem rolagem horizontal da página):

- Lab, 10 larguras (320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920) × 12 telas da loja e do Admin do ciclo — Chromium, Firefox e WebKit.
- Matriz do backend, 8 larguras (320, 375, 390, 768, 1024, 1280, 1440, 1920) × 14 telas do Admin (incluindo Promoções, Nova promoção e Segurança) + drawer móvel — Chromium.

Acessibilidade: axe (WCAG 2.1 A/AA, sem violação séria/crítica) em 12 telas do ciclo nos três navegadores e no drawer do Admin; foco do CTA da campanha; nav com contagem anunciada por texto.

## FINAL REAUDIT

- Arquivos críticos do ciclo idênticos a `d811724` no integrado: `proxy.ts`, `auth*`, MFA (`admin-mfa*`, `totp`, páginas `/admin/mfa` e `/admin/login`), Asaas (`asaas*`, `/api/asaas`), `payment-provider-config`, `checkout*`, `promotions/*`, `/api/cart`, `env`, `email*`, rotas Stripe. `next.config.ts` só ganhou o flag de cache de dev em QA.
- Pós-merge (`21729fb..HEAD`): só correções descritas em BUGS FOUND, testes e docs; sem `console.*`, `debugger`, `.only`, `dangerouslySetInnerHTML` ou `eval` novos.
- Segredos: 0 achados reais no diff integrado × `main`; `.env.example` com chaves sensíveis vazias; nenhum `.env` no worktree; logs do lab sem nenhum dos valores sensíveis usados.
- Nenhum Sandbox PASS declarado; Stripe e rollback mantidos; Mercado Pago não reativado com `PAYMENT_PROVIDER=asaas`.
- Pendências que não são código: staging real (M-01…M-05, M-16…M-18), incidente de credenciais de staging (M-20), histórico de migrations do staging (M-21), decisão comercial da Black Friday (M-06) e revisão humana do PR.

**FINAL REAUDIT: no additional actionable findings** no escopo verificável localmente.
