# Remediação de vulnerabilidades de dependências de produção

> **Atualização de consolidação — 2026-09-07 18:45 BRT:** toda menção abaixo à migration Admin "pendente" se refere ao banco local `rare_dev`, em `localhost:5432`. A mesma migration foi aplicada com sucesso no banco Railway `railway` pelo deployment `125e3c45-ddfa-4158-8d05-6187bdf0be34`. A tarefa de upload não acessou Railway/R2 e suas correções não fazem parte daquele deploy. O estado corrente, os testes isolados e os limites de proveniência estão em `FINAL_QA_CONSOLIDATION_REPORT.md`.

Data: 2026-09-07

## Resultado executivo

A remediação reduziu o `npm audit --omit=dev` original de `13` vulnerabilidades (`8 high`, `5 moderate`) para `3 high`, `0 moderate` e `0 critical`. As três entradas finais são a propagação de um único advisory: `deepmerge-ts < 8.0.0` em `prisma > @prisma/config > deepmerge-ts`.

O Sharp foi atualizado de `0.34.5` para `0.35.4`, com uma única cópia na árvore e libvips `8.18.6` carregando corretamente. A fase estrita da atualização não exigiu adaptação das APIs de produção. Na continuação P0, o fluxo existente foi endurecido para decodificar GIF, conferir origem same-host e impedir sobrescrita no storage local; foram adicionados testes para formatos, EXIF, metadata, limites e entradas inválidas.

O pacote `prisma` não foi movido para `devDependencies`. Ele não é importado pelo runtime HTTP, mas é executado no `postinstall` e no `preDeployCommand` da Railway. A configuração Railpack atual instala dependências de desenvolvimento por padrão, porém só as remove quando `PRUNE_DEPS` é habilitado. Mover o CLI apenas faria o audit omiti-lo enquanto ele ainda precisaria existir na imagem de pre-deploy, e poderia quebrar migrations se o prune fosse habilitado. A orientação oficial da Railway é manter a ferramenta de migration em `dependencies` quando ela é chamada no pre-deploy.

Recomendação: **seguro para avançar na preparação local**, mas não equivale a autorização de deploy. O advisory residual do Prisma tem exposição prática restrita ao carregamento de configuração controlada por desenvolvedor e permanece aguardando correção upstream. Build e runtime standalone foram validados em Linux x64/glibc pelo WSL2; o Railpack/Railway e o R2 reais continuam pendentes porque não houve acesso nem mutação externa.

## Estado dos audits

| Momento | `npm audit --omit=dev` | `npm audit` completo |
| --- | --- | --- |
| início da remediação original | 13: 8 high, 5 moderate | não registrado nessa fase |
| início da fase Sharp/Prisma | 5 high | 13 high |
| final | 3 high | 11 high |

O audit de produção final contém:

| Pacote reportado | Direto | Caminho | Advisory raiz | Exposição real |
| --- | --- | --- | --- | --- |
| `prisma@7.9.1` | sim | raiz | propagação de `@prisma/config` | CLI de install/build/migration/pre-deploy; não importado por handlers |
| `@prisma/config@7.9.1` | não | `prisma > @prisma/config` | propagação de `deepmerge-ts` | carrega `prisma.config.ts` controlado pelo repositório |
| `deepmerge-ts@7.1.5` | não | `prisma > @prisma/config > deepmerge-ts` | GHSA-ggr8-5vv4-36mx | exige grafos recursivos; não recebe objetos de requisições da loja |

O audit completo final acrescenta oito entradas exclusivas do tooling de desenvolvimento: `brace-expansion` e `browserslist` pela cadeia ESLint; `extract-zip`, `@puppeteer/browsers`, `puppeteer-core`, `ip-address` e `lighthouse` pela cadeia Lighthouse/Puppeteer; e `js-yaml` pela cadeia ESLint. Elas não aparecem em `npm audit --omit=dev`.

## Alterações de dependências

| Dependência | Antes da remediação | Antes desta fase | Final | Motivo |
| --- | ---: | ---: | ---: | --- |
| `next` | 16.2.10 | 16.2.11 | 16.2.11 | patch oficial já aplicado na fase anterior |
| `eslint-config-next` | 16.2.10 | 16.2.11 | 16.2.11 | alinhamento com Next |
| `prisma` | 7.8.0 | 7.9.1 | 7.9.1 em `dependencies` | CLI necessário no pipeline Railway |
| `@prisma/client` | 7.8.0 | 7.9.1 | 7.9.1 | runtime |
| `@prisma/adapter-pg` | 7.8.0 | 7.9.1 | 7.9.1 | runtime PostgreSQL |
| `sharp` | 0.34.5 | 0.34.5 | 0.35.4 exato | corrige GHSA-f88m-g3jw-g9cj |
| `libvips` empacotado | 8.17.x/1.2.4 | 1.2.4 nos pacotes `@img` | 8.18.6/`@img` 1.3.3 | correções upstream do Sharp |
| `@aws-sdk/s3-request-presigner` | 3.1050.0 | 3.1050.0 | removido | endpoint de escrita direta encerrado; nenhum consumidor local |

Foi adicionado somente o override npm `"sharp": "$sharp"`. Ele faz o `next@16.2.11`, que ainda declara `sharp: ^0.34.5` como dependência opcional, reutilizar a versão direta e testada `0.35.4`. Sem isso, npm instalaria uma segunda cópia vulnerável sob o Next. O próprio mantenedor do Next recomenda controlar esse optional dependency por override no issue [vercel/next.js#96064](https://github.com/vercel/next.js/issues/96064). Nenhum override foi aplicado a `deepmerge-ts`.

## Sharp 0.35: breaking changes avaliadas

Fonte principal: [changelog oficial do Sharp 0.35.0](https://sharp.pixelplumbing.com/changelog/v0.35.0/) e [documentação de instalação](https://sharp.pixelplumbing.com/install/).

| Mudança | Aplicação ao projeto | Resultado |
| --- | --- | --- |
| Node.js mínimo 20.9 | relevante | ambiente local 22.20.0 e `engines >=20.9.0`; compatível |
| remoção do install script e dependência de binários prebuilt | relevante | `npm ci` instalou o binário Windows; lock contém pacotes Linux glibc/musl; carregamento nativo passou |
| novo `limitInputChannels`, default 5 | relevante como defesa adicional | imagens usuais do projeto usam 3/4 canais; testes passaram |
| ajuste de qualidade de saída AVIF | não aplicável | o gerador produz WebP; AVIF é somente entrada/original preservado |
| remoção de `failOnError` | não aplicável | o código usa `failOn: "error"` |
| remoção de `paletteBitDepth` | não aplicável | propriedade não é usada |
| remoção de propriedades antigas de `sharpen` | não aplicável | operação não é usada |
| `format.jp2k` renomeado para `format.jp2` | não aplicável | JP2 não é aceito nem processado |
| paths estáticos dos binários e tracing | relevante | Next 16.2.11 tem incompatibilidade conhecida de tracing do Sharp 0.35, corrigida no Next 16.3.0; build, standalone isolado e runtime local passaram |

O projeto usa `sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })`, `.rotate()`, `.resize({ width, withoutEnlargement: true })`, `.webp({ quality, effort: 4 })` e `.toBuffer({ resolveWithObject: true })`. Todas essas APIs continuam válidas em 0.35.4. Não há crop/extract/composite no fluxo, portanto não foi criado teste artificial para crop.

O lockfile final contém somente `node_modules/sharp@0.35.4`; `npm ls sharp` mostra o Next deduplicado nessa mesma cópia. No Windows local, `sharp.versions` reportou Sharp `0.35.4` e libvips `8.18.6`.

## Testes de imagem e controles de segurança

Os testes focados finais totalizaram 73 casos em oito arquivos e passaram integralmente. A cobertura existente e adicionada comprova:

- JPEG, PNG e WebP válidos, com geração de thumbnail 640 e medium 1200 em WebP;
- GIF decodificável preservado sem variantes; MP4 continua preservado e passa por assinatura básica de container, mas não possui decoder/transcoder;
- arquivo vazio rejeitado antes de processamento/storage;
- arquivo com assinatura válida mas conteúdo corrompido rejeitado com erro controlado;
- MIME/extensão divergentes e SVG rejeitados;
- dimensões absurdas rejeitadas pelo limite de 40 milhões de pixels;
- arquivo acima de 4 MB rejeitado no cliente e no servidor; request declarado acima de 40 MB rejeitado antes de `formData()`;
- orientação EXIF aplicada corretamente;
- metadata EXIF/orientation removida das variantes, preservando a regra existente do Sharp;
- resize sem ampliar, conversão WebP e geração de thumbnails;
- upload administrativo de produto e banner, autenticação Admin, origem same-host e rate limit;
- persistência local e integração R2 simulada, sem chamada de rede real;
- escrita sem sobrescrita: `If-None-Match: *` no R2 e `wx` local;
- erros internos do Sharp/R2 sanitizados, sem exposição de credenciais.

Os limites relevantes permanecem: 4 MB por arquivo server-routed, no máximo dez arquivos por request, `limitInputPixels=40_000_000`, allowlist de formatos e validação de assinatura. O processamento server-routed exige sessão Admin.

No fluxo real do Admin local, `ProductImageManager` e `HomeBannerForm` enviaram um PNG válido e receberam `200`; nenhum formulário de associação foi salvo. Os dois arquivos de smoke foram removidos do workspace e preservados fora dele. Uma sessão nova de navegador abriu o formulário de produto com zero erros de console; o `encType` redundante em formulário com Server Action foi removido. Restou apenas o warning de desenvolvimento já conhecido sobre `scroll-behavior: smooth`.

Associação com produto/banner ocorre depois do upload, em Server Action autenticada. Falha de banco nessa etapa pode deixar um objeto órfão. O projeto não tem deleção automática de storage: substituir/remover referência não apaga o objeto anterior, evitando exclusão prematura ou arbitrária, mas deixando a limpeza futura como decisão operacional explícita.

### SEC-IMG-003 — resolvida localmente

O frontend, componentes de produto/banner, cliente de upload, scripts e testes não possuíam consumidor do presign. A existência de consumidores externos não pode ser provada pelo repositório, por isso o contrato inseguro foi formalmente encerrado em vez de mantido por compatibilidade presumida.

Depois de autenticar o Admin, `POST /api/admin/uploads/presign` agora responde `410 Gone`, `Cache-Control: no-store`, código estável `DIRECT_UPLOAD_DISABLED` e aponta para `/api/admin/uploads`; não lê o body, não gera assinatura e não devolve URL de escrita. Requisições anônimas ou sem papel Admin continuam rejeitadas. Os helpers, limites de 100 MB e `@aws-sdk/s3-request-presigner` foram removidos de `package.json` e do lockfile.

O único fluxo ativo é server-routed: autenticação Admin, origem same-host, limite de 4 MB por arquivo/dez arquivos por request, allowlist, coerência extensão/MIME/assinatura, decodificação Sharp para imagens e limite de 40 milhões de pixels. Chaves são UUID geradas no servidor; R2 usa `If-None-Match: *` e o driver local usa `wx`. Nenhuma alteração foi feita em R2 real.

## Diagnóstico do Prisma CLI e deepmerge-ts

### Uso real

- Único import do CLI/config: `prisma.config.ts` importa `defineConfig` de `prisma/config`.
- O runtime HTTP importa `@prisma/client` e `@prisma/adapter-pg`, não `prisma`, `@prisma/config` nem internals do CLI.
- `postinstall` executa `prisma generate`.
- Scripts de desenvolvimento/admin executam `prisma generate`, `migrate dev` e `studio`.
- `railway.json` executa `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy` no pre-deploy.
- `build` não chama o CLI diretamente, mas pressupõe o Client já gerado pelo postinstall.
- O start command executa apenas `.next/standalone/server.js`.
- O artefato `.next/standalone` contém Client e Sharp, mas não contém `prisma`, `@prisma/config` ou `deepmerge-ts`.

### Decisão: manter `prisma` em dependencies

O [pre-deploy da Railway](https://docs.railway.com/deployments/pre-deploy-command) roda em container separado usando a imagem da aplicação e exige que suas dependências estejam instaladas. O código atual do [Railpack Node provider](https://raw.githubusercontent.com/railwayapp/railpack/main/core/providers/node/node.go) define `NPM_CONFIG_PRODUCTION=false`, inclui o layer de `node_modules` na imagem e só faz prune quando `PRUNE_DEPS` é verdadeiro. Não há `PRUNE_DEPS` configurado no repositório, mas variáveis externas da Railway não foram inspecionadas ou alteradas.

Mover `prisma` para `devDependencies` poderia funcionar enquanto o default do Railpack mantiver todos os dev packages, porém seria uma classificação enganosa para o artefato e quebraria o pre-deploy se `PRUNE_DEPS` fosse ativado. A própria Railway orienta manter a ferramenta de migration em `dependencies` quando ela precisa existir no pre-deploy. Portanto, a mudança não foi aplicada.

Separação futura recomendada, em tarefa própria:

1. criar uma imagem/job de migration com `prisma` e os arquivos de schema/migrations;
2. executar `prisma migrate deploy` nesse job antes da promoção;
3. publicar uma imagem runtime separada contendo apenas o standalone, `@prisma/client`, `@prisma/adapter-pg` e dependências traçadas;
4. auditar separadamente job administrativo e runtime HTTP.

### Risco residual do deepmerge-ts

O advisory GHSA-ggr8-5vv4-36mx exige dois grafos de objetos autorreferentes no mesmo caminho. O único uso pelo Prisma é como merger do `c12` durante o carregamento do `prisma.config.ts`, arquivo controlado por quem já pode executar código no host. O issue upstream [prisma/orm#30052](https://github.com/prisma/prisma/issues/30052) permanece aberto e registra que `@prisma/config` fixa exatamente `deepmerge-ts@7.1.5`; até `@prisma/config@7.10.0` continua fixando a mesma versão. A correção exige deepmerge-ts 8, que tem mudanças incompatíveis.

Mitigações atuais:

- `prisma.config.ts` é pequeno, versionado e não incorpora objetos de request;
- CLI não entra no standalone web;
- migrations são administrativas e executadas antes do runtime;
- nenhum override major, downgrade ou patch manual foi aplicado;
- acompanhar o issue upstream e atualizar Prisma/Client/adapter de forma alinhada quando houver suporte oficial.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` | passou; lockfile atualizado sem scripts |
| `npm ci --no-audit --no-fund` | passou; 779 pacotes; postinstall gerou Client 7.9.1 |
| `npm ls --all --json` | exit 0; npm marcou seis optional-deps WASM do Sharp como `extraneous`, sem pacote `invalid` |
| `npm ls next react react-dom sharp prisma @prisma/client @prisma/adapter-pg @aws-sdk/s3-request-presigner --all` | passou; versões únicas; Sharp 0.35.4 deduplicado/override; presigner ausente |
| carregamento nativo do Sharp | passou em Windows x64/Node 22.20; WebP gerado |
| `npm ci` + `npm run prisma:generate` em Linux | passou em Ubuntu 24.04/WSL2, x64, glibc 2.39, Node 22.20.0 |
| build Linux | passou em Next 16.2.11; 28/28 Server Actions no estado integrado final e standalone válido |
| `node scripts/validate-linux-standalone.mjs` | passou fora da árvore do projeto; Sharp 0.35.4/libvips 8.18.6 resolveu dentro do standalone, gerou WebP 48x32 e `/_next/image` respondeu 200 `image/webp` |
| `npm audit --omit=dev` | 3 high, um advisory raiz do deepmerge-ts |
| `npm audit` | 11 high; 3 Prisma + 8 entradas de tooling dev |
| testes focados de imagem/upload | 8 arquivos, 74/74 testes |
| `npm run lint` | passou |
| `npm run typecheck` | passou |
| `npm test` | 98 arquivos, 579/579 testes no estado integrado consolidado |
| `npm run prisma:generate` | passou; Client 7.9.1 |
| `npx prisma validate` | passou |
| `npx prisma migrate status` | antes da mudança concorrente: 9/9 aplicadas; estado final: 10 encontradas e `20260907150000_admin_temporary_password` pendente; nenhuma migration aplicada por esta etapa |
| `npm run build` no Windows | passou em Next 16.2.11/Turbopack; standalone preparado; 28/28 Server Actions no estado integrado final |
| `npm run server-actions:check` | passou; 28/28; manifests e material de criptografia presentes sem exibir valores |
| `npm run release:guard` | 6 OK, 0 FAIL; warning preexistente do cron Vercel |
| `npm run smoke:release` | execução final 8/8 desktop/mobile em 30,9 s; checkout, carrinho e frete automático continuam desativados |
| standalone com configuração local segura | health `ok_with_warnings`, zero erros; R2 fictício `.invalid`, checkout false e e-mail disabled |
| otimizador Next standalone | `/_next/image` respondeu 200 e processou `rare-logo.png` |
| smoke standalone | 8/8 passou; nenhuma credencial/serviço real usado |
| APIs Sharp removidas/depreciadas | nenhuma ocorrência no código |
| listener da porta de smoke | encerrado; nenhum processo restante na porta 3101 |

A primeira consulta manual ao otimizador usou por engano `/brand/rare-logo-black.png`, arquivo inexistente, e recebeu a rejeição esperada. A consulta correta a `/brand/rare-logo.png` passou. Isso não representa regressão do Sharp.

Warnings observados e não introduzidos pela remediação: conflito `NO_COLOR`/`FORCE_COLOR` no Playwright, sugestão LCP e `scroll-behavior` em desenvolvimento, `experimental.serverActions` no build, oferta de Prisma 8 RC e cron legado no `vercel.json`.

## Arquivos modificados

- `package.json`
- `package-lock.json`
- `src/app/api/admin/uploads/presign/route.ts`
- `src/app/api/admin/uploads/presign/route.test.ts`
- `src/app/api/admin/uploads/route.ts`
- `src/app/api/admin/uploads/route.test.ts`
- `src/components/admin/product-form.tsx`
- `src/lib/admin-product-images.test.ts`
- `src/lib/image-variants.ts`
- `src/lib/image-variants.test.ts`
- `src/lib/storage.ts`
- `src/lib/storage.test.ts`
- `src/lib/upload-limits.ts`
- `scripts/validate-linux-standalone.mjs`
- `README.md`
- `docs/media-optimization.md`
- `docs/client-handoff.md`
- `SECURITY_DEPENDENCY_REMEDIATION_REPORT.md`
- `SERVER_ACTIONS_INVESTIGATION_REPORT.md`

Nenhum schema, migration, variável externa ou serviço de produção foi alterado por esta etapa. As mudanças de runtime desta remediação são restritas ao fechamento do presign, validações de upload, escrita exclusiva e remoção de um atributo redundante do formulário. Checkout, frete e e-mail permanecem desativados. Demais alterações locais preexistentes foram preservadas e não revertidas.

Durante os gates finais, outra atividade no mesmo workspace adicionou mudanças de login Admin, `prisma/schema.prisma`, a migration `20260907150000_admin_temporary_password` e uma 28ª Server Action. Esses arquivos não pertencem a esta remediação. Eles foram preservados e incluídos nos gates integrados; a migration ficou pendente no `rare_dev` conforme a proibição desta etapa e foi aplicada separadamente no Railway pelo deployment Admin.

## Riscos residuais

1. `deepmerge-ts@7.1.5` continua reportado como high na cadeia do Prisma CLI; não é alcançável por requests normais e aguarda suporte oficial do Prisma.
2. Sharp 0.35 em Next 16.2.11 tem histórico de falha de tracing corrigida no Next 16.3.0. Windows e Linux/WSL2 passaram no standalone isolado; a imagem Railpack/Railway exata ainda não foi executada.
3. R2 real não foi chamado. Auth, falhas e comandos S3 foram testados por mock; persistência real, CORS/policy e publicação CDN dependem de staging autorizado.
4. MP4 não é decodificado/transcodificado; a defesa atual comprova apenas extensão, MIME, tamanho e assinatura básica do container.
5. Falha entre upload e associação no banco pode deixar objetos órfãos. Não há deleção automática, de modo que substituição/remoção também não elimina objetos antigos sem autorização explícita.
6. O audit completo ainda reporta 8 entradas exclusivas de tooling dev; não foram atualizadas indiscriminadamente nesta tarefa de produção.
7. A migration `20260907150000_admin_temporary_password` não está aplicada no banco local `rare_dev`; ele foi deliberadamente preservado. Ela já está aplicada no banco Railway `railway`. Qualquer outro ambiente continua exigindo `migrate status` e aplicação controlada no alvo correto.

## Classificação final desta etapa

| Frente | Estado | Evidência/limite |
| --- | --- | --- |
| Segurança do upload | concluída localmente | presign fechado em 410; nenhum emissor de write URL; validação de auth, origem, bytes, formato, pixels, limites e escrita sem overwrite |
| Fluxo Admin atual | validado localmente | produto e banner enviaram PNG real com 200; nenhuma associação foi salva; sessão limpa sem erro do formulário |
| Sharp em Linux | validado localmente | build e standalone Ubuntu/WSL2 x64/glibc; Sharp/libvips nativos, transformação WebP e `/_next/image` reais |
| R2 real | pendente externo | SDK mockado; nenhum bucket, credencial, policy ou CDN foi acessado |
| Railway/Railpack real | pendente externo | nenhuma variável, imagem, réplica, build ou serviço remoto foi acessado |
| Migration Admin concorrente | pendente somente no `rare_dev` local; aplicada no Railway `railway` | arquivo preservado, Client/schema válidos, build verde e logs do pre-deploy remoto confirmados |

**Recomendação atualizada:** a remediação de upload e a compatibilidade Linux estão **seguras para avançar à revisão e ao staging isolado**. O deployment Railway existente não contém essas correções locais; portanto, é necessário um novo release autorizado e rastreável antes de atribuí-las ao site publicado. R2 real e a imagem Railpack exata continuam sem homologação nesta etapa.

## Rollback

Como `package.json` e `package-lock.json` já continham a remediação anterior não commitada, não usar `git restore` nesses arquivos: isso também apagaria as correções de Next/Prisma/PostCSS/MySQL.

Rollback somente desta fase:

1. alterar `sharp` de `0.35.4` para `^0.34.5` em `package.json`;
2. remover somente `"sharp": "$sharp"` de `overrides`;
3. regenerar o lock de forma controlada com `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`;
4. executar `npm ci --no-audit --no-fund`;
5. opcionalmente remover apenas os novos casos de teste de EXIF/formatos/limites, sem tocar nos testes anteriores;
6. repetir audit, lint, typecheck, testes, Prisma, build e smokes.

Esse rollback reintroduz GHSA-f88m-g3jw-g9cj e só deve ser usado se surgir regressão comprovada. Não houve commit, push, merge, tag, deploy ou alteração de produção.

Para rollback delimitado da continuação P0, não usar `git restore` nos arquivos inteiros porque o worktree contém mudanças anteriores do usuário. Guardar primeiro o diff atual e aplicar um patch reverso somente aos hunks listados na seção "Arquivos modificados". Se for indispensável restaurar o contrato legado, a versão removida era `@aws-sdk/s3-request-presigner@3.1050.0`; isso também exige restaurar os helpers/limites e regenerar o lockfile, mas reabre SEC-IMG-003 e não é um rollback seguro recomendado. A alternativa operacional segura é manter `/presign` fechado em `410` e reverter apenas, conforme a regressão comprovada, a checagem de origem, decodificação GIF, flag local `wx` ou remoção de `encType`. Depois de qualquer reversão, repetir `npm ci`, audit, testes, Prisma, builds Windows/Linux, gates e smokes.
