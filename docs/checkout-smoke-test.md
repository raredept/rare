# Checkout Stripe test-mode smoke

Este guia homologa o checkout da RARE com Stripe em test mode. Ele nao deve ser usado com chaves live, banco de producao, dominio publico de producao ou dados reais de cliente.

## Escopo validado pelo smoke

- Cliente autenticado consegue chegar em `/finalizar-compra`.
- Carrinho do navegador usa `rare_store_cart`, mas o backend recalcula produto, preco, estoque, frete e total.
- `/api/checkout` exige sessao de cliente, CPF valido, endereco quando configurado e `CHECKOUT_ENABLED=true`.
- `createCheckoutSession()` cria pedido `awaiting_payment`, reserva estoque em `ProductVariant.reservedStock`, cria movimento `reserve` e cria Stripe Checkout Session.
- O webhook `POST /api/stripe/webhook` exige `stripe-signature` e `STRIPE_WEBHOOK_SECRET`.
- `checkout.session.completed` pago ou `payment_intent.succeeded` move pedido para `paid`, baixa `stock`, baixa `reservedStock` e cria movimento `sale`.
- `checkout.session.expired`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed`, admin cancel/refund ou `npm run inventory:release-expired` liberam reserva quando aplicavel.
- Admin exibe pedido em `/admin/orders` e detalhes em `/admin/orders/[id]`, com IDs Stripe mascarados.

## Variaveis necessarias

Configure somente em `.env` local seguro ou no ambiente staging/preview. Nunca versionar valores reais.

```bash
CHECKOUT_ENABLED=true
APP_ENV=staging
APP_URL=https://staging.example.test
NEXT_PUBLIC_APP_URL=https://staging.example.test
DATABASE_URL=postgresql://...isolated-staging-or-local...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CHECKOUT_SMOKE_WEBHOOK_URL=https://staging.example.test/api/stripe/webhook
```

Para smoke local com Stripe CLI:

```bash
APP_ENV=local
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
CHECKOUT_SMOKE_WEBHOOK_URL=http://localhost:3000/api/stripe/webhook
```

Para staging com banco remoto isolado, defina `CHECKOUT_SMOKE_ALLOW_REMOTE_DATABASE=true` somente depois de confirmar que o banco nao e producao. O guard bloqueia qualquer `DATABASE_URL` com marcadores `prod`, `production` ou `live`.

## Guard obrigatorio antes do smoke

Rode antes de abrir o checkout:

```bash
npm run checkout:smoke:guard
```

O guard falha quando detecta:

- `STRIPE_SECRET_KEY` ausente, placeholder ou live (`sk_live_`/`rk_live_`);
- `STRIPE_WEBHOOK_SECRET` ausente ou placeholder;
- `CHECKOUT_ENABLED=false`;
- `APP_ENV`, `VERCEL_ENV` ou `NODE_ENV` incompatível com local/staging/preview/test;
- `APP_URL` ou webhook apontando para `raredept.com.br` sem confirmacao explicita;
- `DATABASE_URL` ausente, placeholder, remota sem confirmacao ou com marcador de producao/live.

O guard nao imprime secrets. Ele mostra apenas modo Stripe, ambiente, origem do app, origem do webhook e se o banco parece local/remoto.

## Preparacao segura

1. Confirme que a conta Stripe esta em test mode.
2. Gere `STRIPE_SECRET_KEY=sk_test_...`.
3. Crie webhook endpoint test-mode para `/api/stripe/webhook` ou use Stripe CLI:

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

4. Copie apenas o `whsec_...` de teste para `STRIPE_WEBHOOK_SECRET`.
5. Garanta banco local/staging isolado, com cliente de teste, admin de teste, produto ativo, variante ativa e estoque positivo.
6. Configure frete:
   - preferencialmente Melhor Envio sandbox/token de homologacao quando disponivel;
   - ou `SHIPPING_PROVIDER=manual` apenas em local/staging para smoke, sem mudar configuracao de producao.
7. Rode:

```bash
npm run checkout:smoke:guard
npm run app:check
npm run shipping:dimensions:audit
```

## Fluxo manual principal

1. Suba o app local/staging.
2. Entre em `/cadastro` e crie cliente de teste com e-mail descartavel, CPF valido de teste e telefone ficticio.
3. Adicione ou selecione endereco de entrega de teste.
4. Abra produto ativo e compravel, escolha tamanho com estoque e adicione ao carrinho.
5. Acesse `/finalizar-compra`.
6. Calcule frete e selecione uma opcao retornada pelo backend.
7. Clique para finalizar compra.
8. Confirme que `/api/checkout` retornou URL `https://checkout.stripe.com/...`.
9. No Stripe Checkout, pague com cartao de teste Stripe `4242 4242 4242 4242`, validade futura, CVC qualquer e CEP de teste.
10. Aguarde o webhook assinado chegar em `/api/stripe/webhook`.
11. Confirme no banco ou Admin:
    - pedido mudou de `awaiting_payment` para `paid`;
    - `stripeCheckoutSessionId` com `cs_test_...`;
    - `stripePaymentIntentId` com `pi_...` de test mode;
    - `paymentMethod` preenchido;
    - `paidAt` preenchido;
    - `ProductVariant.stock` decrementado;
    - `ProductVariant.reservedStock` decrementado;
    - `InventoryMovement` contem `reserve` e `sale`.
12. Entre no Admin de homologacao, abra `/admin/orders?status=paid` e confirme o pedido pago e o detalhe em `/admin/orders/[id]`.

## Fluxo de expiração ou pagamento nao concluido

Use um produto/variante diferente ou restaure o estoque no banco de homologacao antes deste teste.

1. Crie nova sessao de checkout ate chegar na tela Stripe.
2. Nao pague.
3. Para expirar de forma controlada, use a sessao test-mode no Stripe Dashboard/CLI ou aguarde `expires_at`.
4. Confirme webhook `checkout.session.expired` ou execute a liberacao local:

```bash
npm run inventory:release-expired
```

5. Confirme:
   - pedido `canceled` para expirada, ou `failed` para falha de pagamento;
   - `reservedStock` foi decrementado;
   - `stock` nao foi decrementado;
   - `InventoryMovement` contem `release`.

## Consultas úteis de verificacao

Use apenas em banco local/staging.

```sql
select id, "orderNumber", status, "stripeCheckoutSessionId", "stripePaymentIntentId", "paymentMethod", "paidAt"
from "Order"
order by "createdAt" desc
limit 5;

select "variantId", "stockDelta", "reservedDelta", reason, "createdAt"
from "InventoryMovement"
where "orderId" = '<ORDER_ID>'
order by "createdAt" asc;

select id, stock, "reservedStock"
from "ProductVariant"
where id = '<VARIANT_ID>';
```

## O que nao fazer

- Nao usar `sk_live_`, `rk_live_`, cartao real ou dashboard live.
- Nao apontar staging para banco de producao.
- Nao relaxar assinatura do webhook.
- Nao remover autenticacao obrigatoria do checkout.
- Nao alterar frete, Melhor Envio, R2/storage, CSP, rate limit, schema/migrations ou variaveis reais para passar no smoke.

## Evidencia esperada para homologacao

Anexe ao checklist operacional:

- saida de `npm run checkout:smoke:guard`;
- Stripe Checkout Session test-mode criada;
- evento webhook assinado recebido com status 200;
- pedido pago no Admin;
- captura ou consulta de movimentos `reserve` e `sale`;
- captura ou consulta de fluxo expirado/falho com movimento `release`;
- confirmacao de que nenhum valor live foi usado.
