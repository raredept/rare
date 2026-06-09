# Checklist de variaveis de ambiente Railway — RARE

Este documento e o checklist operacional para configurar a RARE na Railway. Ele usa somente nomes de variaveis encontrados no projeto e nao contem secrets reais.

## 1. Avisos importantes

- O banco atual continua sendo o Neon. Mantenha a URL do Neon em `DATABASE_URL`.
- O cliente deve preencher valores reais em **Railway > Service > Variables**, nunca em commit, WhatsApp ou chat aberto.
- Depois de adicionar ou alterar envs na Railway, faca redeploy do ambiente afetado.
- Releases com migrations usam `npx prisma migrate deploy`; o servico web executa isso como `preDeployCommand` em `railway.json`.
- Production so deve usar Stripe live quando a venda aberta estiver autorizada.
- Staging/homologacao deve usar Stripe test mode e banco isolado.
- Enquanto venda aberta nao estiver liberada, mantenha `CHECKOUT_ENABLED=false` em Production.
- Nao sobrescreva `PORT`; a Railway injeta essa variavel.
- Nao transforme `Content-Security-Policy-Report-Only` em enforcement durante esta etapa.

## 2. Servicos Railway

Crie dois servicos a partir do mesmo repositorio:

| Servico | Config file | Funcao |
| --- | --- | --- |
| Web | `railway.json` | Build Next.js, aplica migrations Prisma, sobe o storefront/Admin e valida `/api/health`. |
| Cron reservas | `/railway.cron.json` | Executa `npm run cron:release-expired` diariamente e encerra. |

O arquivo `railway.cron.json` nao e lido automaticamente pelo servico web. No servico cron, configure **Settings > Build > Config File Path** como `/railway.cron.json`. Se isso nao estiver disponivel no painel, configure manualmente no servico cron:

- Start Command: `npm run cron:release-expired`
- Cron Schedule: `0 3 * * *`
- Healthcheck: vazio

O servico cron chama a rota protegida `/api/cron/release-expired-inventory` usando `CRON_SECRET`; nao coloque `cronSchedule` no servico web.

A Railway injeta variaveis de sistema como `PORT`, `RAILWAY_ENVIRONMENT_NAME` e, quando houver dominio publico gerado, `RAILWAY_PUBLIC_DOMAIN`. O app usa `RAILWAY_PUBLIC_DOMAIN` apenas como origem publica adicional para preview/staging; `APP_URL` e `NEXT_PUBLIC_APP_URL` continuam sendo a fonte canonica.

## 3. Envs do servico web em Production

| Variavel | Exemplo seguro | Obrigatoria? | Observacoes |
| --- | --- | --- | --- |
| `APP_ENV` | `production` | Sim | Use `production` somente no ambiente Production. |
| `APP_URL` | `https://raredept.com.br` | Sim | URL canonica server-side. |
| `NEXT_PUBLIC_APP_URL` | `https://raredept.com.br` | Sim | URL publica enviada ao browser. |
| `DATABASE_URL` | `postgresql://...neon...` | Sim | Banco Neon de producao; nao reutilizar em staging/smoke. |
| `ADMIN_SESSION_SECRET` | `...32+ caracteres...` | Sim | `AUTH_SECRET` tambem e aceito como alias. |
| `CHECKOUT_ENABLED` | `false` | Sim | Alterar para `true` so depois da homologacao aprovada. |
| `RATE_LIMIT_DRIVER` | `redis` | Sim para venda aberta | `memory` gera warning e nao e compartilhado entre replicas. |
| `UPSTASH_REDIS_REST_URL` / `REDIS_REST_URL` | `https://...` | Sim com Redis | URL REST HTTPS. |
| `UPSTASH_REDIS_REST_TOKEN` / `REDIS_REST_TOKEN` | `...` | Sim com Redis | Token REST; nao expor. |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Sim quando checkout ativo | Live so em Production autorizada. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Sim quando checkout ativo | Webhook live separado para `/api/stripe/webhook`. |
| `STORAGE_DRIVER` | `r2` | Sim | Production deve usar Cloudflare R2. |
| `R2_ACCOUNT_ID` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | `...` | Sim com R2 | Credenciais do bucket de producao. |
| `R2_PUBLIC_BASE_URL` ou `STORAGE_PUBLIC_BASE_URL` | `https://...` | Sim com R2 | URL publica absoluta dos uploads. |
| `SHIPPING_PROVIDER` | `melhor_envio` | Sim para frete real | Provider principal da RARE. |
| `SHIPPING_ORIGIN_CEP` | `31170350` | Condicional | Fallback; `StoreSettings.originCep` tem prioridade. |
| `MELHOR_ENVIO_TOKEN` ou `MELHOR_ENVIO_ACCESS_TOKEN` | `...` | Sim com Melhor Envio | CLIENT_ID/SECRET sozinhos nao bastam. |
| `MELHOR_ENVIO_ENV` | `production` | Sim com Melhor Envio real | Valores aceitos: `production` ou `sandbox`. |
| `CRON_SECRET` | `...32+ caracteres...` | Sim | O mesmo valor deve existir no servico cron. |

Variaveis opcionais/operacionais: `RATE_LIMIT_REDIS_PREFIX`, `STRIPE_PAYMENT_METHOD_TYPES`, `STRIPE_PRICE_CURRENCY`, `MAX_UPLOAD_SIZE_MB`, `MAX_GIF_UPLOAD_SIZE_MB`, `MAX_VIDEO_UPLOAD_SIZE_MB`, `ALLOW_LOCAL_STORAGE_IN_PRODUCTION`, `MELHOR_ENVIO_BASE_URL`, `MELHOR_ENVIO_SERVICES`, `MELHOR_ENVIO_USER_AGENT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CONFIRM_PRODUCTION_SEED` e `CONFIRM_PRODUCTION_ADMIN`.

## 4. Envs para Staging/Homologacao

Use um ambiente Railway separado para homologacao. Nunca use Stripe live nem banco de producao.

| Variavel | Exemplo seguro | Obrigatoria? | Observacoes |
| --- | --- | --- | --- |
| `APP_ENV` | `staging` | Sim | O guard aceita `staging`, `stage`, `preview`, `test` ou `homologacao`. |
| `APP_URL` | `https://rare-staging.up.railway.app` | Sim | Deve apontar para a URL testada. |
| `NEXT_PUBLIC_APP_URL` | `https://rare-staging.up.railway.app` | Sim | Deve bater com `APP_URL`. |
| `DATABASE_URL` | `postgresql://...staging-isolado...` | Sim | Banco Neon isolado ou outro Postgres de staging. |
| `CHECKOUT_ENABLED` | `true` | Sim para homologar checkout | Usar apenas com Stripe test mode. |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Sim para checkout smoke | Nunca usar `sk_live_`. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Sim para checkout smoke | Webhook test proprio. |
| `CHECKOUT_SMOKE_WEBHOOK_URL` | `https://rare-staging.up.railway.app/api/stripe/webhook` | Recomendado | `STRIPE_WEBHOOK_URL` tambem e aceito pelo guard. |
| `CHECKOUT_SMOKE_ALLOW_REMOTE_DATABASE` | `true` | Condicional | Use so depois de confirmar que o DB remoto nao e producao. |
| `STORAGE_DRIVER` | `r2` | Recomendado | Homologa uploads persistentes. |
| `CRON_SECRET` | `...32+ caracteres...` | Recomendado | Necessario para validar expiracao/cancelamento operacional. |

## 5. Cron de reservas

O servico cron deve ter poucas envs. Ele nao precisa de Stripe, R2, Melhor Envio, Redis nem `DATABASE_URL`, porque apenas chama HTTP no servico web.

```env
APP_ENV=production
CRON_SECRET=...32+ caracteres...
CRON_TARGET_URL=https://raredept.com.br/api/cron/release-expired-inventory
```

Tambem e aceito usar `RAILWAY_PUBLIC_DOMAIN`, `APP_URL` ou `NEXT_PUBLIC_APP_URL`; nesse caso o script monta o caminho `/api/cron/release-expired-inventory`. Para evitar disparo acidental contra producao em terminal local, o script bloqueia `raredept.com.br` quando `APP_ENV`/`RAILWAY_ENVIRONMENT_NAME` nao e production, salvo override consciente com `CRON_ALLOW_PRODUCTION_TARGET=true`.

```env
RAILWAY_ENVIRONMENT_NAME=production
RAILWAY_PUBLIC_DOMAIN=rare-production.up.railway.app
CRON_SECRET=...32+ caracteres...
```

Resultado esperado nos logs:

```json
{"ok":true,"targetOrigin":"https://raredept.com.br","releasedReservations":0,"timestamp":"..."}
```

## 6. Validacao pos-deploy

```powershell
curl.exe -I https://raredept.com.br/robots.txt
curl.exe -I https://raredept.com.br/sitemap.xml
curl.exe -I https://raredept.com.br/produto/nao-existe
curl.exe -I https://raredept.com.br/categoria/nao-existe
curl.exe https://raredept.com.br/api/health
npm run smoke -- https://raredept.com.br
```

Resultados esperados:

- `robots.txt` e `sitemap.xml` retornam 200.
- produto/categoria inexistentes retornam 404.
- `/api/health` retorna 200 e `status` `ok` ou `ok_with_warnings`.
- Em venda aberta, rate limit deve aparecer como Redis/shared.
- Nenhum secret deve aparecer em respostas publicas.

## 7. Redis/rate limit

Railway nao resolve automaticamente o warning `RATE_LIMIT_DRIVER=memory`. O codigo atual usa Redis REST/Upstash (`UPSTASH_REDIS_REST_URL`/`TOKEN` ou `REDIS_REST_URL`/`TOKEN`). Um Redis Railway TCP puro nao atende esse driver sem implementacao nova, entao a recomendacao segura para esta migracao e manter Upstash REST ou outro Redis com API REST compativel.

## 8. Dominio e cutover

1. Subir o servico web em dominio temporario Railway.
2. Configurar `APP_URL` e `NEXT_PUBLIC_APP_URL` para esse dominio temporario no staging.
3. Rodar `npm run smoke -- <dominio-temporario>`.
4. Validar `/api/health`.
5. Abrir `/admin/readiness`.
6. Validar upload Admin/R2 em staging.
7. Validar frete Melhor Envio em staging.
8. Validar Stripe test mode e webhook test apontando para o dominio Railway.
9. So depois apontar `raredept.com.br` para Railway.
10. Atualizar `APP_URL`, `NEXT_PUBLIC_APP_URL`, webhook Stripe e `CRON_TARGET_URL` para `https://raredept.com.br`.
11. Redeploy.
12. Rodar smoke final no dominio oficial.

## 9. Rollback temporario

Enquanto Railway ainda nao passou smoke em staging/producao, mantenha `vercel.json` no repositorio como fallback operacional. Ele nao interfere no deploy Railway. Depois do cutover aprovado e da decisao formal de abandonar Vercel, remova `vercel.json` em um commit proprio de limpeza.
