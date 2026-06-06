# Checklist de variáveis de ambiente — RARE

Este documento é o checklist operacional para configurar a RARE na Vercel. Ele usa somente nomes de variáveis encontrados no projeto e não contém secrets reais.

## 1. Avisos importantes

- Este documento não contém secrets reais. Os exemplos com `...` indicam apenas formato.
- O cliente deve preencher os valores reais no painel da Vercel, nunca em commit, WhatsApp ou chat aberto.
- Depois de adicionar ou alterar envs na Vercel, faça redeploy do ambiente afetado.
- Se a release incluir migration Prisma, siga também [deploy-with-migrations.md](./deploy-with-migrations.md) e use `npx prisma migrate deploy` no banco correto.
- Preview/Staging deve usar Stripe test mode.
- Production só deve usar Stripe live quando a venda aberta estiver autorizada.
- Redis/Upstash precisa ser criado fora do projeto e depois conectado via envs.
- Banco de produção não deve ser usado em smoke de staging, local ou homologação.
- Enquanto venda aberta não estiver liberada, mantenha `CHECKOUT_ENABLED=false` em Production. No código atual, checkout sem essa env explícita não fica bloqueado.
- Não transforme `Content-Security-Policy-Report-Only` em enforcement durante esta etapa.

## 2. Onde configurar na Vercel

1. Abra o Vercel Dashboard.
2. Entre no projeto RARE.
3. Vá em **Settings**.
4. Abra **Environment Variables**.
5. Escolha o ambiente correto:
   - **Production** para `https://raredept.com.br`;
   - **Preview** para staging/homologação;
   - **Development**, se o fluxo local usar envs sincronizadas pela Vercel CLI.
6. Adicione ou edite as envs.
7. Salve.
8. Faça redeploy do ambiente alterado.

Variáveis como `NODE_ENV`, `VERCEL`, `VERCEL_ENV` e `VERCEL_URL` são gerenciadas pela plataforma quando aplicável. Não sobrescreva sem motivo operacional claro.

## 3. Envs obrigatórias para Production

| Variável | Exemplo seguro | Obrigatória? | Descrição | Observações |
| --- | --- | --- | --- | --- |
| `APP_ENV` | `production` | Sim | Identifica o ambiente operacional para scripts e guards. | Use `production` somente no ambiente Production. |
| `APP_URL` | `https://raredept.com.br` | Sim | URL canônica server-side. | Deve apontar para o domínio público final. |
| `NEXT_PUBLIC_APP_URL` | `https://raredept.com.br` | Sim | URL pública enviada ao bundle do browser. | Deve apontar para a mesma origem de produção. |
| `DATABASE_URL` | `postgresql://...production...` | Sim | Banco PostgreSQL de produção. | Não reutilizar este banco em staging/local/smoke. |
| `ADMIN_SESSION_SECRET` | `...32+ caracteres...` | Sim | Secret de sessão do Admin. | `AUTH_SECRET` também é aceito como alias, mas prefira `ADMIN_SESSION_SECRET`. |
| `AUTH_SECRET` | `...32+ caracteres...` | Condicional | Alias server-side para secret de sessão. | Use somente se optar por não preencher `ADMIN_SESSION_SECRET`. |
| `CHECKOUT_ENABLED` | `false` | Sim | Controla se checkout pode ser usado. | Antes da liberação de venda, manter `false`; depois da homologação aprovada, alterar para `true`. |
| `RATE_LIMIT_DRIVER` | `redis` | Sim para produção aberta | Define o backend de rate limit. | `memory` gera warning e não é compartilhado entre instâncias. |
| `UPSTASH_REDIS_REST_URL` | `https://...` | Sim com `RATE_LIMIT_DRIVER=redis` | URL REST HTTPS do Redis/Upstash. | Alternativa aceita: `REDIS_REST_URL`. |
| `UPSTASH_REDIS_REST_TOKEN` | `...` | Sim com `RATE_LIMIT_DRIVER=redis` | Token REST do Redis/Upstash. | Alternativa aceita: `REDIS_REST_TOKEN`. |
| `RATE_LIMIT_REDIS_PREFIX` | `rare:rate-limit` | Não | Prefixo das chaves de rate limit. | Manter padrão salvo necessidade operacional. |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Sim quando `CHECKOUT_ENABLED=true` | Chave secreta Stripe do ambiente live. | Use live somente em Production e após autorização de venda aberta. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Sim quando `CHECKOUT_ENABLED=true` | Secret de assinatura do webhook Stripe live. | Deve ser do webhook live separado para `/api/stripe/webhook`. |
| `STRIPE_PAYMENT_METHOD_TYPES` | `card,pix` | Não | Restringe métodos do Stripe Checkout quando preenchida. | Deixe vazio para métodos dinâmicos do Dashboard; use `pix` só após confirmar elegibilidade. |
| `STORAGE_DRIVER` | `r2` | Sim | Driver de upload persistente. | Em produção na Vercel, use R2. |
| `UPLOAD_DRIVER` | `r2` | Não | Alias legado aceito para storage. | Prefira `STORAGE_DRIVER`. |
| `STORAGE_PUBLIC_BASE_URL` | `https://...` | Condicional | Base pública dos uploads. | Pode substituir `R2_PUBLIC_BASE_URL` se for a URL pública correta. |
| `R2_ACCOUNT_ID` | `...` | Sim com `STORAGE_DRIVER=r2` | Account ID do Cloudflare R2. | Configurar só na Vercel/ambiente seguro. |
| `R2_BUCKET` | `rare-media` | Sim com `STORAGE_DRIVER=r2` | Bucket usado para uploads. | Use bucket de produção. |
| `R2_ACCESS_KEY_ID` | `...` | Sim com `STORAGE_DRIVER=r2` | Access key do R2. | Secret operacional; não enviar por chat. |
| `R2_SECRET_ACCESS_KEY` | `...` | Sim com `STORAGE_DRIVER=r2` | Secret key do R2. | Secret operacional; não commitar. |
| `R2_PUBLIC_BASE_URL` | `https://...` | Sim com `STORAGE_DRIVER=r2`, salvo uso de `STORAGE_PUBLIC_BASE_URL` | URL pública para servir uploads. | Deve ser absoluta e começar com `http(s)`. |
| `MAX_UPLOAD_SIZE_MB` | `4` | Não | Limite geral de upload server-side. | Na Vercel o limite efetivo fica restrito ao payload da Function. |
| `MAX_GIF_UPLOAD_SIZE_MB` | `4` | Não | Limite específico para GIF. | Manter compatível com limite operacional. |
| `MAX_VIDEO_UPLOAD_SIZE_MB` | `4` | Não | Limite específico para MP4. | Cards/listagens não devem carregar MP4 pesado diretamente. |
| `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` | `false` | Não | Override de risco para storage local em produção. | Deve permanecer `false` para venda aberta. |
| `SHIPPING_ENABLED` | `true` | Não | Liga/desliga frete por env. | Se ausente, o frete fica habilitado pelo comportamento padrão. |
| `SHIPPING_PROVIDER` | `melhor_envio` | Sim para frete real | Provider de frete usado pelo backend. | Provider principal da RARE em produção/homologação. |
| `SHIPPING_ORIGIN_CEP` | `31170350` | Condicional | CEP de origem fallback. | O app prioriza `StoreSettings.originCep`; esta env é fallback operacional. |
| `MELHOR_ENVIO_TOKEN` | `...` | Sim com `SHIPPING_PROVIDER=melhor_envio` | Token Bearer do Melhor Envio. | Também é aceito `MELHOR_ENVIO_ACCESS_TOKEN`. |
| `MELHOR_ENVIO_ACCESS_TOKEN` | `...` | Condicional | Alias/token de acesso do Melhor Envio. | Use se este for o token emitido pelo fluxo OAuth. |
| `MELHOR_ENVIO_CLIENT_ID` | `...` | Condicional | Client ID OAuth do Melhor Envio. | Sozinho não libera cotação; o token final continua necessário. |
| `MELHOR_ENVIO_CLIENT_SECRET` | `...` | Condicional | Client secret OAuth do Melhor Envio. | Não substitui `MELHOR_ENVIO_TOKEN`/`MELHOR_ENVIO_ACCESS_TOKEN`. |
| `MELHOR_ENVIO_REDIRECT_URI` | `https://raredept.com.br/...` | Condicional | Redirect URI OAuth, se o cliente usar OAuth. | Não é necessário para token já emitido. |
| `MELHOR_ENVIO_ENV` | `production` | Sim com Melhor Envio real | Seleciona base padrão do Melhor Envio. | Valores aceitos pelo app: `production` ou `sandbox`. |
| `MELHOR_ENVIO_BASE_URL` | `https://...` | Não | Override da URL do Melhor Envio. | Se vazio, production usa `https://www.melhorenvio.com.br`. |
| `MELHOR_ENVIO_SERVICES` | `1,2` | Não | Serviços solicitados na cotação. | Padrão inicial do projeto: `1,2`. |
| `MELHOR_ENVIO_USER_AGENT` | `RARE Store (raredept.com.br)` | Não | User-Agent enviado à API do Melhor Envio. | Manter identificável. |
| `CRON_SECRET` | `...32+ caracteres...` | Sim para cron de reservas | Protege `/api/cron/release-expired-inventory`. | Sem o segredo, a rota não libera reservas. |
| `ADMIN_EMAIL` | `contato@raredept.com.br` | Condicional | E-mail usado pelo script `admin:create`. | Necessário para criar/atualizar admin via script, não para sessão normal já criada. |
| `ADMIN_PASSWORD` | `...senha forte...` | Condicional | Senha usada pelo script `admin:create`. | Não deixar na Vercel se não houver necessidade operacional. |

Variáveis reais preparadas, mas não esperadas para o fluxo principal atual: `CORREIOS_USER`, `CORREIOS_TOKEN`, `FRENET_TOKEN`, `MANUAL_SHIPPING_PAC_BASE_CENTS`, `MANUAL_SHIPPING_PAC_PER_KG_CENTS`, `MANUAL_SHIPPING_SEDEX_BASE_CENTS`, `MANUAL_SHIPPING_SEDEX_PER_KG_CENTS`, `MANUAL_SHIPPING_PAC_DAYS_MIN`, `MANUAL_SHIPPING_PAC_DAYS_MAX`, `MANUAL_SHIPPING_SEDEX_DAYS_MIN`, `MANUAL_SHIPPING_SEDEX_DAYS_MAX`, `CONFIRM_PRODUCTION_SEED`, `CONFIRM_PRODUCTION_ADMIN`, `CONFIRM_REAL_CATALOG_IMPORT` e `CONFIRM_LEGACY_BAGS_REMAP`. Não configure como requisito de venda aberta salvo operação específica aprovada.

## 4. Envs obrigatórias para Preview/Staging

Use Preview/Staging para homologar antes da venda aberta. Nunca use Stripe live nem banco de produção neste ambiente.

| Variável | Exemplo seguro | Obrigatória? | Descrição | Observações |
| --- | --- | --- | --- | --- |
| `APP_ENV` | `staging` | Sim | Sinaliza ambiente seguro para smoke. | O guard também aceita `preview`, `stage` ou `homologacao`. |
| `APP_URL` | `https://rare-staging.vercel.app` | Sim | URL server-side do staging. | Deve apontar para a URL que será testada. |
| `NEXT_PUBLIC_APP_URL` | `https://rare-staging.vercel.app` | Sim | URL pública do staging. | Deve bater com `APP_URL`. |
| `CHECKOUT_ENABLED` | `true` | Sim para homologar checkout | Permite abrir o fluxo de checkout em staging. | Usar somente com Stripe test e banco isolado. |
| `DATABASE_URL` | `postgresql://...staging-isolado...` | Sim | Banco isolado de staging. | Nunca apontar para produção. |
| `ADMIN_SESSION_SECRET` | `...32+ caracteres...` | Sim | Secret de sessão do Admin staging. | Pode ser diferente da Production. |
| `RATE_LIMIT_DRIVER` | `redis` | Recomendado | Mantém comportamento próximo de produção. | `memory` é aceitável só em dev/test local. |
| `UPSTASH_REDIS_REST_URL` | `https://...` | Sim com Redis | URL REST do Redis/Upstash de staging. | Pode usar instância separada ou prefixo separado. |
| `UPSTASH_REDIS_REST_TOKEN` | `...` | Sim com Redis | Token REST do Redis/Upstash de staging. | Secret de staging. |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Sim para checkout smoke | Chave secreta Stripe test mode. | Nunca usar `sk_live_` em staging. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Sim para checkout smoke | Secret do webhook Stripe test mode. | Criar webhook test próprio para `/api/stripe/webhook`. |
| `CHECKOUT_SMOKE_WEBHOOK_URL` | `https://rare-staging.vercel.app/api/stripe/webhook` | Recomendado para smoke | URL usada pelo guard de checkout. | `STRIPE_WEBHOOK_URL` também é aceito pelo guard. |
| `CHECKOUT_SMOKE_ALLOW_REMOTE_DATABASE` | `true` | Condicional | Confirma que o DB remoto é staging/test. | Use somente após confirmar que não é produção. |
| `CHECKOUT_SMOKE_ALLOW_PRODUCTION_URL` | `false` | Não | Override que permite domínio de produção no guard. | Não use em staging normal. |
| `STORAGE_DRIVER` | `r2` | Recomendado | Storage persistente para homologar uploads. | Use bucket/prefixo de staging quando possível. |
| `R2_ACCOUNT_ID` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | `...` | Sim com R2 | Credenciais R2 de staging. | Não reutilizar secrets por chat. |
| `R2_PUBLIC_BASE_URL` ou `STORAGE_PUBLIC_BASE_URL` | `https://...` | Sim com R2 | URL pública dos uploads. | Validar carregamento de produto/banner. |
| `SHIPPING_PROVIDER` | `melhor_envio` | Sim para frete real | Provider de frete de homologação. | Para sandbox, combine com `MELHOR_ENVIO_ENV=sandbox`. |
| `MELHOR_ENVIO_TOKEN` ou `MELHOR_ENVIO_ACCESS_TOKEN` | `...` | Sim com Melhor Envio | Token do Melhor Envio. | Usar token de homologação/sandbox se disponível. |
| `MELHOR_ENVIO_ENV` | `sandbox` | Recomendado para homologação | Seleciona sandbox quando aplicável. | Se vazio ou `production`, usa base de produção do Melhor Envio. |
| `CRON_SECRET` | `...32+ caracteres...` | Recomendado | Protege liberação de reservas. | Necessário para validar expiração/cancelamento operacional. |

Staging deve ter ao menos um produto ativo com estoque, preço, peso, comprimento, largura e altura reais. É neste ambiente que o smoke real do checkout deve acontecer primeiro, com cartão de teste Stripe e pedido de teste aparecendo no Admin.

## 5. Envs para desenvolvimento local

Configuração segura para desenvolvimento:

```env
APP_ENV=development
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
CHECKOUT_ENABLED=false
RATE_LIMIT_DRIVER=memory
STORAGE_DRIVER=local
STORAGE_PUBLIC_BASE_URL=/uploads
```

Regras locais:

- Local não precisa Redis.
- Local não deve usar `sk_live_`.
- Local não deve usar banco de produção.
- Para testar apenas o guard do checkout, use valores fictícios com prefixos de teste (`sk_test_...` e `whsec_...`) somente se o script aceitar e o banco for local/isolado.
- Para smoke real local, use apenas Stripe test mode, webhook test/Stripe CLI e banco isolado.
- `SHADOW_DATABASE_URL` é usado por `prisma migrate dev` e deve apontar para um banco limpo separado do `DATABASE_URL`.

## 6. Como criar Redis/Upstash

1. Acesse ou crie a conta Upstash.
2. Crie um Redis Serverless.
3. Copie a REST URL HTTPS.
4. Copie o REST Token.
5. Configure na Vercel:

```env
RATE_LIMIT_DRIVER=redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

6. Faça redeploy.
7. Valide `/api/health`.

Resultado esperado no health:

- `environment.rateLimit.configuredDriver` igual a `redis`;
- `environment.rateLimit.activeDriver` igual a `redis`;
- `environment.rateLimit.shared` igual a `true`;
- `environment.rateLimit.redisRestUrlConfigured` igual a `true`;
- `environment.rateLimit.redisRestTokenConfigured` igual a `true`;
- sem warning de `RATE_LIMIT_DRIVER=memory`.

Mais detalhes estão em [docs/rate-limit.md](./rate-limit.md).

## 7. Como configurar Stripe test mode

1. Entre no Stripe Dashboard.
2. Ative o modo teste.
3. Copie uma chave secreta test mode no formato `sk_test_...`.
4. Crie um webhook test apontando para:

```text
https://rare-staging.vercel.app/api/stripe/webhook
```

5. Copie o signing secret no formato `whsec_...`.
6. Configure no ambiente Preview/Staging da Vercel:

```env
CHECKOUT_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CHECKOUT_SMOKE_WEBHOOK_URL=https://rare-staging.vercel.app/api/stripe/webhook
```

7. Faça redeploy.
8. Rode o guard:

```powershell
npm run checkout:smoke
```

9. Execute o smoke real com cartão de teste Stripe e siga [docs/checkout-smoke-test.md](./checkout-smoke-test.md).

## 8. Como configurar Stripe live

Só configure live depois do smoke test mode aprovado.

1. Use `STRIPE_SECRET_KEY` live somente no ambiente Production.
2. Crie webhook live separado apontando para:

```text
https://raredept.com.br/api/stripe/webhook
```

3. Configure `STRIPE_WEBHOOK_SECRET` live separado.
4. Garanta `CHECKOUT_ENABLED=false` até a autorização final de venda aberta.
5. Faça redeploy.
6. Valide `/api/health`.
7. Quando venda aberta estiver autorizada, altere `CHECKOUT_ENABLED=true` e inicie com produção limitada.

Não use Stripe live em local, staging ou smoke de homologação.

## 9. Validação online depois do deploy

Comandos PowerShell:

```powershell
curl.exe -I https://raredept.com.br/robots.txt
curl.exe -I https://raredept.com.br/sitemap.xml
curl.exe -I https://raredept.com.br/produto/nao-existe
curl.exe -I https://raredept.com.br/categoria/nao-existe
curl.exe https://raredept.com.br/api/health
npm run smoke -- https://raredept.com.br
```

O smoke público também aceita `SITE_URL`:

```powershell
$env:SITE_URL="https://raredept.com.br"
npm run smoke
```

Resultados esperados:

- `robots.txt` retorna 200.
- `sitemap.xml` retorna 200.
- produto inexistente retorna 404.
- categoria inexistente retorna 404.
- `/api/health` retorna 200 e `status` `ok` ou `ok_with_warnings`.
- Em produção aberta, rate limit deve aparecer como Redis/shared.
- Nenhum secret deve aparecer em respostas públicas.

`FAIL` no smoke público encerra o script com exit code diferente de zero. `WARNING` não altera dados e não cria pedido; ele sinaliza pendência operacional, por exemplo `/api/health` com `ok_with_warnings` enquanto Redis/envs de produção ainda não estiverem completos.

## 10. Critérios para venda aberta

- [ ] Produção atualizada com os commits mais recentes.
- [ ] `/robots.txt` retorna 200.
- [ ] `/sitemap.xml` retorna 200.
- [ ] 404 real validado para produto/categoria inexistentes.
- [ ] `/api/health` sem erro crítico.
- [ ] Redis/Upstash ativo e compartilhado.
- [ ] R2 ativo e servindo uploads.
- [ ] Frete real ativo com Melhor Envio.
- [ ] Stripe test mode aprovado.
- [ ] Webhook Stripe test assinado aprovado.
- [ ] Pedido pago de teste aparece no Admin de homologação.
- [ ] Estoque/reserva validado.
- [ ] Expiração/cancelamento libera reserva.
- [ ] Produtos ativos têm peso e dimensões reais.
- [ ] Produção limitada autorizada pelo cliente.
