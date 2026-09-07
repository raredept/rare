# Investigação de erros recorrentes de Server Actions

> **Atualização de consolidação — 2026-09-07 18:45 BRT:** a migration Admin citada abaixo como pendente está pendente somente no banco local `rare_dev`; os logs do deployment Railway `125e3c45-ddfa-4158-8d05-6187bdf0be34` confirmam sua aplicação no banco remoto `railway`. O estado integrado atual tem 28 Server Actions, 98 arquivos/579 testes Vitest verdes e suíte Playwright completa encerrando naturalmente. As correções posteriores de upload, fontes e invalidação de sessões antigas não fazem parte daquele deploy. Consulte `FINAL_QA_CONSOLIDATION_REPORT.md`.

Data: 2026-09-07
Escopo: diagnóstico local, correções de baixo risco, observabilidade, testes e runbook. Nenhum commit, push, merge, tag, deploy ou alteração externa foi realizado.

## Resultado executivo

O erro `Failed to find Server Action` foi reproduzido no standalone local com uma referência sintética bem formada, mas inexistente. O Next 16.2.11 respondeu `404`, enviou `x-nextjs-action-not-found: 1` e `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`, e gerou o warning antes da execução do código normal da action. Isso comprova o mecanismo, mas não identifica qual requisição nem qual release produziu os logs históricos de produção.

Não foi encontrado defeito de organização ou export no estado inicialmente investigado: existiam 27 Server Actions em 10 arquivos dedicados, todos com `"use server"` como primeira diretiva; as 27 apareciam no manifest Node, nenhuma usava Edge, e os manifests do build e do standalone eram byte a byte idênticos. Durante a validação final, uma alteração concorrente de login Admin adicionou uma 28ª action; o gate integrado passou 28/28 em Windows e Linux. Não há export condicional, reexport ou import dinâmico de action. O artefato contém `BUILD_ID`, manifests e arquivos obrigatórios.

A causa histórica permanece na categoria **I — ainda não comprovada**. As causas mais plausíveis são A (página antiga legítima) e B (janela de deploy misto); C (cache externo), E (chave incompatível) e G (requisição sintética/hostil bem formada) continuam possíveis, mas precisam de evidência externa. D (standalone incompleto) e F (defeito local de exports) ficaram com baixa probabilidade para o artefato analisado.

Foram implementados: `deploymentId` derivado apenas de identificadores de release documentados; metadados sanitizados de startup e tentativas de action; instrumentação para falhas de execução; SHA/build público no health; recuperação manual apenas quando o próprio Next classifica a action como desconhecida; e um gate que valida automaticamente todas as actions e o standalone após cada build. Nenhuma mutação é repetida automaticamente.

## Inventário completo

Convenções da tabela:

- `A:ADMIN` significa `requireAdmin()` dentro da action; `A:CUSTOMER`, `requireCustomer()` dentro da action; `pública`, sem sessão exigida pela action.
- `DB` identifica leitura/escrita Prisma. `RL` é rate limit, que pode usar Redis compartilhado quando configurado. `R2/local` é o storage já existente; nenhum novo serviço foi adicionado.
- “controlado” significa mensagem/redirect esperado; erros inesperados continuam sendo lançados e podem chegar à instrumentação sanitizada.
- O nome da função é também o export correspondente. Todos os arquivos listados começam com `"use server"`.

| Action | Arquivo | Consumidor, rota e fluxo | Auth/papel | Validação | Efeitos, cookies, DB e externos | Redirect/revalidate | Erros e testes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `loginAction` | `src/app/admin/login/actions.ts` | `login-form.tsx`; `/admin/login`; login Admin | pública; consulta só `ADMIN` ativo | `loginSchema` | DB read, bcrypt, RL, cria cookie Admin | redirect allowlisted `/admin*`; sem revalidate | credenciais/rate limit controlados; `actions.test.ts` cobre válido, inválido, papel e payload |
| `registerCustomerAction` | `src/lib/customer-actions.ts` | `customer-auth-forms.tsx`; `/cadastro`; cadastro | pública | `customerRegisterSchema`, CPF, senha | DB create, bcrypt, RL, cria cookie Customer | redirect allowlisted para conta/cart/checkout; sem revalidate | duplicidade/persistência controladas; testes válido e inválido |
| `loginCustomerAction` | `src/lib/customer-actions.ts` | `customer-auth-forms.tsx`; `/entrar`; login cliente | pública; cliente ativo | `loginSchema` | DB read, bcrypt, RL, cria cookie Customer | redirect allowlisted; sem revalidate | credenciais/rate limit controlados; testes válido/inválido |
| `logoutCustomerAction` | `src/lib/customer-actions.ts` | página da conta; `/minha-conta`; logout | pública e idempotente; só limpa o próprio cookie | sem payload | limpa cookie Customer; sem DB | redirect `/`; sem revalidate | teste explícito de logout |
| `updateCustomerProfileAction` | `src/lib/customer-actions.ts` | `customer-profile-form.tsx`; `/minha-conta/dados`; perfil | A:CUSTOMER | `customerProfileSchema`, CPF | DB update | revalidate conta/dados; retorno controlado, sem redirect | validação controlada; suíte de auth/validators existente |
| `createCustomerAddressAction` | `src/lib/customer-actions.ts` | `customer-addresses.tsx`; `/minha-conta/enderecos`; criar endereço | A:CUSTOMER | `customerAddressSchema` | transação DB: count, default e create | revalidate endereços; retorno controlado | testes válido, payload inválido, não autenticado e falha inesperada |
| `updateCustomerAddressAction` | `src/lib/customer-actions.ts` | `customer-addresses.tsx`; mesma rota; editar endereço; bind de ID não sensível | A:CUSTOMER + ownership | schema de endereço + busca por `customerId` | DB read e transação update/default | redirect e revalidate endereços | erros de validação/not found controlados; teste de ownership e update |
| `deleteCustomerAddressAction` | `src/lib/customer-actions.ts` | `customer-addresses.tsx`; mesma rota; excluir | A:CUSTOMER + ownership | ID não vazio e busca por `customerId` | transação DB delete e promoção do próximo default | redirect e revalidate endereços | ausência vira no-op seguro/not found; teste delete/promoção |
| `setDefaultCustomerAddressAction` | `src/lib/customer-actions.ts` | `customer-addresses.tsx`; mesma rota; definir padrão | A:CUSTOMER + ownership | ID não vazio e busca por `customerId` | transação DB reset/update | redirect e revalidate endereços | not found controlado; coberto pela suíte de componente/ownership compartilhado |
| `logoutAction` | `src/app/admin/(protected)/actions.ts` | layout Admin; `/admin/*`; logout | pública e idempotente; UI protegida | sem payload | limpa cookie Admin; sem DB | redirect `/admin/login` | fluxo simples; proteção do Admin testada no proxy |
| `saveSettingsAction` | `.../(protected)/settings/actions.ts` | settings page; `/admin/settings`; configurações | A:ADMIN | `settingsFormSchema`, money/CEP/enums | DB upsert | redirect; revalidate `/` e settings | Zod lança em payload inválido; página e schema têm testes |
| `updateOrderStatusAction` | `.../(protected)/orders/actions.ts` | order detail; `/admin/orders/[id]`; status/estoque reservado | A:ADMIN | allowlist de status | DB via helper transacional de status/liberação | redirect; revalidate lista/detalhe | status inválido lança; idempotência/liberação coberta em `checkout-session.test.ts` |
| `saveOperationalEvidenceAction` | `.../(protected)/readiness/actions.ts` | readiness page; `/admin/readiness`; evidência operacional | A:ADMIN | parser Zod dedicado | DB upsert | redirect; revalidate readiness | storage indisponível controlado, inesperado relançado; testes autorizado/não autorizado/sanitização |
| `saveProductAction` | `.../(protected)/products/actions.ts` | `product-form.tsx`; novo/editar produto; bind de ID não sensível | A:ADMIN | Zod + variantes, estoque, categorias, frete, imagem | DB transacional; upload R2/local existente | redirect; revalidate home/lista/produto/categorias | falhas recuperáveis viram redirect; testes extensos de create/update/estoque/frete/imagem |
| `toggleProductActiveAction` | mesmo arquivo | products page; `/admin/products`; ativar/desativar | A:ADMIN | ID/boolean e prontidão de dimensões ao ativar | DB read/update | redirect; revalidate catálogo/Admin | bloqueio de produto sem frete testado |
| `deleteProductAction` | mesmo arquivo | products page; `/admin/products`; excluir | A:ADMIN | ID string; Prisma confirma alvo | DB read/delete | redirect; revalidate catálogo/Admin | erro inesperado relançado; integração de página testada |
| `createBannerAction` | `.../(protected)/banners/actions.ts` | `home-banner-form.tsx`; `/admin/banners`; criar | A:ADMIN | `homeBannerInputSchema`, URL interna/segura | DB create | redirect; revalidate home/Admin | validação controlada; testes de URL e criação |
| `updateBannerAction` | mesmo arquivo | mesmo componente/rota; editar | A:ADMIN | ID + schema de banner | DB update | redirect; revalidate home/Admin | not found/validação controlados; teste update |
| `toggleBannerActiveAction` | mesmo arquivo | banners page; visibilidade | A:ADMIN | ID e boolean normalizado | DB update | redirect; revalidate home/Admin | inesperado relançado; teste toggle |
| `deleteBannerAction` | mesmo arquivo | banners page; excluir/reordenar | A:ADMIN | ID não vazio | transação DB delete/reordenação | redirect; revalidate home/Admin | not found controlado; página mockada/testada |
| `moveBannerUpAction` | mesmo arquivo | banners page; ordenar | A:ADMIN | ID; limite calculado no servidor | transação DB reordenação | redirect; revalidate home/Admin | movimento fora do limite vira no-op; página/testes de reorder |
| `moveBannerDownAction` | mesmo arquivo | banners page; ordenar | A:ADMIN | igual à anterior | igual à anterior | igual à anterior | teste direto de reorder |
| `saveCategoryAction` | `.../(protected)/categories/actions.ts` | categories page/edit; `/admin/categories*`; criar/editar | A:ADMIN | `categoryFormSchema`, slug | DB read/create/update | redirect; revalidate home/Admin/categorias | validação controlada; testes de página/schema |
| `deleteCategoryAction` | mesmo arquivo | categories page; excluir | A:ADMIN | ID string; Prisma confirma alvo | DB read/delete | redirect; revalidate home/Admin/categoria | inesperado relançado; página testada |
| `toggleCategoryActiveAction` | mesmo arquivo | categories page; visibilidade | A:ADMIN | ID e boolean | DB update | redirect; revalidate home/Admin/categoria | inesperado relançado; página testada |
| `markAllAdminNotificationsReadAction` | `.../(protected)/notifications/actions.ts` | notifications page; `/admin/notifications`; marcar todas | A:ADMIN | sem payload | DB updateMany | redirect; revalidate Admin/notificações | inesperado relançado; página consumidora coberta |
| `markAdminNotificationReadAction` | mesmo arquivo | notifications page; marcar uma | A:ADMIN | ID não vazio | DB update | revalidate Admin/notificações; sem redirect | ID inválido lança; página consumidora coberta |

### Fluxos procurados que não usam Server Actions

- Recuperação de senha e verificação de e-mail: não existem no projeto atual.
- Carrinho: estado no cliente; nenhuma Server Action.
- Reserva de estoque, checkout e cupons: Route Handler `/api/checkout` e helpers transacionais; checkout continua fail-closed.
- Frete: Route Handler `/api/shipping/quote`; continua bloqueado quando checkout está desligado.
- Webhook de pagamento: Route Handler `/api/stripe/webhook`, com testes de idempotência.
- Upload administrativo: Route Handler ativo `/api/admin/uploads`; o endpoint legado `/api/admin/uploads/presign` foi posteriormente encerrado com `410 Gone` e não emite URL de escrita. `saveProductAction` também processa arquivos pelo storage existente.
- E-mail: nenhuma Server Action e driver continua desativado.

## Evidências do código e do build

1. Não existem exports condicionais, reexports de actions, runtime Edge, `use cache`, `unstable_cache`, `force-static`, `generateBuildId` anterior nem `deploymentId` anterior no código relevante.
2. Os únicos binds de action no cliente são IDs de produto e endereço. Não são secrets; as actions reautenticam e, no endereço, verificam ownership.
3. Argumentos são `FormData`, estado serializável e IDs string/null. Retornos controlados são objetos simples ou redirects. Não há closure de valor não serializável.
4. `output: "standalone"`; build executa `next build`, copia static/public e agora valida o artefato. Start Railway executa `node .next/standalone/server.js`.
5. Manifest inicial: 27 entradas Node, zero Edge; 27 nomes e 10 módulos correspondiam ao inventário. No estado integrado final: 28/28. Chave presente, sem valor exibido. Manifest e `BUILD_ID` do standalone coincidem com os equivalentes do build.
6. Duas execuções sucessivas do estado inicial mantiveram o conjunto das 27 referências e o material criptográfico iguais; os builds do estado concorrente final mantiveram 28/28. O `BUILD_ID` default mudou em relação ao artefato anterior à investigação; portanto ele não deve ser tratado como SHA reproduzível sem um deployment ID explícito.
7. Next, React, React DOM, Sharp, Prisma CLI, Client e adapter têm uma única versão efetiva: 16.2.11, 19.2.4, 19.2.4, 0.35.4 e 7.9.1 respectivamente.

## Histórico Git

Os seis commits locais à frente de `origin/main` são `3bc3cf5`, `f7e5c89`, `3816de5`, `dc1e9ff`, `b5625d8` e `1f193db`. Eles alteram flags fail-closed, carousel, checks e documentação de release; nenhum altera arquivo fonte de Server Action.

No histórico recente, as actions-base surgiram em `be5a43d`; banners em `03425fb`; readiness em `115cba8`/`288719d`; notificações em `8e0f675`; e a mudança recente de produtos em `c8040eb` acrescentou prontidão de frete. Não foi encontrada action renomeada, movida ou removida entre `origin/main` e o `HEAD` local. O histórico não foi reescrito.

## Infraestrutura documentada

| Questão | Resposta comprovada localmente |
| --- | --- |
| Build | `npm run build` → `next build`, preparação do standalone e gate de actions. |
| Start | `npm start` → `node .next/standalone/server.js`; não usa `next start`. |
| Réplicas | Não declaradas em arquivos versionados; **não comprovado externamente** no painel Railway. |
| Local do build | `railway.json` usa Railpack com `npm run build`; o build ocorre na Railway, não há imagem pré-construída versionada. |
| Sobreposição | Possível: a Railway documenta breve overlap em deploy singleton e opção de overlap configurável; valor real **não comprovado externamente**. |
| Cache persistente compartilhado | Nenhuma implementação local de cache incremental compartilhado entre releases; painel/volumes **não comprovados externamente**. |
| Cloudflare e HTML | Nenhuma configuração Cloudflare está no repositório. Uma regra ampla poderia manter HTML antigo; regras reais **não comprovadas externamente**. |
| `_next/static` | Assets são hashados/imutáveis pelo Next e copiados ao standalone. Não há regra local que sobrescreva seu cache. |
| Cache amplo | Não encontrado em código. Verificar Rules → Cache Rules/Page Rules/Workers no Cloudflare. |
| Build ID | Default não é SHA reproduzível. A correção usa `NEXT_DEPLOYMENT_ID`, `RAILWAY_DEPLOYMENT_ID` ou SHA, nesta ordem, somente se válidos. |
| SHA em runtime | Railway documenta `RAILWAY_GIT_COMMIT_SHA`; agora health/startup/logs o expõem de forma sanitizada quando presente. Disponibilidade real **não comprovada externamente**. |
| Secret entre réplicas | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` precisa ser idêntico entre servidores/builds que devem aceitar as mesmas referências. Configuração remota **não comprovada externamente** e não alterada. |
| Standalone | Contém os manifests, `BUILD_ID`, `required-server-files.json`, rotas e static/public necessários; gate automatizado passa. |

Fontes oficiais: [erro Failed to find Server Action](https://nextjs.org/docs/messages/failed-to-find-server-action), [deploymentId](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [cache em CDN](https://nextjs.org/docs/app/guides/cdn-caching), [instrumentation/onRequestError](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation), [variáveis Railway](https://docs.railway.com/variables/reference), [ciclo de deployments Railway](https://docs.railway.com/deployments/reference), [teardown/overlap Railway](https://docs.railway.com/deployments/deployment-teardown) e [replicas Railway](https://docs.railway.com/deployments/optimize-performance).

## Reprodução segura

### Action inexistente

O standalone foi iniciado em loopback. Um POST RSC para `/entrar`, contendo uma referência sintética de 42 caracteres hexadecimais e sem dados pessoais, produziu:

- HTTP 404;
- `x-nextjs-action-not-found: 1`;
- `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`;
- warning do Next idêntico ao observado;
- log sanitizado de entrada com rota, método, request ID e metadados de release;
- nenhuma execução de `loginCustomerAction`.

O `onRequestError` não foi chamado neste caminho: o Next trata a falha internamente e apenas emite warning/404. A instrumentação de `routeType: "action"` cobre falhas que escapam da execução normal, mas não deve ser apresentada como captura do warning tratado. A correlação do warning usa o log de tentativa anterior, timestamp, rota, instância e release.

### Outros cenários

- Action/payload inválido, login válido/inválido, usuário sem sessão, papel não Admin, cadastro, logout e endereço foram exercitados por testes unitários.
- Efeitos críticos duplicados permanecem cobertos pelos testes idempotentes de reserva/webhook; nenhum retry automático foi adicionado.
- Página aberta antes do deploy: o Next oferece `unstable_isUnrecognizedActionError`; a UI agora mostra atualização manual somente para essa classificação e não reenvia a mutação.
- Dois builds sucessivos do estado investigado geraram 27 referências estáveis e chave estável no cache local. A mudança concorrente posterior elevou o inventário para 28 e também passou no gate; esta investigação não criou action artificial nem alterou o Git apenas para provocar novo ID.
- Duas instâncias reais, Cloudflare e rollout Railway não foram reproduzidos porque exigiriam estado externo. O runbook abaixo descreve a confirmação segura.

## Classificação

| Categoria | Evidência | Confiança/probabilidade | Fluxos/impacto | Como confirmar | Recomendação |
| --- | --- | --- | --- | --- | --- |
| A. Referência antiga legítima | mecanismo reproduzido; Next classifica mismatch entre deployments | média/alta plausibilidade, não confirmada historicamente | qualquer formulário mantido aberto; submissão falha antes da regra de negócio | correlacionar timestamp, release do HTML e release do servidor | deployment ID, atualização manual e observar uma janela de deploy |
| B. Deploy misto | Railway documenta overlap; réplicas não estão em arquivos | média plausibilidade | intermitência durante rollout, potencialmente todos os formulários | painel: replica count, overlap, deployment IDs e logs por replica | um artefato por release; promoção/rollback sem builds simultâneos incompatíveis |
| C. Cache/CDN | nenhuma regra local; hipótese arquitetural | baixa/média | HTML antigo servido após promoção | Cloudflare Cache Rules/Page Rules/Workers, Age/CF-Cache-Status por rota dinâmica | bypass/no-store para HTML/RSC/action; purge mínimo de HTML se necessário |
| D. Standalone incompleto | manifest e arquivos presentes e idênticos; smokes Windows e Linux/WSL2 passam | baixa no artefato atual | seria falha ampla no servidor | repetir o gate na imagem Railpack/Railway exata | manter o gate pós-build |
| E. Chave incompatível | chave presente e estável nos builds locais; remoto não inspecionado | baixa/média | instâncias/builds rejeitam referências umas das outras | comparar somente fingerprints seguras/configuração no painel, nunca o valor em logs | secret único no build; mesma chave para instâncias compatíveis |
| F. Defeito de exports | 27/27 no estado investigado e 28/28 no estado integrado final | baixa | actions específicas | gate do manifest e diff de exports | nenhuma refatoração necessária |
| G. Requisição sintética/hostil | referência sintética bem formada reproduz exatamente o warning | média possibilidade, baixa evidência histórica | ruído de log; nenhuma action executada | user-agent/IP agregados no provedor, rate e rota, sem PII | não rotular como bot sem padrão; alertar por taxa/release |
| I. Não comprovada | logs históricos não têm release/rota/replica/request ID | alta confiança na classificação atual | impede atribuição única | coletar nova ocorrência com observabilidade desta etapa | seguir o runbook e não declarar causa antes da correlação |

## Correções implementadas

1. `next.config.ts` passa `deploymentId` somente quando existe `NEXT_DEPLOYMENT_ID`, `RAILWAY_DEPLOYMENT_ID` ou `RAILWAY_GIT_COMMIT_SHA` com formato seguro. O identificador ajuda o Next a detectar skew e fazer navegação completa; ele não substitui roteamento por versão no proxy/CDN.
2. `src/proxy.ts` cobre todas as rotas consumidoras atuais, gera um request ID e registra apenas rota sanitizada, método, estado genérico de autenticação, ambiente, versão, SHA/build/deployment/replica. O header `Next-Action`, cookies e payload nunca entram no record.
3. `src/instrumentation.ts` registra metadados no startup e falhas de execução de `routeType: "action"` sem copiar error, stack, headers ou IDs internos.
4. `/api/health` expõe somente SHA/build ID sanitizados além da versão já pública.
5. `global-error.tsx` usa a classificação oficial `unstable_isUnrecognizedActionError`. Somente nesse caso oferece `Atualizar página`, acionado pelo usuário; sem loop, retry ou falso sucesso.
6. `scripts/check-server-actions-artifact.mjs` descobre os exports na fonte e falha se qualquer um faltar no manifest/standalone, se contagens divergirem, se `BUILD_ID` divergir ou se arquivos obrigatórios faltarem. IDs e chave não são exibidos.
7. O build chama o gate automaticamente depois de preparar o standalone.

Esta investigação não alterou as 27 actions então existentes, schema Prisma, migrations, checkout, frete, e-mail, CSRF, autenticação ou autorização. A action 28 e a migration Admin surgiram depois por atividade concorrente e são registradas separadamente, sem atribuição a esta etapa.

## Observabilidade e limitações

Records seguros:

- `server_startup`: timestamp, ambiente, versão, release SHA, build/deployment/replica quando disponíveis;
- `server_action_request`: os campos anteriores + rota, método, request ID e papel genérico/anonimato;
- `server_action_execution_error`: os campos anteriores, sem o objeto de erro;
- `server_action_version_mismatch` no cliente: categoria fixa e pathname sanitizado, sem mensagem/stack.

Não são registrados: action ID, payload, query string, cookie, authorization, senha, token, e-mail, CPF, endereço ou stack. O log de frontend continua no console do navegador porque não existe Sentry/fornecedor autorizado; a evidência primária no servidor é a tentativa sanitizada do proxy seguida do warning nativo do Next. O warning nativo ainda inclui o ID recebido por comportamento do framework; o código da RARE não duplica esse ID.

## Testes adicionados ou ampliados

- Login Admin: válido, senha inválida, conta sem papel/permissão e payload inválido.
- Cliente: login válido/inválido, logout, cadastro válido/inválido, criação/edição/exclusão de endereço, payload inválido, ownership/auth e falha inesperada.
- Proxy: rotas de login/cadastro, acesso Admin anônimo, token de papel Customer no cookie Admin e sanitização do log.
- Observabilidade: allowlists, remoção de query/PII/secrets, falha inesperada, filtro `routeType`, release metadata.
- Recuperação: atualização manual oferecida somente quando o classificador do Next confirma action desconhecida.
- Health: SHA/build público sanitizado.
- Artefato: verificação pós-build de 27 actions no estado investigado e 28 no estado integrado final, além dos arquivos standalone.

A suíte da investigação passou de 546 para 570 testes. No estado integrado consolidado, após as mudanças de login Admin e QA, foram descobertos 98 arquivos e 579/579 testes passaram; nenhum teste existente foi enfraquecido por esta etapa.

## Validação executada

| Comando/verificação | Resultado |
| --- | --- |
| `npm ci --no-audit --no-fund` | passou; 779 pacotes; postinstall gerou Client 7.9.1 |
| `npm ls --all --json` | exit 0; npm listou seis optional-deps WASM do Sharp como `extraneous`, sem pacote inválido e sem alterar a versão nativa usada |
| `npm ls next react react-dom sharp prisma @prisma/client @prisma/adapter-pg --all` | passou; uma versão efetiva de cada; Sharp 0.35.4 deduplicado/override |
| `npm audit --omit=dev` | 3 high, o único advisory raiz conhecido de `deepmerge-ts` via Prisma CLI; sem agravamento |
| `npm run lint` | passou |
| `npm run typecheck` | passou |
| `npm test` | 98 arquivos, 579/579 testes no estado integrado consolidado |
| `npm run prisma:generate` | passou; Client 7.9.1 |
| `npx prisma validate` | schema válido |
| `npx prisma migrate status` | `rare_dev` local: 9 aplicadas e a 10ª migration Admin pendente; Railway `railway`: 10 aplicadas conforme log do pre-deploy do deployment Admin |
| builds Windows sucessivos | passaram em Next 16.2.11; inicialmente 27/27 actions e, após mudança concorrente, 28/28; manifests/standalone válidos |
| build Linux final | passou em Ubuntu 24.04/WSL2, x64, glibc 2.39 e Node 22.20.0; 28/28 actions no estado integrado e standalone válido |
| standalone Linux isolado | iniciou fora do projeto; Sharp resolveu no próprio artefato e `/_next/image` respondeu 200 `image/webp` |
| reprodução action inexistente | 404 + header not-found + no-store; nenhuma action executada |
| `npm run release:guard` | 6 OK, 0 FAIL; warning preexistente de cron Vercel legado |
| `npm run smoke:release` | 8/8 desktop/mobile passou |
| smoke standalone | duas tentativas iniciais 6/8 por configuração de storage local inválida em `NODE_ENV=production`; reinício com R2 fictício `.invalid`, sem rede/escrita, passou 8/8 |
| formulários críticos | unitários de login/cadastro/logout/endereço/Admin passaram; keyboard/resilience: 10 passaram, 1 mobile-only pulado no projeto desktop |
| busca de APIs/imports/runtime | sem export condicional, import/reexport quebrado, Edge ou API obsoleta de action; typecheck/build sem warning novo de Server Actions |

Warnings não introduzidos: `experimental.serverActions` no build, conflito `NO_COLOR`/`FORCE_COLOR` no Playwright e cron Vercel legado no release guard.

## Verificações externas pendentes

### Railway

1. Service → Settings/Deploy: confirmar Root Directory, Railpack, build/start e que não existe override divergente.
2. Service → Deployments: registrar commit SHA, deployment ID, horários de Active/Removed e overlap da janela do erro.
3. Service → Settings → Deploy/Regions/Replicas: confirmar quantidade e regiões; cada réplica deve reportar o mesmo SHA/build.
4. Variables: confirmar presença e igualdade de `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` entre builds/serviços que compartilham tráfego. Não copiar o valor para tickets/logs; comparar no provedor ou por fingerprint operacional segura.
5. Confirmar `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_DEPLOYMENT_ID` e `RAILWAY_REPLICA_ID` nos novos logs/health.
6. Confirmar `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` e qualquer healthcheck/version routing. Nenhuma dessas variáveis foi alterada aqui.

### Cloudflare

1. Caching → Cache Rules, Page Rules e Workers: procurar `Cache Everything`, TTL forçado ou cache de HTML/RSC/POST.
2. Confirmar bypass para métodos diferentes de GET/HEAD, `/admin*`, `/minha-conta*`, `/entrar`, `/cadastro`, respostas `text/x-component` e headers de actions.
3. Em HTML/RSC, verificar `Cache-Control`, `Age`, `CF-Cache-Status`, `Vary` e deployment ID; não registrar cookies/tokens.
4. Preservar cache imutável para `/_next/static/*` e não renomear assets hashados.
5. Se houver HTML antigo comprovado, purgar apenas as URLs HTML/RSC afetadas; evitar purge global como primeira ação.

## Runbook de deploy futuro

1. **Pré-condições:** worktree revisado; audit residual aceito; lint/typecheck/579 testes/Prisma/build/gates/smokes verdes; migration Admin revisada e aplicada no ambiente alvo autorizado; checkout/frete/e-mail desligados; staging isolado.
2. **Commit e build exatos:** escolher um SHA imutável e registrar SHA + deployment ID; não promover working tree não commitada.
3. **Artefato único:** executar `npm ci` e `npm run build` uma vez; guardar o standalone resultante; repetir `npm run server-actions:check` dentro da imagem Railpack/Railway exata. A execução Linux/WSL2 local já passou, mas não substitui o host final.
4. **Réplicas:** todas devem iniciar o mesmo artefato, não rebuilds independentes; comparar startup `releaseSha`/`buildId`/`deploymentId`.
5. **Secrets:** configurar `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` no build como secret base64 AES de 16/24/32 bytes e garantir o mesmo valor para instâncias que aceitam as mesmas actions; nunca logar o valor.
6. **SHA público:** chamar `/api/health` e conferir `app.release.sha` e `buildId` contra o release aprovado.
7. **Cache:** confirmar políticas antes da promoção; se necessário, invalidar apenas HTML/RSC do release anterior. Manter `/_next/static` imutável.
8. **Páginas abertas:** aceitar que submissões do release anterior podem falhar; orientar atualização manual. Nunca reenviar criação/cobrança/estoque/e-mail/admin automaticamente.
9. **Smoke login:** em staging, testar Admin e cliente válido/inválido; conferir redirect e cookie Secure/HttpOnly sem logar credenciais.
10. **Smoke cadastro:** criar apenas conta de teste autorizada; validar CPF/payload e limpar dado conforme procedimento de staging.
11. **Smoke endereço:** criar, editar, definir default e excluir endereço de teste; conferir ownership e ausência de duplicidade inesperada.
12. **Smoke Admin:** mutação reversível de produto/banner/configuração de staging; verificar auth, revalidation e rollback do dado.
13. **Logs:** filtrar `server_startup`, `server_action_request`, `server_action_execution_error` e warning nativo; agrupar por rota/release/deployment/replica, nunca por payload.
14. **Observação:** mínimo de uma janela completa de rollout + 30 minutos; ampliar ao período normal de tráfego se a ocorrência histórica for esparsa.
15. **Sucesso:** todas as réplicas no mesmo SHA/build, health aceitável, smokes verdes, nenhuma action-not-found do release atual após a janela esperada e sem aumento de 4xx/5xx.
16. **Rollback:** qualquer replica com SHA divergente, action-not-found persistente no release atual, falha de auth/formulário, health error ou regressão nos guards.
17. **Rollback sem mistura:** retirar o release novo do roteamento, aguardar/drain de suas réplicas, restaurar um único artefato anterior com seus secrets compatíveis, confirmar todas as réplicas no mesmo metadata e só então reabrir tráfego. Páginas do release abortado devem atualizar manualmente.

## Rollback local desta etapa

Como `package.json` já continha a remediação de dependências do usuário, não usar `git restore package.json` nem restaurar o lockfile. Para remover apenas esta etapa:

1. remover somente `deploymentId` e o import de `getServerActionDeploymentId` de `next.config.ts`;
2. restaurar apenas as adições de release em health e seus testes;
3. restaurar apenas a observabilidade/rotas extras de `src/proxy.ts` e testes;
4. restaurar `global-error.tsx` e `frontend-observability*` somente aos trechos anteriores;
5. remover os novos arquivos `src/instrumentation*`, `src/lib/server-action-observability*`, `src/lib/server-action-recovery*`, `src/app/admin/login/actions.test.ts` e `scripts/check-server-actions-artifact.mjs`;
6. remover apenas `server-actions:check` e o sufixo do gate no script `build`, preservando todas as versões/overrides de dependências;
7. remover somente os novos testes de `customer-actions.test.ts`;
8. repetir instalação, audit, testes, Prisma, build e smokes.

## Riscos residuais e recomendação

1. A causa dos logs históricos não é atribuível sem metadados externos; A/B/C/E/G continuam hipóteses.
2. `deploymentId` ajuda o cliente a detectar skew, mas o próprio Next documenta que version routing precisa ser implementado no host/CDN. A Railway/Cloudflare ainda deve ser validada.
3. O warning nativo do Next contém o ID recebido; a RARE não o duplica, mas sua remoção exigiria alteração intrusiva no framework/log transport e não foi feita.
4. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` remoto não foi verificado nem configurado.
5. O advisory `deepmerge-ts` do Prisma CLI permanece conforme o relatório de segurança; não foi agravado.
6. O npm 10.9.3 reporta optional-deps WASM do Sharp como `extraneous` após `npm ci`, embora o comando termine 0 e a árvore efetiva use Sharp 0.35.4. Não foi feita mutação oportunista do lockfile.
7. O standalone passou em Linux/WSL2 com dependências isoladas, mas a base exata do Railpack, suas variáveis, réplicas e roteamento continuam sem validação externa.
8. Uma alteração concorrente adicionou a 28ª action e a migration Admin durante esta validação. Ela foi preservada e passou nos gates integrados. A migration não foi aplicada ao `rare_dev` por esta etapa, mas foi aplicada separadamente ao banco Railway pelo deployment Admin identificado na atualização do topo.

**Recomendação: seguro para avançar ao próximo P0**, condicionado a tratar esta conclusão como prontidão local, não autorização de deploy. Antes de staging/produção, executar as verificações Railway/Cloudflare e o runbook acima. Se o objetivo fosse declarar a causa histórica como encerrada, a recomendação seria “não comprovado”: é necessário observar uma nova ocorrência com os metadados implementados.
