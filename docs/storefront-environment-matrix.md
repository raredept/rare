# Matriz de variáveis do storefront

Esta matriz compara `.env.example`, consumidores de código, validação de runtime e o
contrato esperado da Railway. Ela não contém valores reais. Preview/staging deste
release candidate significa catálogo somente leitura, checkout/frete/e-mail/Push e
backfill desabilitados.

Legenda: `Sim` é obrigatório no ambiente; `Cond.` é obrigatório somente quando o
recurso indicado for ativado; `Não` pode permanecer ausente. Variável pública não é
sinônimo de segredo permitido no browser.

| Nome | Produção | Preview | Segredo | Pode ficar vazia | Default seguro | Consumidor | Consequência quando ausente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Sim, injetada | Sim, injetada | Não | Não | `development` só local | Next.js, env/SEO | Fora de valores conhecidos gera warning; deploy deve usar production |
| `APP_ENV` | Sim | Sim | Não | Não | Nenhum | cron, backfill, guards operacionais | Proteções não distinguem corretamente production/staging |
| `RAILWAY_ENVIRONMENT_NAME` | Injetada | Injetada | Não | Sim fora da Railway | Nenhum | cron e checkout smoke guard | `APP_ENV` deve suprir a classificação |
| `APP_URL` | Sim | Sim | Não | Não | Local somente em dev | metadata, cron e runtime | Produção falha readiness; canonical não deve derivar do host Railway |
| `NEXT_PUBLIC_APP_URL` | Sim | Sim | Não | Não | Local somente em dev | browser e metadata | URL pública ausente/inconsistente; nunca usar dados sensíveis |
| `RAILWAY_PUBLIC_DOMAIN` | Injetada | Injetada | Não | Sim | Nenhum | origem adicional/cron | Não substitui a URL canônica |
| `DATABASE_URL` | Sim | Sim, isolada | Sim | Não | Nenhum | Prisma e runtime | App, health e validações de banco falham |
| `SHADOW_DATABASE_URL` | Não em runtime | Não em runtime | Sim | Sim | Nenhum | `prisma migrate dev` local | Dev usa shadow implícito; nunca apontar para produção |
| `ADMIN_SESSION_SECRET` | Sim | Sim, distinto | Sim | Não se `AUTH_SECRET` vazio | Nenhum | sessão Admin | Admin não inicia com segurança |
| `AUTH_SECRET` | Alternativa | Alternativa | Sim | Sim se secret principal existe | Nenhum | alias de sessão | Sem ambos, autenticação Admin falha |
| `ADMIN_EMAIL` | Operacional | Operacional | Dado interno | Sim após bootstrap | Nenhum | script `admin:create` | Bootstrap não pode ser executado |
| `ADMIN_PASSWORD` | Somente bootstrap | Somente bootstrap | Sim | Sim após bootstrap | Nenhum | script `admin:create` | Bootstrap não pode ser executado; não é necessário ao runtime |
| `CHECKOUT_ENABLED` | Sim, `false` neste RC | Sim, `false` | Não | Não recomendado | Ausente também desabilita | UI, checkout, frete e JSON-LD | Checkout/frete permanecem fechados; somente `true` ativa |
| `STRIPE_SECRET_KEY` | Não com checkout off | Não | Sim | Sim | Vazia | checkout/Stripe | Sem efeito com flag off; obrigatório em futura ativação |
| `STRIPE_WEBHOOK_SECRET` | Não com checkout off | Não | Sim | Sim | Vazia | webhook Stripe | Sem efeito com flag off; futura confirmação de pagamento falha |
| `STRIPE_PAYMENT_METHOD_TYPES` | Não | Não | Não | Sim | Dashboard Stripe | criação de sessão | Métodos dinâmicos do Dashboard quando checkout futuro estiver ativo |
| `STRIPE_PRICE_CURRENCY` | Não | Não | Não | Sim | `BRL` no código | checkout | Usa moeda padrão |
| `EMAIL_DRIVER` | Sim, `disabled` | Sim, `disabled` | Não | Não recomendado | `disabled` | e-mail transacional | Ausente também desabilita; driver desconhecido falha contido |
| `EMAIL_FROM_ORDERS` | Cond. com SMTP | Não | Não | Sim com disabled | Nenhum | adaptador SMTP | Remetente de pedidos indisponível |
| `EMAIL_FROM_SUPPORT` | Cond. | Não | Não | Sim | Nenhum | provider futuro | Remetente de suporte indisponível |
| `EMAIL_REPLY_TO` | Opcional com SMTP | Não | Não | Sim | Nenhum | adaptador SMTP | Sem Reply-To adicional |
| `EMAIL_DELIVERY_MODE` | `production` somente após aprovação | `test` no staging de homologação | Não | Só com disabled | Nenhum | worker SMTP | SMTP bloqueado se modo/ambiente não corresponderem |
| `EMAIL_TEST_RECIPIENTS` | Não | Sim com SMTP test | Dado interno | Só com disabled | Nenhum | worker e adapter | SMTP de teste exige lista exata de caixas controladas |
| `EMAIL_SEND_NOT_BEFORE` | Sim com SMTP | Sim com SMTP | Não | Só com disabled | Nenhum | claim da outbox | Não envia backlog anterior ao corte UTC explícito |
| `SMTP_HOST`, `SMTP_PORT` | Cond. | Cond. | Não | Só com disabled | Host sem default | adaptador SMTP | Exige host da conta e porta TLS 465/587 |
| `SMTP_USER`, `SMTP_PASSWORD` | Cond. | Cond. | Sim | Só com disabled | Nenhum | adaptador SMTP | Credencial obrigatória; nunca NEXT_PUBLIC |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Cond. | Não | Não, é pública | Sim | Vazia | Admin/browser | UI de Push informa não configurado |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Cond. | Não | Sim | Sim | Vazia | envio Web Push | Push desabilitado |
| `WEB_PUSH_CONTACT` | Cond. | Não | Não | Sim | Nenhum | Web Push | Provider futuro sem contato operacional |
| `STORAGE_DRIVER` | Sim, `r2` | Sim, `r2` isolado | Não | Não | `local` só em dev | uploads/storage | Deploy production com local é bloqueado |
| `UPLOAD_DRIVER` | Alias legado | Alias legado | Não | Sim | Nenhum | env/storage | `STORAGE_DRIVER` prevalece |
| `STORAGE_LOCAL_DIR` | Não em deploy | Não em deploy | Não | Sim | `public/uploads` | storage local | Usa diretório local padrão em dev |
| `STORAGE_PUBLIC_BASE_URL` | Cond. | Cond. | Não | Sim | `/uploads` local | URLs de mídia | R2 exige URL pública por esta variável ou `R2_PUBLIC_BASE_URL` |
| `R2_ACCOUNT_ID` | Sim com R2 | Sim com R2 isolado | Sim | Não com R2 | Nenhum | cliente S3/R2 | Upload persistente falha |
| `R2_BUCKET` | Sim com R2 | Sim, bucket/prefixo isolado | Dado interno | Não com R2 | Nenhum | cliente S3/R2 | Upload persistente falha |
| `R2_ACCESS_KEY_ID` | Sim com R2 | Sim, distinta | Sim | Não com R2 | Nenhum | cliente S3/R2 | Upload persistente falha |
| `R2_SECRET_ACCESS_KEY` | Sim com R2 | Sim, distinta | Sim | Não com R2 | Nenhum | cliente S3/R2 | Upload persistente falha |
| `R2_PUBLIC_BASE_URL` | Sim com R2 | Sim, isolada | Não | Não com R2 | Nenhum | mídia/headers | URLs públicas de upload não podem ser geradas |
| `MAX_UPLOAD_SIZE_MB` | Não | Não | Não | Sim | Limite interno | upload Admin | Usa limite do código |
| `MAX_GIF_UPLOAD_SIZE_MB` | Não | Não | Não | Sim | Limite interno | upload Admin | Usa limite do código |
| `MAX_VIDEO_UPLOAD_SIZE_MB` | Não | Não | Não | Sim | Limite interno | upload Admin | Usa limite do código |
| `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` | Sim, `false` | Sim, `false` | Não | Sim | `false` | env/storage | Storage local segue bloqueado no deploy |
| `RATE_LIMIT_DRIVER` | Sim, `redis` | Sim, `redis` isolado | Não | Não recomendado | `memory` apenas local | rate limit | Warning/degradação multi-instância |
| `REDIS_URL` | Sim com Redis TCP | Sim, instância separada | Sim | Cond. | Nenhum | rate limit Redis | Driver Redis TCP não inicia |
| `UPSTASH_REDIS_REST_URL` / `REDIS_REST_URL` | Cond. | Cond., isolada | URL interna | Sim com TCP | Nenhum | rate limit REST | Alternativa REST indisponível |
| `UPSTASH_REDIS_REST_TOKEN` / `REDIS_REST_TOKEN` | Cond. | Cond., distinto | Sim | Sim com TCP | Nenhum | rate limit REST | Redis REST indisponível |
| `RATE_LIMIT_REDIS_PREFIX` | Não | Recomendado distinto | Não | Sim | Prefixo interno | rate limit | Usa prefixo padrão; ambientes podem colidir se Redis for compartilhado, o que é proibido |
| `SHIPPING_ENABLED` | Sim, `false` neste RC | Sim, `false` | Não | Não recomendado | Sem override depende de settings | API de frete | O gate de checkout ainda fecha a API; explicitar evita ambiguidade |
| `SHIPPING_PROVIDER` | Não com frete off | Não, `manual` | Não | Sim | `manual` | shipping/readiness | Provider automático não é selecionado |
| `SHIPPING_ORIGIN_CEP` | Cond. | Não | Dado operacional | Sim | Fallback do código | shipping | Futura cotação usa CEP do Admin ou fallback |
| `MELHOR_ENVIO_TOKEN` / `MELHOR_ENVIO_ACCESS_TOKEN` | Não com frete off | Não | Sim | Sim | Vazia | Melhor Envio | Provider não chama API sem token |
| `MELHOR_ENVIO_CLIENT_ID` / `MELHOR_ENVIO_CLIENT_SECRET` | Não | Não | Secret no segundo caso | Sim | Vazio | OAuth futuro | Não substituem access token |
| `MELHOR_ENVIO_REDIRECT_URI` | Não | Não | Não | Sim | Vazio | OAuth futuro | Fluxo OAuth futuro indisponível |
| `MELHOR_ENVIO_ENV` | Não com frete off | `sandbox` se usado futuramente | Não | Sim | `sandbox` no exemplo | Melhor Envio | Ambiente inválido bloqueia cotação |
| `MELHOR_ENVIO_BASE_URL` | Não | Não | Não | Sim | Endpoint pelo ambiente | Melhor Envio | Usa endpoint oficial selecionado |
| `MELHOR_ENVIO_SERVICES` | Não | Não | Não | Sim | `1,2` | Melhor Envio | Usa serviços padrão |
| `MELHOR_ENVIO_USER_AGENT` | Cond. | Cond. | Não | Sim | Identificação do app | Melhor Envio | Usa identificação padrão do código/config |
| `MELHOR_ENVIO_TIMEOUT_MS` | Não | Não | Não | Sim | 8000 ms | Melhor Envio | Usa timeout padrão; valor inválido bloqueia provider |
| `CORREIOS_USER` / `CORREIOS_TOKEN` | Não | Não | Sim | Sim | Vazio | provider preparado | Correios permanece indisponível |
| `FRENET_TOKEN` | Não | Não | Sim | Sim | Vazio | provider preparado | Frenet permanece indisponível |
| `CRON_SECRET` | Sim no web/cron | Não se cron desligada; distinto se isolada | Sim | Não quando cron ativa | Nenhum | rota e serviço cron | Cron recebe 401/falha fechada |
| `CRON_TARGET_URL` | Cron | Não ou URL isolada | Não | Sim se Railway domain/app URL existe | Derivado | script cron | Cron não sabe o alvo |
| `CRON_ALLOW_PRODUCTION_TARGET` | Não | Não | Não | Sim | `false` | guard da cron | Alvo de produção continua bloqueado fora de production |
| `MEDIA_BACKFILL_MAX_SOURCE_MB` | Não | Não | Não | Sim | 25 MB | backfill | Usa limite padrão |
| `MEDIA_BACKFILL_ALLOW_PRODUCTION` | Sim, `false` | Sim, `false` | Não | Sim | `false` | guard do backfill | `--apply` em produção segue bloqueado |
| `CONFIRM_PRODUCTION_SEED` | Sim, `false` | Sim, `false` | Não | Sim | `false` | seed | Escrita de seed em produção bloqueada |
| `CONFIRM_PRODUCTION_ADMIN` | Sim, `false` | Sim, `false` | Não | Sim | `false` | bootstrap Admin | Escrita de Admin em produção bloqueada |
| `SITE_URL` | Não | Não | Não | Sim | Domínio canônico no smoke público legado | smoke HTTP | Usa alvo padrão; não usar sem confirmar destino |
| `PLAYWRIGHT_BASE_URL` | Não | Operacional no smoke | Não | Sim | Servidor local gerenciado | Playwright | Testes sobem servidor local quando ausente |
| `LIGHTHOUSE_PORT` / `LIGHTHOUSE_PRODUCT_SLUG` | Não | Operacional | Não | Sim | Valores internos | Lighthouse | Runner usa defaults reproduzíveis |
| `LIGHTHOUSE_SKIP_BUILD` | Não | Não no gate final | Não | Sim | `false` | Lighthouse | Build é executado antes da auditoria |

## Regras por ambiente

| Ambiente | Banco/Redis/storage | URLs e indexação | Comércio e integrações |
| --- | --- | --- | --- |
| Local | Recursos locais de desenvolvimento, sem dados reais | Canonical de teste configurável; `noindex` | Checkout/frete/e-mail/Push/backfill off |
| Preview por PR | Recursos efêmeros ou dedicados; nunca produção | URL separada, canonical oficial e `noindex,nofollow` | Todas as integrações comerciais off |
| Staging do RC | Recursos persistentes isolados e secrets próprios | URL separada, `Disallow: /` | Catálogo somente leitura; integrações off |
| Laboratório futuro de integração | Recursos isolados adicionais | Não indexável | Somente test/sandbox, ativação temporária e autorizada |
| Produção | Railway Postgres/Redis/R2 do ambiente | `https://raredept.com.br` | Neste RC continua tudo comercialmente desabilitado |

## Exposição no browser

Somente `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` são aprovadas
como variáveis públicas. O gate falha se surgir outro nome `NEXT_PUBLIC_*`. Chaves
Stripe, banco, Redis, R2, VAPID privada, sessão, cron e tokens de frete permanecem
server-side. `release:guard` verifica diff, arquivos rastreados e `.next/static` sem
imprimir valores detectados.
