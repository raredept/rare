# RARE

Estado atual do release, publicação e homologação: [FINAL_RELEASE_STATUS.md](./FINAL_RELEASE_STATUS.md).
Relatórios anteriores preservam evidências históricas; autorizações e pendências correntes estão nesse registro.

Aplicação e-commerce da RARE com storefront público, catálogo de produtos, carrinho, checkout server-side preparado para Stripe, área do cliente e painel administrativo protegido.

## Stack

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL
- Stripe Checkout e webhook assinado
- Upload local em desenvolvimento
- Cloudflare R2 ready para storage persistente
- Testes com Vitest

## Principais recursos

- Storefront público com categorias, busca, produto e carrinho
- Catálogo com imagens, variações, estoque e destaque
- Checkout server-side com validação de estoque, preço e frete
- Conta de cliente com cadastro, login, endereços e pedidos
- Admin protegido com dashboard, produtos, categorias, clientes, pedidos e configurações
- Notificações Admin de vendas aprovadas, com Web Push para celular cadastrado
- Upload administrativo server-side para R2, com limite seguro de 4 MB por arquivo
- Webhook Stripe com validação de assinatura e idempotência
- Healthcheck e scripts de readiness

## Scripts principais

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
npm run db:check
npm run qa:admin-access
npm run qa:e2e:isolated
npm run app:check
npm run smoke -- https://raredept.com.br
npm run checkout:smoke
npm run inventory:release-expired
npm run shipping:dimensions:audit
npm run shipping:audit-products -- --format=json
npm run media:variants:backfill -- --limit=10 --dry-run
npm run smoke:release
npm run release:check
```

## Uploads do Admin

O storage persistente recomendado para produção é Cloudflare R2 com `STORAGE_DRIVER=r2`.
O Admin usa `POST /api/admin/uploads`: o navegador envia o arquivo para o domínio da aplicação e o servidor Next na Railway grava no R2 com credenciais server-side. Isso evita upload direto do navegador para o bucket.

Limite atual: 4 MB por arquivo. Imagens estáticas elegíveis preservam o original e podem gerar thumbnail 640 e medium 1200 em WEBP. GIF é decodificado pelo Sharp antes do armazenamento e preservado sem variantes; MP4 passa por validação de extensão, MIME e assinatura do container, mas não por decodificação/transcoding. O antigo endpoint de presign direto está encerrado e responde `410 Gone` sem emitir URL de escrita.

Detalhes: [docs/media-optimization.md](docs/media-optimization.md).

## Primeiro acesso administrativo

Contas administrativas com `mustChangePassword=true` só alcançam `/admin/change-password`. Páginas, APIs e Server Actions administrativas consultam o estado atual no banco; ao trocar a senha, a sessão é vinculada ao novo hash e cookies emitidos com a credencial anterior deixam de ser aceitos. `npm run qa:admin-access` valida migration, preservação do administrador anterior, troca e reprovisionamento em PostgreSQL local descartável. `npm run qa:e2e:isolated` acrescenta browser desktop/mobile, upload local de produto/banner e limpeza automática do banco/storage sintéticos.

As fontes Geist Sans e Geist Mono estão em `src/app/fonts/`, com licença OFL e subconjuntos latinos locais. O build não depende de Google Fonts. Uma instalação npm totalmente offline continua exigindo cache prévio das demais dependências.

## Operação, deploy e validação

Use estes documentos para entrega ao cliente e homologação:

- [Checklist de variáveis da Railway](docs/railway-env-checklist.md)
- [Consolidação final de QA de 2026-09-07](FINAL_QA_CONSOLIDATION_REPORT.md)
- [Handoff técnico do cliente](docs/client-handoff.md)
- [Auditoria atual de prontidão](docs/full-project-readiness-audit.md)
- [Auditoria final de release de 2026-06-04 (histórico)](docs/final-release-audit.md)
- [Checkout Stripe test-mode smoke](docs/checkout-smoke-test.md)
- [Rate limit em produção](docs/rate-limit.md)
- [Homologação do Melhor Envio](docs/melhor-envio-homologation.md)
- [E-mail transacional e DNS](docs/transactional-email.md)
- [Auditoria conservadora de dependências](docs/dependency-security-audit.md)
- [Pendências externas](docs/external-pending-actions.md)
- [Prontidão de peso e dimensões](docs/product-shipping-readiness.md)
- [Runbook de homologação em staging](docs/staging-homologation-runbook.md)
- [Matriz de risco do release candidate](docs/storefront-release-risk-matrix.md)
- [Matriz de variáveis por ambiente](docs/storefront-environment-matrix.md)
- [Release notes do candidato](docs/releases/storefront-release-candidate.md)
- [Critérios de go/no-go](docs/storefront-go-no-go.md)
- [Plano futuro de CSP](docs/content-security-policy-plan.md)

Railway usa dois serviços: o web com [railway.json](railway.json) e a cron de reservas com [railway.cron.json](railway.cron.json). No serviço cron, aponte o Config File Path para `/railway.cron.json`; se o painel não usar esse arquivo, configure manualmente o start command `npm run cron:release-expired` e o schedule `0 3 * * *`.

Smoke público pós-deploy:

```powershell
npm run smoke -- https://raredept.com.br
$env:SITE_URL="https://raredept.com.br"
npm run smoke
```

O smoke público valida rotas públicas, `robots.txt`, `sitemap.xml`, 404s, `/api/health`, headers de segurança e vazamentos de valores sensíveis. Ele não altera dados, não chama checkout real e não cria pedidos. `FAIL` bloqueia a validação; `WARNING` indica pendência operacional, como rate limit não compartilhado ou integrações externas ainda não homologadas.

Antes de qualquer checkout de homologação, rode:

```powershell
npm run checkout
npm run checkout:smoke
```

O procedimento completo e canônico de Stripe test mode fica em [docs/checkout-smoke-test.md](docs/checkout-smoke-test.md). A evidência e o checklist atuais de prontidão ficam em [docs/full-project-readiness-audit.md](docs/full-project-readiness-audit.md). Venda aberta continua bloqueada até Redis/Upstash compartilhado estar ativo, o smoke Stripe test mode validar webhook assinado, pedido pago no Admin, estoque e reservas, a cron Railway de liberação ser comprovada e o cliente autorizar formalmente o go-live.

Para notificações no celular, gere chaves com `npm run webpush:keys`, configure `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` e `WEB_PUSH_VAPID_PRIVATE_KEY` na Railway, faça redeploy e ative o dispositivo em `/admin/notifications`.
