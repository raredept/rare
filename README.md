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
- Upload administrativo com validação de JPG, PNG e WEBP
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