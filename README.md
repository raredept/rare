# RARE

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
npm run app:check
npm run smoke -- https://raredept.com.br
npm run checkout:smoke
npm run inventory:release-expired
npm run shipping:dimensions:audit
```

## Uploads do Admin

O storage persistente recomendado para produção é Cloudflare R2 com `STORAGE_DRIVER=r2`.
O Admin usa `POST /api/admin/uploads`: o navegador envia o arquivo para o domínio da aplicação e a Vercel Function grava no R2 com credenciais server-side. Isso evita upload direto do navegador para o bucket.

Limite atual: 4 MB por arquivo. Para melhor qualidade e performance, envie imagens em WEBP/JPG otimizadas.

## Operação, deploy e validação

Use estes documentos para entrega ao cliente e homologação:

- [Checklist de variáveis da Vercel](docs/vercel-env-checklist.md)
- [Handoff técnico do cliente](docs/client-handoff.md)
- [Auditoria atual de prontidão](docs/full-project-readiness-audit.md)
- [Auditoria final de release de 2026-06-04 (histórico)](docs/final-release-audit.md)
- [Checkout Stripe test-mode smoke](docs/checkout-smoke-test.md)
- [Rate limit em produção](docs/rate-limit.md)

Smoke público pós-deploy:

```powershell
npm run smoke -- https://raredept.com.br
$env:SITE_URL="https://raredept.com.br"
npm run smoke
```

O smoke público valida rotas públicas, `robots.txt`, `sitemap.xml`, 404s, `/api/health`, headers de segurança e vazamentos óbvios de secrets. Ele não altera dados, não chama checkout real e não cria pedidos. `FAIL` bloqueia a validação; `WARNING` indica pendência operacional, como `RATE_LIMIT_DRIVER=memory` enquanto Redis/Upstash ainda não estiver configurado.

Antes de qualquer checkout de homologação, rode:

```powershell
npm run checkout
npm run checkout:smoke
```

O procedimento completo e canônico de Stripe test mode fica em [docs/checkout-smoke-test.md](docs/checkout-smoke-test.md). A evidência e o checklist atuais de prontidão ficam em [docs/full-project-readiness-audit.md](docs/full-project-readiness-audit.md). Venda aberta continua bloqueada até Redis/Upstash compartilhado estar ativo, o smoke Stripe test mode validar webhook assinado, pedido pago no Admin, estoque e reservas, a cron de liberação ser comprovada e o cliente autorizar formalmente o go-live.
