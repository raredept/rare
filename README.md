# RARE

Aplicação e-commerce da RARE com storefront público, carrinho, checkout server-side preparado para Stripe, área do cliente e admin protegido.

## Stack

- Next.js App Router
- TypeScript
- Prisma 7
- PostgreSQL
- Stripe Checkout e webhook assinado
- Upload local em desenvolvimento, com readiness para Cloudflare R2

## Scripts principais

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
npm run db:check
npx prisma validate
npx prisma migrate status
npm run app:check
