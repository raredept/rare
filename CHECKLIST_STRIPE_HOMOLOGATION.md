# Checklist Stripe Homologation

Use este checklist apenas em ambiente de teste/homologacao. Nao use cartao real e nao conclua pagamento em modo live.

## Variaveis necessarias

- `CHECKOUT_ENABLED=true`
- `APP_URL` ou `NEXT_PUBLIC_APP_URL` apontando para a URL de homologacao
- `STRIPE_SECRET_KEY` de teste
- `STRIPE_WEBHOOK_SECRET` de teste
- `STRIPE_PAYMENT_METHOD_TYPES`, se quiser limitar metodos como `card,pix`
- `SHIPPING_ENABLED=true`
- `SHIPPING_PROVIDER=manual` ou provider real ja homologado
- `SHIPPING_ORIGIN_CEP`

## Smoke seguro

1. Confirmar no Dashboard da Stripe que o ambiente esta em test mode.
2. Criar carrinho com 1 produto disponivel.
3. Ir para `/finalizar-compra`.
4. Preencher contato e endereco com CEP valido.
5. Calcular frete e selecionar PAC ou SEDEX.
6. Conferir subtotal, frete selecionado e total.
7. Clicar em Finalizar compra.
8. Confirmar que a sessao Stripe abre com produto, frete e total corretos.
9. Cancelar e confirmar retorno para `/finalizar-compra?checkout=cancelado`.
10. Repetir com cartao de teste aprovado em test mode.
11. Confirmar webhook `checkout.session.completed` em `/api/stripe/webhook`.
12. Confirmar pedido pago no Admin.
13. Confirmar que estoque baixa somente apos webhook de pagamento confirmado.
14. Testar pagamento recusado ou sessao expirada em test mode.
15. Confirmar que reservas sao liberadas por webhook ou pelo cron de expirados.

## Cartao de teste

Use somente cartoes de teste oficiais da Stripe e apenas quando o Dashboard estiver em test mode. Nao execute esse checklist se a chave comecar com `sk_live_`.

## Criterios de aprovacao

- Checkout abre em Stripe test mode.
- Valor do item, frete e total batem com a loja.
- Metadata contem `orderId`, `shippingProvider`, `shippingService`, `shippingAmountCents` e `destinationCep`.
- `cancel_url` volta para `/finalizar-compra?checkout=cancelado`.
- `success_url` abre `/pedido/sucesso`.
- Webhook assinado processa o evento uma vez.
- Pedido aparece como pago no Admin somente apos confirmacao da Stripe.
- Reserva expirada ou pagamento recusado libera estoque reservado.
