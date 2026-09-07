# Consolidação final de QA da RARE

Data: 2026-09-07
Escopo: reconciliação dos relatórios paralelos, hardening do primeiro acesso Admin, QA isolado de uploads e responsividade, encerramento natural do Playwright e remoção da dependência de Google Fonts. Nesta consolidação não houve commit, push, merge, tag, deploy, alteração de configuração externa nem migration em banco não descartável.

## Resultado executivo

O acesso `ADMIN 2` está criado e funcional no site publicado no deployment Railway `125e3c45-ddfa-4158-8d05-6187bdf0be34`. A verificação publicada anterior autenticou com a senha temporária, exibiu a troca obrigatória e redirecionou uma tentativa de acesso direto ao painel; a sessão foi encerrada sem definir senha permanente, portanto a credencial temporária não foi consumida naquele teste. Esta consolidação não voltou a entrar nessa conta real.

O deployment publicado contém a implementação básica do primeiro acesso e a migration correspondente, mas não contém as correções locais posteriores de upload, fontes nem a invalidação criptográfica de todas as sessões anteriores após troca de senha. Essas melhorias estão verificadas localmente e ainda exigem um novo release autorizado para chegar ao site.

## 1. Reconciliação de banco, migration e deployment

| Alvo | Estado comprovado | Evidência e interpretação |
| --- | --- | --- |
| PostgreSQL local `localhost:5432/rare_dev` | 9 migrations aplicadas; `20260907150000_admin_temporary_password` pendente | `npx prisma migrate status` e `npm run release:check`; foi preservado porque esta tarefa não podia migrar banco não isolado. |
| PostgreSQL Railway `postgres.railway.internal:5432/railway` | 10 migrations aplicadas | Log do pre-deploy do deployment Admin registra aplicação da migration e `All migrations have been successfully applied`. |
| Bancos QA descartáveis | migrations aplicadas e bancos removidos ao final | `npm run qa:admin-access` criou dois bancos; `npm run qa:e2e:isolated` criou outro. Nenhum dado real foi copiado. |

A aparente contradição dos relatórios veio de alvos diferentes: a tarefa de upload consultou o `rare_dev` local depois que o arquivo da migration já existia, mas não acessou Railway. O deploy Admin aplicou a mesma migration no banco remoto Railway. Logo, “migration pendente” nunca foi uma afirmação válida sobre o banco publicado.

## 2. Conteúdo e proveniência do deployment Admin

Metadados observados em leitura autenticada:

- deployment: `125e3c45-ddfa-4158-8d05-6187bdf0be34`;
- criado em `2026-09-07T20:39:03.574Z`;
- estado `SUCCESS`;
- mensagem `Add forced password change for ADMIN 2`;
- `commitHash`: ausente;
- image digest: `sha256:59408094c198e6a18cb743cef181c78c92a26597f32894758f3aac0ac1776531`.

O upload por CLI foi preparado em worktree limpo sobre `bd1adadeb5afc394eb8a2bce181b827e799866b4` e recebeu somente estes caminhos do patch Admin:

- `prisma/schema.prisma` e `prisma/migrations/20260907150000_admin_temporary_password/migration.sql`;
- `src/lib/validators.ts` e `src/lib/auth.ts`;
- `src/app/admin/login/actions.ts` e `login-form.tsx`;
- `src/app/admin/(protected)/layout.tsx` e `src/components/admin/admin-toast.tsx`;
- `src/app/admin/change-password/actions.ts`, `change-password-form.tsx` e `page.tsx`.

As correções de upload não estavam naquele worktree/deploy. A relação é funcionalmente forte — rota publicada, comportamento de login e migration correspondem ao patch —, mas não é uma prova byte a byte: deployment CLI sem commit hash ou checksum arquivado do source não permite reconstrução criptográfica apenas pelo image digest.

## 3. Primeiro acesso Admin e sessões

O estado local consolidado:

- aceita login por e-mail ou username, sem alterar o administrador anterior;
- mantém conta pendente restrita a `/admin/change-password`;
- páginas protegidas, Route Handlers e Server Actions passam por `requireAdmin()` e consultam `mustChangePassword` atual no banco;
- troca atomicamente o hash e limpa `mustChangePassword` somente uma vez;
- a senha temporária deixa de validar após a troca;
- cada JWT Admin carrega uma versão SHA-256 do hash atual; uma troca de senha invalida outros cookies emitidos com o hash anterior;
- reaplicar `prisma migrate deploy` não recria nem restaura a senha temporária.

Impacto operacional do próximo deploy: tokens Admin emitidos pelo release antigo não têm `credentialVersion` e serão recusados, exigindo um novo login único também do administrador atual. A conta e a senha desse administrador não são alteradas.

O teste anterior que comparou hashes usou conta sintética mockada no Vitest, com `bcrypt.hash` e `bcrypt.compare` reais; não definiu senha permanente na conta publicada. Esta consolidação adicionou prova mais forte em PostgreSQL e browser reais, ambos descartáveis.

`npm run qa:admin-access` confirmou:

```text
isolatedDatabases=2
existingAdminPreserved=true
temporaryPasswordInitiallyValid=true
temporaryPasswordInvalidAfterChange=true
newPasswordValidAfterChange=true
repeatProvisioningPreservedNewPassword=true
```

`npm run qa:e2e:isolated` confirmou no Chromium desktop:

- página direta, API de upload e uma Server Action real recusadas enquanto a troca estava pendente;
- nenhuma mutação ocorreu na tentativa bloqueada;
- senha nova liberou o painel e senha temporária foi recusada;
- segundo browser com cookie anterior foi enviado novamente ao login;
- administrador sintético preexistente continuou autenticando.

## 4. Upload, persistência e QA visual isolada

O E2E descartável usou `STORAGE_DRIVER=local`, diretório exclusivo sob `output/qa-storage/` e PostgreSQL exclusivo. Ele validou:

- upload válido de PNG em produto, geração de variantes, save, reload, registro no banco, leitura HTTP e imagem no storefront;
- upload inválido posterior não substituiu a URL válida já carregada;
- o mesmo contrato para banner, com persistência no banco e renderização na Home;
- Admin, Home e catálogo sem overflow horizontal no projeto `chromium-mobile` correto.

O teste revelou e corrigiu uma inconsistência: a escrita respeitava `STORAGE_LOCAL_DIR`, mas `GET /uploads/[...path]` lia sempre `public/uploads`. A rota agora usa o diretório configurado e mantém validação de traversal e content type.

Nenhum bucket ou credencial R2 foi usado. A homologação R2 real continua externa.

## 5. Encerramento natural do Playwright

O runner agora inicia o Next diretamente, não passa por um processo intermediário do npm, nunca reutiliza servidor existente, força rate limit em memória e falha se a porta já estiver ocupada. Isso delimita propriedade e evita encerrar servidor de outra tarefa.

Evidências:

- smoke focal: 4/4, exit code 0 em 26,2 s;
- suíte completa: 117 passed, 15 skips condicionais esperados, exit code 0 em 162,95 s;
- execução QA isolada: 2 desktop + 1 mobile aprovados em 39,5 s;
- porta 3100 livre depois das execuções;
- nenhum `process.exit`, timeout de sucesso ou encerramento de processos alheios foi adicionado.

Os skips da suíte pública são por projeto: controles mobile não rodam em desktop/WebKit e alto contraste não roda no perfil mobile. O cenário mobile solicitado foi executado e aprovado no `chromium-mobile` isolado.

## 6. Fontes locais e build sem rede de fontes

`next/font/google` foi removido. Geist Sans e Geist Mono continuam como fontes variáveis 100-900, agora em subconjuntos latinos WOFF2 locais derivados dos arquivos oficiais Geist 1.7.2:

- Sans: 32.736 bytes;
- Mono: 34.184 bytes;
- licença: SIL Open Font License em `src/app/fonts/LICENSE-Geist.txt`.

O build de produção passou com `HTTP_PROXY`, `HTTPS_PROXY` e `ALL_PROXY` apontados para `127.0.0.1:9`. Isso prova que, com dependências já instaladas, o build não consulta serviços de fontes. Não prova instalação npm totalmente offline: `npm ci` ainda precisa do registry ou de cache prévio para as demais dependências.

O primeiro uso do arquivo Geist completo elevou a fonte pública a 70.166 B e falhou o teto de 36.000 B. O subconjunto local corrigiu a regressão sem alterar o orçamento: a nova medição transferiu 33.249 B de fonte e passou.

## 7. Gates finais

| Gate | Resultado consolidado |
| --- | --- |
| `npm run lint` | PASS, sem warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 98 arquivos e 579/579 testes |
| `npm run build` com rede externa de fontes bloqueada | PASS |
| `npm run server-actions:check` | PASS, 28 exports no build e standalone |
| `npm run release:guard` | PASS, 6 OK, 0 FAIL; warning conhecido de cron Vercel legado |
| `npm run test:e2e` | PASS, 117 passed/15 skipped, saída natural |
| `npm run lighthouse` | PASS, 8 medições, `failures: []` |
| `npm run qa:admin-access` | PASS, banco descartável removido |
| `npm run qa:e2e:isolated` | PASS, banco/storage descartáveis removidos |
| diff check do `release:check` | PASS |
| `npx prisma migrate status` no `rare_dev` | FAIL esperado: migration Admin local pendente |
| `npm audit --omit=dev` | 3 high residuais, todos o mesmo advisory `deepmerge-ts` propagado pelo Prisma CLI |
| `npm audit` completo | 11 high: inclui cadeias de tooling do Lighthouse/ESLint e os 3 do Prisma; atualização automática propõe mudanças amplas/major e não foi aplicada oportunisticamente |

Último Lighthouse: performance mobile pública mínima 89, desktop mínima 99, accessibility/best practices 100, SEO público 100, LCP máximo mobile 3.766 ms, CLS 0, TBT máximo 47 ms, fonte 33.249 B e transferência máxima 508.376 B.

## 8. Estado publicado versus local

| Capacidade | Site publicado | Worktree local |
| --- | --- | --- |
| ADMIN 2 criado e migration aplicada | Sim | arquivo presente; `rare_dev` ainda não migrado |
| Primeiro login exige nova senha | Confirmado no site | Confirmado em browser isolado |
| Senha temporária deixa de funcionar após troca | Implementação publicada; não consumida na conta real durante a verificação | Confirmado em banco/browser sintéticos |
| Sessões anteriores invalidadas após troca | Não faz parte do deploy identificado | Implementado e confirmado |
| Upload endurecido/Sharp/Server Actions consolidados | Não fazem parte do deploy identificado | Implementados e gates verdes |
| Fontes locais | Não faz parte do deploy identificado | Implementado, build/Lighthouse verdes |
| Correção de leitura de storage local configurado | Não faz parte do deploy identificado | Implementada e E2E verde |

## 9. Pendências que exigem autorização ou ambiente externo

- publicar um release novo, rastreável e revisado para levar ao site as correções locais posteriores ao deploy Admin;
- aplicar a migration no `rare_dev` apenas se esse banco local for escolhido para uso; esta consolidação não o alterou;
- validar upload e persistência no R2 real em staging;
- corrigir/ativar o redirect `www` na Cloudflare e validar DNS/TLS/HTTP;
- confirmar build Railpack/Railway exato, identidade de release e comportamento durante rollout;
- tratar cron Vercel legado antes de eliminar o rollback;
- manter Stripe, Melhor Envio, Redis compartilhado e go-live fora desta etapa até homologação/autorização.

Nenhuma dessas pendências foi ocultada por mocks ou por sucesso forçado.
