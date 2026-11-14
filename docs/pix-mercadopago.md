# Pix pelo Mercado Pago (Checkout API)

O cliente escolhe a forma de pagamento em `/finalizar-compra`:

- **Cartão de crédito ou débito** → Stripe Checkout (fluxo que já existia, sem mudança).
- **Pix** → pagamento criado na API de pagamentos do Mercado Pago; o QR code e o "copia e cola" aparecem na própria loja, em `/pedido/pix/<pedido>`.

O Pix só é oferecido quando `PIX_ENABLED=true` **e** as credenciais estão completas para o ambiente. Sem isso o seletor não aparece e o checkout segue só com cartão. A integração **não foi homologada contra o Mercado Pago real**: os testes automatizados usam respostas simuladas.

## Como funciona

1. `POST /api/checkout` com `paymentMethod: "pix"` cria o pedido e reserva o estoque exatamente como no cartão: preço, cupom e frete calculados no servidor.
2. O servidor cria o Pix no Mercado Pago (`POST /v1/payments`, `payment_method_id=pix`) com o **total do pedido**, `external_reference` = id do pedido, CPF e e-mail do cliente, e chave de idempotência por pedido.
3. O que voltar é conferido: valor, moeda, referência e meio. Se algo divergir, nenhum código é mostrado.
4. O cliente paga no app do banco. O Mercado Pago avisa `POST /api/mercadopago/webhook`.
5. O webhook valida a assinatura (`x-signature`) e **consulta o pagamento na API**. O corpo da notificação nunca é usado como verdade. O pedido só vira "Pago" se status = `approved`, valor = total do pedido, moeda = BRL, referência = o pedido e meio = Pix.
6. A confirmação usa o mesmo caminho transacional do cartão: trava do pedido, baixa do estoque, e-mail de pagamento aprovado e notificação do Admin. Dois avisos simultâneos resultam em uma única baixa.

### Prazo e estoque

- A reserva de um pedido Pix dura **30 minutos** (`PIX_RESERVATION_MINUTES`). É o mínimo que o Mercado Pago aceita para um Pix. No cartão continuam 15 minutos.
- No fim do prazo, o worker (`checkout:worker`) consulta o Mercado Pago. Se o Pix foi pago, confirma o pedido. Se não, **cancela o Pix no Mercado Pago primeiro** e só libera o estoque depois de o cancelamento ser confirmado. Um Pix que ainda pode ser pago nunca perde a reserva.
- Começar outro checkout (Pix ou cartão) encerra o Pix aberto anterior do mesmo cliente, pelo mesmo caminho.
- Se a resposta de criação se perder, o pedido fica reservado e o worker procura o pagamento pela referência do pedido antes de decidir.

### Limites conhecidos

- **Pix pago depois de a reserva ser liberada.** O cancelamento prévio torna isso muito improvável. Se acontecer e ainda houver estoque livre, o pedido é confirmado. Se não houver, o webhook responde 500 e registra `Reserved stock is not available for order ...`: o pagamento precisa ser **estornado manualmente** no Mercado Pago. Não há aviso automático no Admin para esse caso.
- **Estorno e chargeback** não mudam o pedido sozinhos. Estorne no painel do Mercado Pago e ajuste o status do pedido no Admin.
- A API usada é a de pagamentos (`/v1/payments`). O Mercado Pago a mantém, mas recomenda a API de Orders para integrações novas; a troca ficaria isolada em `src/lib/mercadopago.ts`.

## Variáveis

| Variável | Onde | Valor |
|---|---|---|
| `PIX_ENABLED` | web | `true` para oferecer Pix. Padrão `false` |
| `MERCADOPAGO_ACCESS_TOKEN` | web **e** worker | **Segredo.** Access Token da aplicação (`TEST-...` ou `APP_USR-...`) |
| `MERCADOPAGO_WEBHOOK_SECRET` | web **e** worker | **Segredo.** "Assinatura secreta" da tela de Webhooks da aplicação |

Regras de ambiente: em produção (`APP_ENV=production`) um token `TEST-` é recusado (`MercadoPagoTestCredentialInProduction`). O host da API é fixo no código (`https://api.mercadopago.com`). Nenhum segredo vai para log, erro ou resposta.

`PIX_ENABLED=false` pausa só **novos** pedidos Pix. Avisos de pedidos existentes continuam sendo processados.

## Configurar no Mercado Pago

1. Em **Suas integrações**, crie a aplicação com o produto **Checkout Transparente / Checkout API**.
2. Confirme com o dono da conta que ela tem **chave Pix cadastrada**. Sem chave, a criação do Pix é recusada.
3. **Credenciais de teste** → copie o Access Token para `MERCADOPAGO_ACCESS_TOKEN` do staging (web e worker).
4. **Webhooks → Configurar notificações**:
   - URL de teste: `https://<host do staging>/api/mercadopago/webhook`
   - URL de produção: `https://raredept.com.br/api/mercadopago/webhook`
   - Evento: **Pagamentos**.
   - Salve e copie a **assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET`.
5. O botão de simular notificação deve receber **200** (`{"received":true,"ignored":true}`): o pagamento simulado não existe na conta, então é ignorado. **401** significa assinatura secreta errada.
6. Só então ligue `PIX_ENABLED=true` no web.

O staging fica atrás de um gate Basic; a rota do webhook é liberada dele (como a da Stripe) porque valida a própria assinatura.

## Homologação (staging)

Antes de ligar em produção, comprove no staging com credenciais de teste:

1. Pix criado: a tela mostra QR code, código e o prazo de 30 minutos; o pedido fica "Aguardando pagamento".
2. Pix aprovado (simulado pelas ferramentas de teste do Mercado Pago): pedido "Pago", estoque −1 uma única vez, e-mail enfileirado, notificação no Admin.
3. Pix não pago: aos 30 minutos o worker cancela o Pix e o estoque volta (log `released`).
4. Trocar de Pix para cartão no meio: o Pix anterior é cancelado e a reserva não duplica.
5. Cartão continua funcionando como antes.

## Rollback

`PIX_ENABLED=false` no web. Não exige reverter código nem migration. Os pedidos Pix em aberto continuam sendo encerrados pelo worker.

Migration `20261013120000_pix_mercadopago` é aditiva: valor `mercadopago` no enum `PaymentProvider`, coluna `Order.mercadoPagoPaymentId` e tabela `PixCharge`.
