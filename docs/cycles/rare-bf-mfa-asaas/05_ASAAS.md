# 05 — Asaas

Documentação oficial consultada em 2026-11-06 (docs.asaas.com): autenticação, eventos de cobrança, recebimento de webhooks, QR Code Pix.

## Conferido na documentação

| Item | Documentação | Implementação |
|---|---|---|
| Auth | header `access_token`, não `Bearer` | `access_token` |
| Hosts | Sandbox `https://api-sandbox.asaas.com/v3`, Produção `https://api.asaas.com/v3` | host fixo por `ASAAS_ENV`; `ASAAS_API_BASE` só aceito se igual |
| Prefixo de chave | Produção `$aact_prod_`, Sandbox `$aact_hmlg_` | chave precisa casar com `ASAAS_ENV`, e ambiente com `APP_ENV` |
| GET com body | retorna 403 | GET sem body |
| User-Agent | recomendado | `RARE-Store/<versão> (Node.js)` |
| Webhook auth | header `asaas-access-token`; token 32–255 chars, sem espaço, nunca a API key | validação em tempo constante; config recusa token igual à chave |
| Idempotência | evento traz `id` único (`evt_…`), entrega *at least once* | `AsaasWebhookEvent.id` PK, `createMany skipDuplicates` |
| Resposta | 200 após persistir; não esperar processamento | persiste → 200 → processa em `after()`/worker |
| Fila | 15 falhas seguidas podem interromper; eventos guardados 14 dias | 200 depende só de auth + gravação |
| Pix | QR dinâmico com vencimento, expira até 12 meses após `dueDate`, pago uma vez | a reserva expira em 30 min e o worker **apaga a cobrança no Asaas antes** de liberar estoque |
| Pix CONFIRMED | pode ocorrer em bloqueio cautelar (até 72 h) e terminar REFUNDED | **corrigido neste ciclo** (abaixo) |
| Chave inativa | desabilitada após 3 meses sem uso | registrado em 15_MANUAL_ACTIONS |

## Fluxos

- **Cliente:** `Customer.asaasCustomerId`; reaproveita o salvo, senão busca por `externalReference` = id interno (resposta perdida), senão cria. Nunca um por tentativa; nunca id do browser. Envia só nome, CPF, e-mail; `notificationDisabled: true`.
- **Cobrança:** criada **depois** do pedido e da reserva, pelo `totalInCents` calculado no servidor; `billingType` explícito (`PIX` ou `CREDIT_CARD`; nunca `UNDEFINED`, que liberaria boleto); `externalReference` = id do pedido. Resposta conferida (referência, valor, cliente, tipo) antes de mostrar ao cliente.
- **Pix:** QR + copia-e-cola na página da loja (`/pedido/pix/[id]`), status pendente e expiração.
- **Cartão:** fatura hospedada do Asaas (`invoiceUrl` só de `*.asaas.com`). PAN/CVV nunca passam pela RARE.
- **Parcelamento:** não oferecido (nenhum `installmentCount` é enviado; a UI não anuncia parcelas). Exige decisão comercial e taxa da conta.
- **Boleto:** não oferecido (reserva de 30 min incompatível com compensação de boleto).
- **Falhas:** recusa (4xx, rede antes de enviar) libera estoque na hora; resultado incerto (timeout, 5xx, 429, resposta perdida) mantém a reserva e o worker resolve consultando o Asaas.
- **Webhook:** só eventos `PAYMENT_*` com `payment.id` válido viram trabalho; processamento sempre relê `GET /payments/{id}`.
- **Valor:** pagamento só marca o pedido pago se id, `externalReference`, valor e tipo conferem; divergência → não paga + notificação `payment_mismatch`.
- **Fora de ordem / duplicado:** lock da linha do pedido; pago nunca volta a pendente; reembolsado nunca volta a pago.
- **Reembolso:** botão no Admin (`requestAsaasRefund`) com claim atômico (não repete), audit log; estoque **não** volta automaticamente (peça pode não ter retornado).
- **Chargeback:** notificação ao Admin, pedido intacto.

## Achado e correção deste ciclo

- **Medium — Pix em bloqueio cautelar tratado como liquidado.** A documentação diz que um Pix pode ficar em `CONFIRMED` até 72 h e terminar `REFUNDED`. O pedido continua pago (estoque comprometido), mas agora o Admin recebe "Pix em análise: não envie até o status mudar para recebido" (`payment_pix_held`). Testes de regressão (`612cfa4`).

## Não verificável daqui

Nenhuma chamada real ao Sandbox foi feita: **não há chave Sandbox disponível** neste ambiente. Toda a integração foi exercitada com o transporte real contra um double em `fetch` (unit + PostgreSQL real). → **MANUAL/EXTERNAL**, ver 15_MANUAL_ACTIONS.
