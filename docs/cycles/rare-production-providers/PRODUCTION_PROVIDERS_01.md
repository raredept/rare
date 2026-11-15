# RARE-PRODUCTION-PROVIDERS-01 — Asaas LIVE + Resend production (2026-11-15)

Evidência sanitizada. Sem chaves, tokens, senhas, CPF, endereço, e-mail completo de cliente, QR Pix
ou dado de cartão. Horários em UTC. Nenhum Admin, role, SEO, catálogo ou estoque manual alterado;
Clean Slate não reexecutado.

## 1. Checkpoint e safe mode (antes de qualquer mutação)

| Item | Valor |
|---|---|
| `MAIN_SHA` | `fe02927` (merge do PR #2; árvore idêntica a `bd873f2`) |
| `PRODUCTION_WEB_SHA` (`rare`) | `fe02927`, SUCCESS |
| `PRODUCTION_WORKER_SHA` (`rare-cron`) | `fe02927`, SUCCESS |
| `CHECKOUT_ENABLED` / `PAYMENT_PROVIDER` | `false` / `disabled` (web e worker) |
| `/api/health` | 200, `configuration.errors` vazio |
| `POST /api/checkout` | 503 |
| Stripe | nenhuma variável `STRIPE_*`; `CRON_SECRET_PREVIOUS` e `RELEASE_SECURITY_FREEZE` ausentes |
| Banco (contagens) | 0 pedidos, 0 reservas, 0 movimentações, 0 analytics, outbox vazio, 0 suporte, 76 variantes disponíveis |

## 2. Configuração (somente presença/enum)

Web `rare` e worker `rare-cron` (o worker processa webhooks Asaas, expiração, outbox e suporte, por
isso recebe as mesmas variáveis):

| Variável | Estado |
|---|---|
| `ASAAS_ENV` | `production` |
| `ASAAS_API_KEY` | PRESENT (prefixo de produção validado; igual nos dois serviços) — colocada pelo operador |
| `ASAAS_WEBHOOK_TOKEN` | PRESENT, 64 caracteres aleatórios gerados localmente, nunca impressos; distinto da chave e do Sandbox |
| `ASAAS_SUCCESS_REDIRECT` | `true` (Site da conta = raredept.com.br, conferido pela API) |
| `PAYMENT_PROVIDER` | `asaas` |
| `EMAIL_DRIVER` / `EMAIL_DELIVERY_MODE` | `resend` / `production` |
| `RESEND_API_KEY` | PRESENT (chave nova, só envio) — colocada pelo operador |
| `EMAIL_FROM_ORDERS`, `EMAIL_REPLY_TO`, `SUPPORT_INBOX_EMAIL` | PRESENT (caixa do domínio RARE) |
| `EMAIL_SEND_NOT_BEFORE` | PRESENT (2026-11-15T21:24Z; outbox estava vazio) |
| `EMAIL_TEST_RECIPIENTS` | ABSENT (produção não depende de allowlist) |

Deploys de configuração: chaves aplicadas 21:37 (SUCCESS), provider/driver 21:42 (SUCCESS), sempre
com checkout OFF.

## 3. Asaas Production (leitura pela API, só status)

- Conta: `general`, `commercialInfo`, `bankAccountInfo`, `documentation` = APPROVED; Site = raredept.com.br.
- Webhook: 1, URL `https://raredept.com.br/api/asaas/webhook`, ativo, não interrompido, API v3,
  envio sequencial, 13 eventos `PAYMENT_*`, e-mail de aviso configurado.
- Chave Pix: 1 EVP ACTIVE.
- Endpoint: sem token → 401; token errado → 401; GET → 405.
- Token: provado pelo evento real `PAYMENT_CREATED` aceito e processado (22:07:35).

## 4. Resend production

- Domínio raredept.com.br: Verified.
- Chave: válida e restrita a envio (`GET /domains` → `restricted_api_key`).
- Suporte real (`SUP-7PKE3465`, mensagem sintética, e-mails do operador): `SupportRequest` gravado
  com `status=SENT` e `confirmationStatus=SENT`; e-mail da equipe e confirmação ao cliente
  entregues (Delivered), um de cada; From = caixa do domínio RARE; Reply-To da equipe = e-mail do
  cliente; Reply-To da confirmação = caixa da RARE.

## 5. Abertura e compra controlada

- 21:50 `CHECKOUT_ENABLED=true` (deploy SUCCESS 21:52; health 200; `POST /api/checkout` sem sessão → 401).
- Antes: Meia Fire (variante Único) estoque 1, reservado 0, vendas 0.
- 22:07 pedido `RARE-20261115-32TBAM`, Pix, R$ 64,32 (subtotal R$ 46,90 + frete R$ 22,11 − RARE10
  R$ 4,69): criado uma vez; reserva única (`reserve` 1, reservado 1); cobrança LIVE criada (Pix,
  R$ 64,32, PENDING, referência = id do pedido, cliente Asaas vinculado); `PAYMENT_CREATED` aceito.
- **Falha:** logo após criar a cobrança, `GET /payments/{id}/pixQrCode` foi recusado com 4xx
  (`AsaasRejectedRequest`); o checkout respondeu 503 ao cliente, sem QR. Minutos depois o mesmo
  QR respondia 200. Nenhum pagamento feito.
- **Failure path (§48):** 22:08 `CHECKOUT_ENABLED=false`, deploy SUCCESS 22:10, `POST /api/checkout` → 503.
  Chaves e webhook Asaas preservados (§49).
- A reserva fica protegida e a cobrança vinculada: o worker de expiração apaga a cobrança no Asaas
  antes de liberar o estoque, no fim da janela (22:37).

## 6. Correção (branch `fix/asaas-pix-qr-retry`)

- Checkout: busca do QR com até 3 novas tentativas curtas (0,6 s, 1,2 s, 2,4 s), sem repetir falha
  de autenticação. Se o QR ainda não existir, o cliente vai para a página do Pix em vez de 503; a
  cobrança já está vinculada ao pedido e conferida (valor, referência, cliente, tipo).
- Página do Pix: quando o pedido Asaas não tem QR salvo, relê a cobrança na API e só mostra o QR se
  ela for do próprio pedido, PENDING, do mesmo valor, cliente e tipo Pix, e dentro da reserva. A
  página já se atualiza sozinha a cada 5 s.
- Pagamento continua confirmado só por webhook/estado da API; nada no navegador marca pedido pago.

## 7. Estado

`FINAL STATUS = BLOCKED` até a correção passar por CI, merge e deploy aprovados; checkout OFF.
