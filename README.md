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
npm run inventory:release-expired
npm run shipping:dimensions:audit
```

## Uploads do Admin

O storage persistente recomendado para produção é Cloudflare R2 com `STORAGE_DRIVER=r2`.
O Admin usa `POST /api/admin/uploads`: o navegador envia o arquivo para o domínio da aplicação e a Vercel Function grava no R2 com credenciais server-side. Isso evita upload direto do navegador para o bucket.

Limite atual: 4 MB por arquivo. Para melhor qualidade e performance, envie imagens em WEBP/JPG otimizadas.

## Produção e operações

### Health check

`GET /api/health` retorna `200` quando aplicação, banco e configurações críticas estão funcionais. Pendências operacionais que não impedem a loja de responder, como `RATE_LIMIT_DRIVER=memory`, aparecem em `configuration.warnings` com `status: "ok_with_warnings"` sem derrubar o monitor como indisponível.

Para produção aberta, mantenha `RATE_LIMIT_DRIVER` em um backend compartilhado/durável quando a loja sair de baixo tráfego. O modo `memory` é aceitável só como transição, porque cada instância mantém seu próprio contador.

### Carrinho legado

`/cart` é uma rota legada e redireciona por HTTP para `/finalizar-compra`. A querystring é preservada para compatibilidade com callbacks antigos, por exemplo `/cart?checkout=cancelado`.

### Reservas expiradas

Reservas temporárias de checkout são liberadas por `npm run inventory:release-expired` e pelo endpoint protegido:

```bash
GET /api/cron/release-expired-inventory
Authorization: Bearer $CRON_SECRET
```

O `vercel.json` agenda esse endpoint a cada 10 minutos. Configure `CRON_SECRET` na Vercel antes do deploy para que o cron execute; sem o segredo correto, a rota não altera reservas.

### Stripe homologação

Antes de venda aberta, faça um smoke em modo de teste da Stripe com `CHECKOUT_ENABLED=true`, `STRIPE_SECRET_KEY` de teste, `STRIPE_WEBHOOK_SECRET` de teste e webhook apontando para `/api/stripe/webhook`. Não use cartão real nem conclua pagamento em modo live.

### Frete e medidas

O provider principal de frete real é `SHIPPING_PROVIDER=melhor_envio`, usando cotação via `POST /api/v2/me/shipment/calculate`. Configure `MELHOR_ENVIO_TOKEN` ou `MELHOR_ENVIO_ACCESS_TOKEN`; `MELHOR_ENVIO_CLIENT_ID` e `MELHOR_ENVIO_CLIENT_SECRET` sozinhos não bastam sem o OAuth finalizado.

Sem `MELHOR_ENVIO_BASE_URL`, o app usa `https://www.melhorenvio.com.br`. Com `MELHOR_ENVIO_ENV=sandbox`, usa a base sandbox padrão. A cotação inicial solicita os serviços `1,2` por `MELHOR_ENVIO_SERVICES`, normalmente PAC/SEDEX no Melhor Envio, e sempre normaliza o nome retornado pela API.

O CEP de origem usa `SHIPPING_ORIGIN_CEP` ou `StoreSettings.originCep`. Se ambos estiverem vazios, o fallback controlado da loja é `31170350`.

O cálculo usa dados reais de `Product.weightGrams`, `lengthCm`, `widthCm` e `heightCm`. Quando faltarem dados, usa fallback controlado de `1000g` e `10x35x35cm`. Rode `npm run shipping:dimensions:audit` para listar produtos que ainda dependem desse fallback antes de venda aberta.

O provider `manual` permanece como fallback de homologação, e `fixed` é legado/provisório. O checkout nunca confia em valor de frete vindo do frontend; ele recalcula a opção no backend antes de criar a sessão Stripe.
