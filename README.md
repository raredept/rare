# RARE Store

Aplicacao ecommerce da RARE com storefront publico, carrinho, checkout server-side preparado para Stripe, area do cliente e admin protegido.

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
```

Scripts operacionais:

```bash
npm run db:seed
npm run catalog:import
npm run admin:create
npm run inventory:release-expired
```

Use `catalog:import` somente quando for seguro revalidar o catalogo local, porque ele aplica upserts em categorias, produtos, imagens e estoque previstos no importador.

## Ambiente

Copie `.env.example` para `.env` no desenvolvimento local e substitua os placeholders. Nunca versionar `.env` nem credenciais reais.

Variaveis minimas para rodar localmente:

- `DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `ADMIN_SESSION_SECRET` ou `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL` e/ou `APP_URL`

Checkout:

- `CHECKOUT_ENABLED=false` pausa o checkout de forma controlada.
- Com `CHECKOUT_ENABLED=true`, configure `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` somente no ambiente privado.
- Pix fica preparado via Stripe, mas depende da conta Stripe e dos metodos habilitados no Dashboard.

Storage:

- `STORAGE_DRIVER=local` serve apenas para desenvolvimento ou homologacao temporaria.
- Producao aberta deve usar storage persistente, como Cloudflare R2, sem credenciais no codigo.

## Banco e Prisma

`prisma.config.ts` define a fonte de URLs do Prisma. Antes de migracoes ou validacoes de staging, rode:

```bash
npm run db:check
npx prisma validate
npx prisma migrate status
```

Nao use `prisma db push` para corrigir ambiente. Use migrations versionadas e o fluxo seguro do Prisma.

## Regras de seguranca

- O frontend envia apenas IDs e quantidade para checkout.
- Preco, frete, estoque e reservas sao recalculados no backend.
- Webhook Stripe exige assinatura.
- Admin e cliente usam sessoes separadas.
- Healthcheck e scripts nao devem imprimir secrets.
- Upload aceita apenas JPG, PNG e WEBP, com validacao de MIME, extensao, assinatura e tamanho.

## Estado de readiness

O codigo esta preparado para desenvolvimento local e homologacao controlada. Antes de producao aberta ainda e necessario configurar Stripe real/teste de homologacao, webhook assinado, storage persistente, secrets fortes e rate limit compartilhado.
