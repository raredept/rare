# RARE - Domain and deployment readiness report

> **Atualização de consolidação — 2026-09-07 18:45 BRT:** a seção 8 abaixo é um snapshot histórico anterior. O deployment Railway ativo passou a ser `125e3c45-ddfa-4158-8d05-6187bdf0be34`, criado em `2026-09-07T20:39:03.574Z`, com mensagem `Add forced password change for ADMIN 2`, origem CLI, `commitHash` ausente e image digest `sha256:59408094c198e6a18cb743cef181c78c92a26597f32894758f3aac0ac1776531`. Seus logs de pre-deploy mostram a migration `20260907150000_admin_temporary_password` aplicada no banco Railway `railway`. Esse deploy continha somente a mudança de primeiro acesso do ADMIN 2; as correções de upload, fontes, sessão vinculada à credencial e QA descritas em `FINAL_QA_CONSOLIDATION_REPORT.md` continuam apenas locais. O digest identifica a imagem, mas, sem commit/source checksum no metadata do deploy CLI, não prova sozinho identidade byte a byte com o worktree.

Data da investigação: 2026-09-07 15:49-16:08 BRT (18:49-19:08 UTC)

Escopo: diagnóstico público de DNS/TLS/HTTP, inspeção autenticada somente leitura da Railway, revisão local de domínio/canonical/autenticação/Server Actions e preparação da correção. Nenhuma configuração externa foi alterada; não houve deploy, restart, migration, commit, push, merge, tag ou ativação de checkout, frete ou e-mail.

Relatórios de referência:

- `SECURITY_DEPENDENCY_REMEDIATION_REPORT.md`
- `SERVER_ACTIONS_INVESTIGATION_REPORT.md`

## Resumo executivo

O defeito do `www` continua ativo e sua causa imediata está confirmada. `https://www.raredept.com.br` chega à borda da Railway, mas o domínio customizado `www.raredept.com.br` está sem target port e não está verificado; a resposta é o fallback JSON da Railway (`404`, `x-railway-fallback: true`). O domínio raiz está verificado, aponta para a porta `8080` e entrega a aplicação Next.js normalmente.

A correção escolhida é um **Cloudflare Single Redirect**, restrito ao hostname `www.raredept.com.br`, executado na borda antes da origem. Nenhuma mudança na Railway é necessária para essa solução. A regra exata está preparada abaixo, mas ainda não foi aplicada.

| Classificação | Estado em 2026-09-07 | Motivo |
| --- | --- | --- |
| Correção do `www` pronta para aplicar | **Sim, condicionada à conferência final do inventário de regras da Cloudflare** | Expressão, destino, status, preservação de query, validação e rollback estão definidos. Falta acesso somente leitura ao painel para excluir conflito com regra já existente. |
| Correção do `www` aplicada e validada | **Não** | Nenhuma alteração externa foi autorizada ou executada. |
| Release pronto para staging | **Pendente das validações operacionais já registradas** | Esta tarefa não alterou a aplicação nem refez a aprovação do RC. Continuam pendentes Sharp/build Linux, caso mobile anteriormente pulado, recuperação real de action desconhecida, formulários durante troca de release e confirmação do artefato/release executado. |
| Server Actions validadas em produção | **Não** | A causa histórica segue sem comprovação; a produção atual não expõe os novos metadados de release. |

## 1. Preservação do workspace

- Não há `AGENTS.md` no repositório.
- Branch local: `main`, seis commits à frente de `origin/main`, com mudanças locais preexistentes preservadas.
- HEAD local: `1f193db1b9f4dea37027024339df1861df2a1ce6` (`Enforce literal checkout enablement`).
- Após `git fetch origin`, `origin/main`: `bd1adadeb5afc394eb8a2bce181b827e799866b4` (`Fix security headers test contract`).
- Nenhum arquivo preexistente foi revertido ou sobrescrito.
- Arquivos adicionados nesta tarefa:
  - `DOMAIN_AND_DEPLOYMENT_READINESS_REPORT.md`
  - `scripts/check-domain-routing.mjs`

## 2. Evidência pública de DNS

Consultas feitas contra `1.1.1.1` em 2026-09-07 18:49 UTC. TTL é o valor observado naquele instante e pode diminuir/renovar entre consultas.

| Nome | Resposta pública observada | TTL observado | Interpretação permitida |
| --- | --- | --- | --- |
| Zona `raredept.com.br` | NS `gabriella.ns.cloudflare.com`, `jake.ns.cloudflare.com` | 86400 s | Cloudflare é o DNS autoritativo. |
| `raredept.com.br` | A `104.21.76.46`, `172.67.187.174`; AAAA `2606:4700:3036::6815:4c2e`, `2606:4700:3031::ac43:bbae` | 39 s | Tráfego público está passando pelo proxy da Cloudflare. |
| `www.raredept.com.br` | Mesmos A/AAAA da Cloudflare | 299 s | Tráfego público do `www` também está passando pelo proxy da Cloudflare. |

Não houve CNAME público visível porque a Cloudflare responde com seus endereços de proxy. Isso **não** revela o target CNAME salvo no painel, nem substitui a conferência dos campos Type, Name, Target, Proxy status e TTL.

A Railway informou, em leitura autenticada:

| Domínio | CNAME requerido pela Railway | Estado do registro segundo Railway | Verificação | Target port |
| --- | --- | --- | --- | --- |
| `raredept.com.br` | `ac0lejr6.up.railway.app` | propagated | verificado | `8080` |
| `www.raredept.com.br` | `ddlhpz66.up.railway.app` | requires update | não verificado | **ausente** |

O CNAME resolve nomes; ele não implementa o redirecionamento HTTP. Para a solução escolhida, o `www` só precisa continuar proxied na Cloudflare para que o Single Redirect encerre a requisição na borda, antes de chegar à Railway.

## 3. Evidência pública de TLS

Handshake SNI feito separadamente para os dois hostnames em 2026-09-07 18:49 UTC.

| Host | Protocolo | Certificado apresentado pela borda | Validade | Cobertura |
| --- | --- | --- | --- | --- |
| `raredept.com.br` | TLS 1.3 | Subject `CN=raredept.com.br`; issuer Google Trust Services `WE1` | 2026-09-06 23:28:02 UTC a 2026-12-06 00:25:36 UTC | SAN contém `raredept.com.br` e `*.raredept.com.br`; hostname válido. |
| `www.raredept.com.br` | TLS 1.3 | Mesmo certificado | Mesma validade | Coberto por `*.raredept.com.br`; hostname válido. |

TLS no `www` está funcional na borda da Cloudflare. O certificado público não comprova que a origem Railway tenha certificado próprio válido para `www`; a Railway reportou seu certificado desse domínio como `ISSUING`. Isso não bloqueia o redirect na borda.

## 4. Evidência pública de HTTP

Consultas GET e HEAD de baixo volume feitas entre 18:49 e 19:03 UTC. Os resultados abaixo são anteriores a qualquer correção.

| URL inicial | Status inicial / Location | Destino final | Identificação |
| --- | --- | --- | --- |
| `http://raredept.com.br/` | `301` -> `https://raredept.com.br/` | `200` | Next.js; `x-powered-by: Next.js`; Railway edge `mia1`; Cloudflare `DYNAMIC`. |
| `https://raredept.com.br/` | `200` | mesma URL | HTML da aplicação; `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. |
| `http://www.raredept.com.br/` | `301` -> `https://www.raredept.com.br/` | `404` | O host `www` é mantido; destino final é fallback da Railway. |
| `https://www.raredept.com.br/` | `404`, sem redirect | mesma URL | JSON; `x-railway-fallback: true`; `Cache-Control: public, max-age=5`; Cloudflare `DYNAMIC`. |

Rotas e query strings:

| Entrada | Cadeia observada | Resultado |
| --- | --- | --- |
| `http://raredept.com.br/sobre?utm_test=dominio` | `301` para `https://raredept.com.br/sobre?utm_test=dominio`, depois `200` | Caminho e query preservados; aplicação. |
| `http://www.raredept.com.br/sobre?utm_test=dominio` | `301` para o mesmo host em HTTPS, depois `404` | Caminho/query preservados, mas hostname não canonicalizado; fallback. |
| `https://raredept.com.br/contato?ref=domain` | `200` | Aplicação. |
| `https://www.raredept.com.br/contato?ref=domain` | `404` | Fallback Railway, não o 404 da aplicação. |
| `https://raredept.com.br/caminho%20ficticio?tag=um&tag=dois&q=espaco%20codificado` | `404` HTML com `x-powered-by: Next.js` | 404 legítimo da aplicação. |
| Mesma URL no `www` | `404` JSON com `x-railway-fallback: true` | Falha de domínio/origem. |

O header `cf-cache-status: DYNAMIC` e o `no-store` do HTML enfraquecem a hipótese de HTML atual da aplicação sendo servido do cache da Cloudflare nas amostras. Eles não comprovam ausência de Cache Rules, Workers ou Page Rules para outros caminhos/métodos.

## 5. Causa confirmada do `www`

O encadeamento de evidências é consistente e direto:

1. DNS e resposta HTTP mostram que o tráfego passa pela Cloudflare.
2. TLS da borda cobre o `www`.
3. A Railway reconhece o domínio customizado `www.raredept.com.br`, mas informa `targetPort: null`, verificação falsa, CNAME `requires update` e certificado de origem em emissão.
4. A resposta HTTPS do `www` contém `x-railway-fallback: true`.
5. O domínio raiz, no mesmo serviço/ambiente, está verificado e usa a porta `8080`.

Portanto, o 404 do `www` não é uma rota ausente no Next.js. É o fallback da borda Railway para um hostname sem rota válida até a aplicação.

O redirect já existente em `next.config.ts` é correto como defesa em profundidade: restringe pelo host, mantém `/:path*` e usa `permanent: true` (308 no Next.js). Porém ele só pode executar depois que a requisição chega à aplicação; isso não acontece hoje para o `www`.

## 6. Solução principal preparada

Criar **uma** regra em Cloudflare > Rules > Redirect Rules > Single Redirects:

| Campo | Valor exato proposto |
| --- | --- |
| Nome | `canonicalizar-www-para-apex` |
| Estado | Enabled |
| Matching | Custom filter expression |
| Condição | `(http.host eq "www.raredept.com.br")` |
| Tipo de destino | Dynamic |
| Expressão de destino | `concat("https://raredept.com.br", http.request.uri.path)` |
| Status | **308 - Permanent Redirect** |
| Preserve query string | **Enabled** |
| Ordem | Antes de qualquer outro Single Redirect que também corresponda ao `www`; em redirects, a primeira regra correspondente encerra a avaliação. |

A documentação da Cloudflare confirma a expressão `concat()` com `http.request.uri.path`, a preservação opcional da query e que 308 é permanente e preserva método/corpo. Single Redirects exigem que o hostname esteja proxied, condição já comprovada pelo tráfego público. Referências: [Single Redirects settings](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/), [exemplo mantendo path](https://developers.cloudflare.com/rules/url-forwarding/examples/perform-mobile-redirects/), [ordem das Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/order/) e [requisito de proxy](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-api/).

### Por que 308, não 301

- O domínio canônico é permanente.
- 308 preserva método e corpo; 301 pode transformar POST em GET. Isso evita uma transformação silenciosa de semântica.
- É consistente com o redirect `permanent: true` já versionado no Next.js. O Next.js usa 308 justamente para preservar método. Referência: [Next.js redirects](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects).
- Um POST de Server Action originado de uma página antiga no `www` pode ser reenviado para o apex pelo 308, mas ainda pode ser rejeitado corretamente: o browser mantém `Origin: https://www.raredept.com.br`, o Next.js compara Origin com Host/X-Forwarded-Host, e os cookies atuais são host-only. Não se deve ampliar `allowedOrigins`, compartilhar cookies ou relaxar autenticação para contornar isso. A ação segura ao usuário é recarregar/navegar para a página canônica antes de submeter. Referência: [segurança de Server Actions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions).

Como o `www` nunca deve servir a aplicação, não existe necessidade de reparar seu target port, CNAME/TXT ou certificado na Railway para esta solução. A regra Cloudflare evita tráfego do `www` na origem. Não há impedimento concreto que justifique preparar uma alternativa mais ampla neste momento.

## 7. Matriz de alteração e rollback

| Plataforma | Recurso / campo | Valor atual confirmado | Valor proposto | Impacto esperado | Como desfazer |
| --- | --- | --- | --- | --- | --- |
| Cloudflare | Single Redirect para `www` | Estado privado não acessível; publicamente o redirect não existe | Regra exata da seção 6 | `http(s)://www/...` -> `https://raredept.com.br/...`, path/query preservados | Desabilitar/remover somente a nova regra e restaurar sua posição/estado a partir da captura prévia. |
| Cloudflare DNS | Registro `www` | Tráfego está proxied; Type/Target/TTL do painel pendentes | **Sem alteração** | Mantém o hostname elegível para Single Redirect | Não aplicável. |
| Cloudflare | Cache Rules / Page Rules / Workers | Não confirmados no painel; respostas amostradas foram `DYNAMIC` | **Sem alteração** | Single Redirect deve encerrar antes da origem/cache aplicável | Não aplicável. |
| Railway | Custom domain `www` | target port ausente; não verificado; CNAME requer atualização | **Sem alteração** | Torna-se irrelevante para requisições interceptadas na Cloudflare | Não aplicável. |
| Railway | Custom domain apex | porta `8080`, verificado, certificado válido | **Sem alteração** | Preserva o domínio funcional | Não aplicável. |
| Aplicação | Redirect em `next.config.ts` | Host exato `www`, 308, path/query preservados | **Sem alteração** | Defesa em profundidade caso o host alcance a aplicação no futuro | Não aplicável. |
| Aplicação / URLs | canonical, sitemap, robots, APP/AUTH URLs | `https://raredept.com.br` | **Sem alteração** | Mantém SEO, links e callbacks no apex | Não aplicável. |
| Aplicação / cookies | admin e cliente | Secure em produção, SameSite=Lax, HttpOnly, path `/`, sem Domain | **Sem alteração** | Sessões permanecem host-only; nenhuma promessa cross-host | Não aplicável. |
| Railway / Server Actions | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` customizada | Não configurada nas variáveis efetivas salvas do serviço `rare/production` | **Sem alteração nesta tarefa** | Evita tratar hipótese como causa comprovada ou rotacionar chave sem plano | Não aplicável. |

## 8. Railway e deployment observado

Inspeção autenticada read-only com Railway CLI 5.26.0, projeto `Rare`, ambiente `production`, serviço `rare`:

| Item | Configuração observada |
| --- | --- |
| Fonte conectada | repositório `raredept/rare`, branch `main`; check suites desabilitados |
| Deployment ativo | criado em `2026-07-13T03:06:11.319Z`, `SUCCESS`, origem CLI (`cliCaller: codex`), mensagem `Publish storefront corrections and validation fix` |
| Commit do deployment ativo | **Não disponível**: deployment CLI não possui repo/branch/commitHash no metadata |
| Deployment Git imediatamente anterior | `bd1adadeb5afc394eb8a2bce181b827e799866b4`, branch `main`, estado `REMOVED`, criado sete segundos antes |
| Deployments atendendo agora | um deployment ativo; um instance record `RUNNING` e um `REMOVED` dentro dele; os nove anteriores consultados estavam `REMOVED` e um mais antigo `FAILED` |
| Réplicas / região | uma réplica em `us-east4-eqdc4a` |
| Overlap / draining explícitos | ausentes (`null`) no manifesto do deployment |
| Healthcheck | `/api/health` |
| Builder / build ativo | Railpack; `npm run build` |
| Pre-deploy efetivo do deployment | `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy` |
| Start efetivo do deployment | `PORT=${PORT:-3000} HOSTNAME=0.0.0.0 node .next/standalone/server.js` |
| Runtime | V2; saída Next standalone |

A configuração atual retornada por `railway environment config` difere do deployment ativo: `startCommand: npm run start`, `preDeployCommand: npx prisma deploy`, `configFile: ""`, além de builder/build `RAILPACK`/`npm run build`. Isso é configuração do serviço/painel, não prova o comando usado pelo artefato já ativo. O metadata do deployment mostra que `/railway.json` sobrescreveu esses valores naquele build. A Railway documenta que config-as-code é combinada com o painel por deployment e prevalece sobre os settings do serviço; ela não reescreve o painel. Referência: [Railway Config as Code](https://docs.railway.com/config-as-code/reference).

O `railway.json` local atual continua coerente com o deployment ativo e com `package.json`: produz standalone e inicia `.next/standalone/server.js`. Não foi alterado.

Uma réplica rodando e apenas um deployment ativo enfraquecem a hipótese de divergência simultânea **neste instante**, mas não eliminam sobreposição durante transições. A Railway remove o deployment anterior depois que o novo fica ativo, e overlap pode ser configurado; ausência de campo explícito não prova que nunca houve janela de coexistência. Referência: [Railway deployment lifecycle](https://docs.railway.com/deployments/reference).

## 9. Variáveis e identificação de release

Configuração não secreta observada no serviço `rare/production`:

- `APP_ENV=production`
- `APP_URL=https://raredept.com.br`
- `NEXT_PUBLIC_APP_URL=https://raredept.com.br`
- `AUTH_URL=https://raredept.com.br`
- `NEXTAUTH_URL=https://raredept.com.br`
- `CHECKOUT_ENABLED=false`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`: não configurada como variável efetiva salva
- `NEXT_DEPLOYMENT_ID`: não configurada explicitamente

Variáveis de sistema como `RAILWAY_DEPLOYMENT_ID` e `RAILWAY_REPLICA_ID` são fornecidas pela plataforma a deployments; `RAILWAY_GIT_COMMIT_SHA` só é fornecida quando o deploy se origina de gatilho GitHub. Referência: [Railway Variables Reference](https://docs.railway.com/variables/reference).

Comparação de release:

| Fonte | Identificador comprovado |
| --- | --- |
| HEAD local | `1f193db1b9f4dea37027024339df1861df2a1ce6`, mais mudanças não commitadas |
| `origin/main` após fetch | `bd1adadeb5afc394eb8a2bce181b827e799866b4` |
| Deployment ativo | deployment CLI; commit SHA não registrado |
| `/api/health` público | `app.version=0.1.0`; não contém `app.release`/build ID |

O health público é compatível com um release anterior aos novos campos, não com falha da implementação local. As mudanças locais não foram publicadas. Além disso, o SHA do HEAD não identifica integralmente um build feito a partir de working tree suja; o próximo artefato deve ser correlacionado pelo deployment ID e, para deploy Git, pelo commit SHA.

## 10. Impacto nas hipóteses de Server Actions

A classificação histórica permanece **categoria I: causa não comprovada**.

| Hipótese | Efeito das novas evidências |
| --- | --- |
| Réplicas atuais com builds divergentes | Enfraquecida para o estado atual: existe uma réplica RUNNING e um deployment ativo. Não exclui sobreposição histórica/de rollout. |
| HTML da aplicação servido atualmente de cache Cloudflare incompatível | Enfraquecida nas amostras: HTML veio `DYNAMIC` e `no-store`. Regras privadas e outros caminhos/métodos ainda não foram inventariados. |
| Deployment sem identidade rastreável | Fortalecida como limitação operacional: o ativo veio da CLI e não carrega commit hash; o health público antigo não expõe release. |
| Chave de criptografia divergente entre builds | Continua possível em builds independentes porque não há chave customizada, mas não foi observada e não torna uma action ausente disponível novamente. Não gerar/rotacionar chave nesta tarefa. |
| `www` como causa dos erros históricos de action | Não comprovada. O `www` falha antes da aplicação; isso explica o domínio, mas não os relatos de action desconhecida no apex. |
| Action ID ausente entre releases | Continua plausível durante HTML/build incompatíveis, mas sem evidência histórica suficiente para promover a causa. |

Não foi adicionado wildcard a `allowedOrigins` e nenhum controle CSRF/autenticação foi relaxado.

## 11. Estado operacional preservado

O health público retornou `ok_with_warnings` e confirmou:

- checkout: `intentionally_disabled` / `CHECKOUT_ENABLED=false`;
- e-mail: `intentionally_disabled`;
- frete da loja: `enabled=false`, modo `disabled`, provider efetivo `null`;
- Melhor Envio: `awaiting_explicit_activation`, sem token configurado;
- storage: persistent.

Embora a variável `SHIPPING_PROVIDER` esteja salva como `melhor_envio`, a configuração efetiva da loja mantém frete desativado. Nada foi alterado.

## 12. Script de verificação preparado

`scripts/check-domain-routing.mjs` faz apenas GETs públicos, segue até cinco redirects, não lê corpos de resposta e diferencia aplicação Next de fallback Railway.

PowerShell, antes da mudança (modo observação, não falha o processo apenas por divergência):

```powershell
node .\scripts\check-domain-routing.mjs --observe
```

Resultado atual: `2/7` cenários no estado-alvo; os cinco cenários `www` falham como esperado.

Depois da mudança (gate estrito):

```powershell
node .\scripts\check-domain-routing.mjs --expect-fixed
```

Esperado: `7/7`, primeiro hop dos cenários `www` em `308`, Location no apex com path/query idênticos, ausência de `x-railway-fallback` no destino e 404 fictício identificado como Next.js.

## 13. Sequência de aplicação após aprovação

1. Registrar a configuração anterior com as capturas específicas da seção 16.
2. Confirmar que o registro `www` está Proxied (orange cloud). Não mudar DNS, TLS, nameservers ou Railway.
3. Em Redirect Rules, verificar se já existe regra que corresponda a `www.raredept.com.br`. Se houver, interromper e reconciliar em vez de criar duplicata.
4. Criar a única regra com os valores exatos da seção 6 e posicioná-la antes de qualquer outro Single Redirect correspondente.
5. Salvar/deployar somente essa regra Cloudflare.
6. Validar imediatamente em PowerShell:

```powershell
curl.exe -sS -I "http://www.raredept.com.br/sobre?utm_test=dominio"
curl.exe -sS -I "https://www.raredept.com.br/contato?ref=domain"
curl.exe -sS -I "https://www.raredept.com.br/caminho%20ficticio?tag=um&tag=dois&q=espaco%20codificado"
curl.exe -sS -L --max-redirs 5 -o NUL -w "status=%{http_code} final=%{url_effective} redirects=%{num_redirects}`n" "https://www.raredept.com.br/contato?ref=domain"
node .\scripts\check-domain-routing.mjs --expect-fixed
```

7. Confirmar que `https://raredept.com.br/`, `/sobre`, `/contato` e o health continuam inalterados.
8. No navegador, usar janela InPrivate/Incognito e uma query inédita, por exemplo `?domain-check=<timestamp>`. Conferir no Network que o primeiro response é 308 e que o documento final vem do apex. Não submeter formulários no `www`.

Critérios para interromper/reverter imediatamente:

- regra corresponder ao domínio raiz;
- Location perder path, query repetida ou encoding válido;
- loop de redirects;
- destino final não ser `https://raredept.com.br`;
- apex, login ou rotas públicas regredirem;
- resposta do destino continuar com `x-railway-fallback: true`.

## 14. Rollback

1. Desabilitar a regra `canonicalizar-www-para-apex`.
2. Se a regra foi criada nova, removê-la somente após registrar seu conteúdo e confirmar que a desativação restaurou o estado anterior.
3. Não alterar o registro DNS, o domínio Railway, a porta `8080` do apex ou qualquer outra regra.
4. Repetir os mesmos comandos de observação e confirmar o retorno ao baseline registrado.

Um 308 pode ficar armazenado no navegador para a URL já visitada. Isso não significa que a regra ainda esteja ativa depois do rollback. Validar com `curl.exe`, janela privada e um path/query nunca usado; não é necessário nem recomendado purgar todo o cache da zona.

## 15. Validações executadas nesta tarefa

| Comando / verificação | Resultado |
| --- | --- |
| Leitura integral do pedido, relatórios e instruções do repositório | Concluída; `AGENTS.md` ausente. |
| `git status --short --branch` antes de editar | Mudanças preexistentes identificadas e preservadas. |
| `git fetch origin` | Sucesso; nenhuma mudança no working tree. |
| DNS A/AAAA/CNAME/NS via `Resolve-DnsName -Server 1.1.1.1` | Cloudflare autoritativa e proxied; CNAME de origem oculto publicamente. |
| TLS via `SslStream` com SNI | TLS 1.3 e SAN válido para apex e `www`. |
| GET/HEAD com `curl.exe` nas quatro origens e rotas | Apex funcional; `www` em fallback Railway; path/query registrados. |
| `railway status --json` / `environment config --json` / `deployment list --json` | Projeto/ambiente/serviço, domínio, comandos, origem, réplicas e deployments registrados sem expor segredos. |
| `railway domain status` para apex e `www` | Apex verificado em `8080`; `www` sem porta e não verificado. |
| Presença de variáveis Railway | Nenhum valor secreto registrado; chave customizada de Server Actions ausente. |
| `curl.exe https://raredept.com.br/api/health` | Release público antigo sem novos campos; guards operacionais preservados. |
| `node --check .\scripts\check-domain-routing.mjs` | Passou. |
| `node .\scripts\check-domain-routing.mjs --observe` | Executou; baseline `2/7`, com cinco falhas esperadas do `www`. |

Não foram repetidos instalação limpa, suíte completa, Prisma ou build porque não houve mudança no código da aplicação nem na configuração de build. A validação proporcional do script e da documentação é concluída na seção 17.

## 16. Informação privada ainda necessária

Não há Wrangler instalado, não há variáveis de credencial Cloudflare disponíveis e a tentativa de abrir uma sessão autenticada pelo navegador falhou porque o runtime de automação local não pôde inicializar. Para fechar a conferência pré-aplicação sem compartilhar segredos, são necessárias somente estas capturas da zona `raredept.com.br`:

1. **DNS > Records**: linha completa do `www`, mostrando Type, Name, Target, Proxy status e TTL; incluir a linha `_railway-verify.www` apenas se existir.
2. **Rules**: lista/ordem de Single Redirects e Bulk Redirects, mais Page Rules; expandir qualquer regra cujo filtro/padrão possa alcançar `www.raredept.com.br`.
3. **Workers & Pages > Routes** e **Rules > Cache Rules**: apenas entradas cujos padrões alcancem `raredept.com.br` ou `www.raredept.com.br`, com estado e ordem. Não incluir tokens, cookies, credenciais ou valores de secrets.

Essas capturas são necessárias para confirmar o target/TTL privado e excluir duplicidade/conflito de ordem. Os demais valores da regra proposta já estão confirmados.

## 17. Inspeção final

Comandos executados sobre o estado final:

```powershell
npx eslint .\scripts\check-domain-routing.mjs
git diff --check
git status --short --branch
git diff -- .\DOMAIN_AND_DEPLOYMENT_READINESS_REPORT.md .\scripts\check-domain-routing.mjs
```

Resultados:

- ESLint do script: exit code `0`, sem erros ou warnings.
- `git diff --check`: exit code `0`, sem erro de whitespace. O Git apenas informou a política local esperada de conversão LF -> CRLF em arquivos já modificados.
- As duas verificações `--no-index --check` dos arquivos novos não emitiram erro de whitespace. O exit code `1` é o retorno normal de `git diff --no-index` quando existe diferença em relação a `NUL`, não uma falha do `--check`.
- O status final preserva integralmente as mudanças anteriores e acrescenta somente este relatório e `scripts/check-domain-routing.mjs` como untracked.
- Nenhum commit, push, merge, tag, deploy, restart ou alteração externa foi feito.

## 18. Continuação autorizada em 2026-09-07

Janela desta conferência: 2026-09-07 16:18-16:22 BRT (19:18-19:22 UTC).

O responsável autorizou aplicar exclusivamente o Single Redirect descrito na seção 6, condicionado à confirmação dos pré-requisitos e da ausência de conflito impeditivo. Nenhuma autorização adicional foi inferida.

### 18.1 Pré-requisitos reavaliados

| Pré-requisito | Estado | Evidência atual |
| --- | --- | --- |
| Zona correta | **Parcialmente confirmado** | DNS autoritativo e hostname público confirmam a zona `raredept.com.br`; a seleção visual da zona no painel não pôde ser conferida porque as capturas mencionadas não chegaram como arquivos acessíveis. |
| Registro `www` proxied | **Confirmado publicamente** | `www` resolve para A da Cloudflare (`172.67.187.174` e `104.21.76.46`, TTL observado 259 s) e responde com `Server: cloudflare`/`CF-RAY`. |
| HTTPS válido no `www` | **Confirmado** | Handshake TLS 1.3 e requisição HTTPS validada pelo cliente; certificado `CN=raredept.com.br`, válido de 2026-09-06 23:28:02 UTC a 2026-12-06 00:25:36 UTC, com cobertura wildcard já registrada na seção 3. |
| Regra equivalente funcional já ativa | **Não existe** | O verificador continuou em `2/7`; HTTPS `www` retornou `404` com `x-railway-fallback: true`. Uma regra equivalente ativa e em posição efetiva teria retornado 308 para o apex. Isso não exclui rascunho, regra desabilitada ou regra ativa sem precedência. |
| Redirect do apex para `www` | **Não existe no tráfego observado** | Apex HTTP redireciona para HTTPS no próprio apex; apex HTTPS retorna 200 Next.js. Não há loop. |
| Ordem entre produtos | **Compatível por definição da plataforma** | Single Redirects executam antes de URL Rewrite, Configuration, Origin, Bulk Redirects, transforms, Cache Rules, Snippets e Cloud Connector; regras modernas prevalecem sobre Page Rules. Redirect é ação terminal. A primeira regra Single Redirect correspondente vence dentro da fase. |
| Ordem dentro de Single Redirects | **Não confirmada no painel** | Sem inventário visual/API da fase não é possível excluir uma regra Single Redirect anterior que também corresponda ao `www`. |
| Workers/regras amplas impeditivas | **Nenhum impedimento público observado; inventário privado pendente** | Uma regra ampla posterior não é automaticamente conflito, pois o novo Single Redirect encerra a requisição na primeira fase. Uma regra Single Redirect anterior é a exceção relevante. As capturas de Workers/Rules não ficaram acessíveis. |

Referências de ordem: [Cloudflare phases list](https://developers.cloudflare.com/ruleset-engine/reference/phases-list/), [order and priority](https://developers.cloudflare.com/cache/how-to/cache-rules/order/) e [Page Rules migration](https://developers.cloudflare.com/rules/reference/page-rules-migration/).

### 18.2 Acesso e aplicação

- Wrangler continua indisponível e não existem credenciais Cloudflare expostas ao processo.
- As capturas mencionadas pelo responsável não aparecem no índice de anexos nem como arquivos de imagem disponíveis para inspeção.
- A automação do navegador foi tentada novamente em modo somente leitura e falhou antes de abrir qualquer superfície: `failed to write kernel assets: O sistema não pode encontrar o caminho especificado (os error 3)`.
- Portanto, não existe nesta sessão um canal autenticado com escrita para aplicar a regra.
- **A regra não foi criada, habilitada, salva nem validada. Nenhum rollback ocorreu.**

Classificação após a autorização: **preparada, não aplicada**.

### 18.3 Preenchimento manual exato

1. Abrir o dashboard Cloudflare e selecionar a zona **`raredept.com.br`**.
2. Ir a **Rules > Overview**.
3. Selecionar **Create rule > Redirect Rule**.
4. Preencher:

| Campo do painel | Valor |
| --- | --- |
| Rule name | `canonicalizar-www-para-apex` |
| When incoming requests match | `Custom filter expression` |
| Expression | `(http.host eq "www.raredept.com.br")` |
| Then / Type | `Dynamic` |
| Target URL / Expression | `concat("https://raredept.com.br", http.request.uri.path)` |
| Status code | `308` |
| Preserve query string | habilitado |

5. Na lista de Single Redirects, colocar a nova regra **antes de qualquer outra regra Single Redirect cujo filtro também possa corresponder a `www.raredept.com.br`**. Não é necessário movê-la por causa de Cache Rules, Page Rules, Origin Rules, Bulk Redirects ou Workers posteriores, desde que não exista um Single Redirect anterior correspondente.
6. O botão que efetiva a alteração é **Deploy**. `Save as Draft` não aplica a regra.
7. Não alterar DNS, proxy, TLS, Workers, regras existentes, Railway ou código.

A documentação oficial do fluxo do painel confirma `Rules Overview > Create rule > Redirect Rule` e o botão `Deploy`: [Create a redirect rule in the dashboard](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/).

### 18.4 Baseline reexecutado após a autorização

Comando:

```powershell
node .\scripts\check-domain-routing.mjs
```

Resultado real anterior à aplicação: `2/7`.

- apex HTTP: 301 para HTTPS no apex, depois 200 Next.js;
- apex HTTPS: 200 Next.js;
- cinco cenários `www`: falharam e continuaram no fallback Railway;
- parâmetros repetidos e `%20` permaneceram na URL de fallback, mas não houve canonicalização;
- sem loop observado;
- TLS do `www` permaneceu válido.

A validação pós-aplicação ainda não pode ser executada porque a regra não foi aplicada. Após o clique manual em **Deploy**, executar sem modificar o script:

```powershell
node .\scripts\check-domain-routing.mjs --expect-fixed
```

O aceite continua sendo `7/7`, 308 no primeiro hop de todos os casos `www`, path/query preservados e nenhum `x-railway-fallback` no destino.
