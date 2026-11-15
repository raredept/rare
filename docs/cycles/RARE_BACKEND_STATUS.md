# RARE — Backend Cycle 0 Report / Status

Data da validação: 2026-10-07 (America/Sao_Paulo); timestamps de build abaixo em UTC.

```text
CURRENT_BACKEND_CYCLE=0 — INTEGRATED BUILD STABILIZATION
RESULT=BLOCKED
BACKEND_BRANCH_ISOLATED=YES
NEXT_PAGE_CONTRACTS=PASS
HEALTH_ROUTE_CONTRACT=PASS
TYPECHECK=PASS
LINT=PASS
UNIT=PASS
BUILD_GATE=BLOCKED
NO_STORE_FRONTEND_REGRESSION=YES
NO_ADMIN_BEHAVIOR_REGRESSION=YES
NO_HEALTH_SECURITY_REGRESSION=YES
RELEASE=PAUSED
RELEASE_SECURITY_FREEZE=ACTIVE
P0_CREDENTIAL_INCIDENT=OPEN
INFRASTRUCTURE_MUTATION=NO
CYCLE_1_STARTED=NO
```

## Snapshot e isolamento

- Branch backend: `codex/backend-evolution-20261007`, criada diretamente da branch frontend, sem merge.
- Base frontend/documentação preservada: `d958de086a910809fefd6d52cdd12c64e07618ec`.
- Runtime visual preservado: `83c72434b4a425daebadd2aacd5202cc4ff3671d`.
- A referência `codex/storefront-visual-overhaul-20261007` continua na base imutável. Seus relatórios registram o snapshot anterior; este documento registra a investigação backend posterior.
- `origin/main` foi atualizado por fetch normal. Antes do commit deste cycle: 49 ahead / 0 behind; a entrega acrescenta um commit lógico. HEAD e confirmação do push são apresentados no relatório final da execução.
- Fonte efetivamente construída: SHA-256 `84c491ecaed059c2a0170233e9c7c433d0d0e479c12bc178cb741a4ad305e565`, 447 arquivos pelo manifest existente. A comparação posterior confirmou que o manifest corresponde à fonte validada.
- Os dois documentos untracked do proprietário, `PROJECT_CONTEXT.md` e `V1_7_27_INVENTARIO_CREDENCIAIS_E_PLANO_HOMOLOGACAO.md`, foram preservados e excluídos da entrega.

## Contratos Next

Os quatro erros TS2344 conhecidos foram reproduzidos antes da alteração. Não houve divergência material de escopo.

| Export | Correção mínima | Resultado |
| --- | --- | --- |
| Banners page | Remover `= {}` do argumento | PASS |
| Categories page | Remover `= {}` do argumento | PASS |
| Readiness page | Remover `= {}` do argumento | PASS |
| Health GET | `request?: Request` → `request: Request` | PASS |

`searchParams?: Promise<...>` permanece opcional dentro dos três tipos de props. Testes representam ausência de parâmetros com `{}` e chamadas de health com `new Request("http://localhost/api/health")`.

Comparação dos quatro arquivos com a base, normalizando somente CRLF/LF, confirmou que os corpos das funções são idênticos e que cada arquivo possui apenas a alteração de assinatura esperada. Nenhuma supressão de TypeScript, `any`, exclusão de tipos gerados, edição de `.next/types`, mudança de scripts ou configuração Next foi introduzida.

## Qualidade e regressão

| Gate | Resultado atual |
| --- | --- |
| Lint | PASS, exit 0, repetido após os ajustes |
| Typecheck integrado | PASS, exit 0, inclusive após regeneração dos contratos pelo Webpack |
| Unit | 149 arquivos / 1.159 testes PASS, exit 0; baseline 1.150 |
| Admin relacionado | 7 suites / 29 testes PASS; inclui páginas/catalog e actions existentes com mocks |
| Health | 21 testes PASS; chamadas anônimas/Admin, headers/IP, falha de DB, warnings e não vazamento |
| Types do fixture storefront | PASS, exit 0 |
| Browser storefront | 111 PASS / 6 skips previstos / 0 FAIL / 0 flaky, exit 0 |
| Estados storefront | 8/8 PASS, exit 0 |
| Diff check / revisão independente | PASS; sem achados acionáveis nas correções/testes |
| Release static guard | 6 OK / 1 WARNING legado de cron Vercel / 0 FAIL; 94 arquivos de browser inspecionados |

Browser: Chromium desktop 36 PASS / 3 skips, Chromium mobile 39 PASS, WebKit 36 PASS / 3 skips. Inclui accessibility 40 PASS / 2 skips, console 33 PASS, keyboard 13 PASS / 2 skips, links 3 PASS e gallery 22 PASS / 2 skips. Os seis skips são cenários exclusivos mobile em projetos desktop/WebKit; não são falhas mascaradas. Esses subtotais e as suites focadas não devem ser somados novamente como cobertura independente.

O preview usou somente o harness Vite existente, transporte loopback permitido, fixtures e recusas de chamadas backend. Nenhum servidor Next foi iniciado. A matriz visual completa 44/44 não foi repetida, pois não há diff de storefront neste cycle. Evidência local regenerável/ignorada:

- `output/playwright/backend-cycle0-regression/report.json`.
- `output/playwright/backend-cycle0-states/report.json`.

Admin verifica `searchParams` ausentes/presentes e autenticação antes das queries. Health mantém os comportamentos de HTTP/status e payload anteriores, cobre endereço Cloudflare confiável/não confiável e falha de autenticação como anônimo. Prisma/auth/artifact são mockados; o fetch do teste de health é bloqueado e deve permanecer sem chamadas. O ambiente de health é composto apenas por valores sintéticos, sem herdar configuração real. Uma URL sintética com credencial foi rejeitada pelo scanner do diff e substituída por URL fictícia sem credencial; o guard não foi alterado.

## Build seguro — resultado completo

Next instalado: `16.3.8`; TypeScript instalado: `5.9.3`. Nenhum pacote/lockfile foi modificado. O wrapper existente foi mantido intacto.

| Etapa | Resultado |
| --- | --- |
| Default `npm run build` sob o wrapper seguro | TIMEOUT / NOT VERIFIED |
| Compilação Next no fallback Webpack seguro | PASS, 41s |
| TypeScript / contratos gerados Next | PASS, 5,2s |
| Geração estática | PASS, 4/4 |
| Montagem standalone pelo Next | PASS, com recusas intencionais do guard descritas abaixo |
| `prepare-standalone.mjs` | PASS, exit 0; assets e release manifest preparados |
| `check-server-actions-artifact.mjs` | FAIL: comparação de filenames Windows incompatível |
| Exit final do wrapper Webpack | 1 |
| BUILD_GATE | BLOCKED |

Execuções:

```powershell
node tests/build-storefront-safe/safe-build.mjs
node tests/build-storefront-safe/safe-build.mjs --webpack
npm run lint
npm run typecheck
npm test -- --reporter=dot
npm run release:guard
node node_modules/typescript/bin/tsc --noEmit --project tests/visual-storefront/tsconfig.json
```

- Turbopack: início `2026-10-08T02:17:30.090Z`; encerramento supervisionado `02:23:37.114Z` após cerca de 6m07 sem progresso além de compilação iniciada. Somente o processo folha da árvore verificada foi parado; os pais terminaram naturalmente. A causa do stall não foi provada. Não é PASS nem uma falha de contrato de tipos.
- Webpack: início `2026-10-08T02:23:38.138Z`, fim `2026-10-08T02:25:26.496Z`; duração total 108,358s, exit 1.
- Ambiente sanitizado, secrets/DB vazios, comércio desabilitado, leituras de `.env`/`.npmrc` recusadas e sockets/fetch Node bloqueados. O self-test do guard passou. Durante o build Webpack, o processo principal registrou 16 leituras protegidas recusadas e zero chamadas de rede Node recusadas; as duas tentativas de rede do self-test foram deliberadas e bloqueadas.
- O Next emitiu cinco warnings ao copiar traces de produtos/uploads/editor por recusa do guard. Inspeção apenas dos metadados encontrou 14 arquivos de classe `.env*` em seis traces, zero referências `.npmrc` e nenhuma dependência não protegida exigida pelo procedimento de cópia ausente do destino. Nenhum conteúdo protegido foi aberto. A proteção não foi relaxada. Os arquivos obrigatórios standalone verificados pelo checker estão presentes, BUILD_ID confere e os manifests de Server Actions build/standalone são byte-idênticos. Isso não homologa runtime ou dependências externas.
- O guard protege APIs Node, não é sandbox de sistema operacional. O artifact é exclusivo de QA, possui `commitSha=null` por sanitização e **não deve ser publicado**.

### Nova causa exata do bloqueio

Classificação: `PREEXISTING_ERROR` de compatibilidade de representação de caminho no verificador, revelado após passar pelos quatro contratos; não há medição de um build histórico completo da base.

O manifest contém 28 entries, 28 nomes de exports, workers presentes, IDs válidos e material de criptografia presente. Nenhum ID/chave/valor secreto foi exibido.

O Next/Webpack instalado produz, no Windows, filenames equivalentes a:

```text
../E:\rare\src\lib\customer-actions.ts
```

O script existente compara literalmente com caminhos repo-relative:

```text
src/lib/customer-actions.ts:logoutCustomerAction
```

Na implementação instalada `flight-client-entry-plugin.js`, o filename é produzido com `path.posix.relative(this.projectDir, modResource)`, embora esses inputs sejam caminhos Windows. Todos os 28 pares falham nessa comparação literal; a contagem 28/28 e os demais checks não falham.

Uma comparação diagnóstica em memória, reconhecendo apenas o prefixo exato deste checkout e normalizando as barras, reconciliou 28/28 pares de fonte/manifest, sem extras ou ausências. **Não** editou o manifest, o script ou a geração Next; **não** substitui o gate oficial, que continua FAIL.

Resolver esse bloqueio requer autorização separada para adaptar e testar a validação de caminhos Windows de forma restritiva, preservando a verificação exata de exports/contagem/criptografia, ou validação equivalente em ambiente explicitamente autorizado. Não foi feito ajuste em cascata fora dos quatro exports e testes relacionados.

## Files changed

Fontes:

- `src/app/admin/(protected)/banners/page.tsx`.
- `src/app/admin/(protected)/categories/page.tsx`.
- `src/app/admin/(protected)/readiness/page.tsx`.
- `src/app/api/health/route.ts`.

Testes diretamente relacionados:

- `src/app/admin/(protected)/categories/page.test.tsx`.
- `src/app/admin/(protected)/readiness/page.test.ts`.
- `src/app/api/health/route.test.ts`.
- `src/lib/admin-banners-page.test.ts`.

Documentação: este status/relatório. Commit lógico previsto: `fix(next): restore app router export contracts`.

## Behavior changes

```text
Business logic changed=NO
Admin behavior changed=NO
Health public exposure changed=NO
Storefront changed=NO
```

Mudanças de runtime limitadas aos contratos públicos de entrada esperados pelo Next. Auth, queries, filtros, actions, rendering, exposição pública, summaries e verificações de health são idênticos à base. Settings/upsert, disponibilidade/JSON-LD, sessões, credenciais, Stripe/webhooks, cron/worker, Prisma, Railway, pacote/config e frontend não possuem diff.

As práticas de debugging e estratégia de testes orientaram a reprodução antes da correção e a regressão focada em contratos/autorização/anonimato. Playwright utilizou as suites existentes e o fixture seguro, sem uma nova implementação E2E ligada a banco.

## Remaining backlog / próximo passo

1. Cycle 0: autorizar separadamente a resolução do verificador de artifact no Windows e obter exit final 0 com todos os checks íntegros. Turbopack permanece NOT VERIFIED; não substituir seu resultado por PASS.
2. Somente após o gate completo e nova autorização: Cycle 1 — pure store settings read path. `getStoreSettings()` continua com upsert; não foi alterado neste cycle.
3. Release engineering é separado. Release PAUSED, incidente OPEN e freeze ACTIVE continuam independentemente dos resultados locais. Nenhuma investigação/mutação de Railway, WARP, deploy/restart, migration, backup/restore, rotação de secrets ou produção foi feita.

Roadmap apenas registrado, sem execução automática:

| Cycle | Escopo futuro | Estado |
| --- | --- | --- |
| 1 | PURE STORE SETTINGS READ PATH | NOT STARTED |
| 2 | STOCK / STRUCTURED DATA CONSISTENCY | NOT STARTED |
| 3 | BACKEND PERFORMANCE & QUERY REVIEW | NOT STARTED |
| 4 | API / SERVICE ARCHITECTURE | NOT STARTED |
| 5 | OBSERVABILITY / ERRORS / OPERATIONS | NOT STARTED |
| 6 | ACCOUNT RECOVERY DESIGN | NOT STARTED |
| 7 | BACKEND FINAL QA | NOT STARTED |

Recuperação de senha permanece P2/design futuro; nenhuma tela/rota/token/provider foi implementado. Cycle 0 encerrado nesta entrega com resultado BLOCKED. Nenhum Cycle 1 foi iniciado.
