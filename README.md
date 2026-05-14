# RARE

Plataforma e-commerce para catalogo, carrinho, checkout, conta de cliente e admin.

## Stack

- Next.js
- TypeScript
- Prisma
- PostgreSQL
- Stripe-ready
- Storage-ready

## Setup local

```bash
npm install
cp .env.example .env
npm run dev
```

Use `.env.example` como referencia para as variaveis locais. Nao versionar `.env`.

## Comandos principais

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Banco e Prisma

Configure `DATABASE_URL` em `.env` para desenvolvimento local. Para trabalhar com migrations, configure tambem `SHADOW_DATABASE_URL` apontando para um banco shadow separado e limpo.

Comandos uteis:

```bash
npm run db:check
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
```

## Producao

Producao requer variaveis de ambiente configuradas no provedor, banco PostgreSQL externo, Stripe, webhook assinado e storage persistente. Secrets reais devem ficar somente no ambiente privado ou no painel do provedor.

## Documentacao tecnica

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [LOCAL_DATABASE_GUIDE.md](./LOCAL_DATABASE_GUIDE.md)
- [ADMIN_MEDIA_STORAGE_GUIDE.md](./ADMIN_MEDIA_STORAGE_GUIDE.md)
- [DOMAIN_EMAIL_SETUP_GUIDE.md](./DOMAIN_EMAIL_SETUP_GUIDE.md)
- [PRIVACY_NOTES.md](./PRIVACY_NOTES.md)
