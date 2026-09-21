# E-mail de confirmação de pagamento

O release implementa outbox persistente e dois transportes explícitos, `smtp` (compatível com Zoho) e `zeptomail` (REST/HTTPS, para ambientes que bloqueiam SMTP de saída). A entrega externa continua **não homologada** e produção mantém `EMAIL_DRIVER=disabled`. O proprietário confirmou a caixa Zoho `contato@raredept.com.br`; faltam host/região, credencial SMTP e destinatário controlado para o ensaio. Estado consolidado: [FINAL_RELEASE_STATUS.md](../FINAL_RELEASE_STATUS.md).

## Drivers de transporte: `disabled`, `smtp`, `zeptomail`

`EMAIL_DRIVER` escolhe **explicitamente** o transporte. Outbox, claim/finish, retries, idempotência `(orderId, kind)`, templates (`payment_approved`, `order_shipped`), `EMAIL_DELIVERY_MODE`, `EMAIL_TEST_RECIPIENTS` e `EMAIL_SEND_NOT_BEFORE` são os mesmos nos três; só a camada de envio muda. **Não existe fallback automático** entre transportes: se o driver escolhido falhar, a linha segue a regra do outbox e nunca é reenviada por outro transporte.

| Driver | Uso | Observação |
| --- | --- | --- |
| `disabled` | padrão e **produção enquanto não autorizada** | não assume linhas, não abre conexão; a intenção continua sendo gravada |
| `smtp` | local, outro provedor, fallback operacional **manual** | Nodemailer; a Railway bloqueia SMTP de saída (587/465/2525 em timeout), então não funciona em containers Railway |
| `zeptomail` | Railway (HTTPS 443) | REST `POST https://api.zeptomail.com/v1.1/email`, `Authorization: Zoho-enczapikey <Send Mail token>` |

### Variáveis do driver `zeptomail`

| Variável | Requisito |
| --- | --- |
| `EMAIL_DRIVER` | `zeptomail` |
| `ZEPTOMAIL_SEND_TOKEN` | **Segredo.** Send Mail token do *Mail Agent* (aceita com ou sem o prefixo `Zoho-enczapikey `). Somente Railway/servidor: nunca Git, log, relatório, bundle ou resposta de erro |
| `ZEPTOMAIL_API_BASE` | Opcional. Padrão `https://api.zeptomail.com/v1.1`. Só aceita https e hosts oficiais da ZeptoMail (`api.zeptomail.{com,eu,in,com.au,jp,com.cn,sa,ca}`) com caminho `/v1.1`; qualquer outro valor invalida a configuração, para o token nunca ir a outro host. Use o host do **data center da sua conta** |
| `EMAIL_FROM_ORDERS` | Remetente; precisa pertencer a um domínio **verificado** no Mail Agent |
| `EMAIL_REPLY_TO` | Opcional (`contato@raredept.com.br`) |
| `APP_ENV`, `EMAIL_DELIVERY_MODE`, `EMAIL_TEST_RECIPIENTS`, `EMAIL_SEND_NOT_BEFORE` | Iguais ao SMTP (abaixo). `SMTP_*` não são lidas por este driver e podem permanecer como legado |

Configure nos **dois** serviços: web (enfileira) e worker (`rare-checkout-worker-staging` / `rare-cron`, que envia). Editar variável na Railway pode reaplicar o código do Git do serviço: confira o commit/hash implantado depois.

### Como a requisição é feita

- Corpo: `from`, `to` (um destinatário), `reply_to`, `subject`, `textbody`, `htmlbody`, `client_reference`, sem rastreio de abertura/clique. `client_reference` = `rare-` + 32 hex derivados do id da mensagem do outbox (sem PII, número de pedido ou segredo).
- **Timeout explícito de 15 s** e sem redirecionamentos (o cabeçalho de autenticação nunca é reenviado).
- **Uma única camada de repetição: o outbox** (até 5 tentativas, espera exponencial a partir de 1 min). A camada HTTP não repete nada.
- Classificação: 2xx com corpo reconhecido → `accepted`; 2xx com corpo irreconhecível → `uncertain`; 429, 408 e 5xx → `retry`; falha de DNS, recusa, conexão ou TLS **antes do envio** → `retry`; timeout de resposta ou queda depois do envio → `uncertain` (pode ter sido aceito; sem retry cego, como no SMTP); 400, 401, 402, 403 e demais 4xx → `failed`. O código de erro da ZeptoMail (por exemplo `TM_3201`) vai só ao log do servidor; no banco fica apenas um código fixo (`ZeptoMailRateLimited`, `ZeptoMailAuthenticationFailed`…).
- Risco residual: a API não tem chave de idempotência; um 5xx repetido pode, raramente, duplicar uma mensagem que o provedor chegou a processar.

### Logs e health

Cada tentativa registra uma linha JSON sanitizada: `provider`, `messageKind`, `order` (hash de 12 hex), `attempt`, `status`, `code`, `providerErrorCode`, `providerRequestId`, `latencyMs`. Nunca token, cabeçalho `Authorization`, destinatário, nome, número do pedido, corpo ou texto de resposta do provedor. O `/api/health` de **Admin** traz `environment.email = { driver, configured, deliveryMode }` (só enum e booleano); anônimo não recebe nada sobre e-mail.

### Staging e produção

- **Staging:** `APP_ENV=staging`, `EMAIL_DELIVERY_MODE=test`, `EMAIL_TEST_RECIPIENTS` com as caixas controladas, corte `EMAIL_SEND_NOT_BEFORE` no início do ensaio. Destinatário fora da lista → `EmailRecipientNotAllowlisted` e **zero** chamadas à ZeptoMail.
- **Produção:** permanece `EMAIL_DRIVER=disabled` (com `CHECKOUT_ENABLED` e `SHIPPING_ENABLED` em `false`) até autorização explícita. Ao ativar: `APP_ENV=production`, `EMAIL_DELIVERY_MODE=production`, token de **produção** em Mail Agent próprio, corte no instante da ativação.
- **DNS manual (ZeptoMail):** o domínio do remetente precisa ser adicionado e verificado no Mail Agent, com o DKIM e o CNAME de *bounce* que a própria ZeptoMail gera (valores exibidos no painel). O Zoho Mail atual (seletor `zoho`) **não** cobre automaticamente a ZeptoMail. Preserve MX, SPF do Zoho Mail e DMARC; não suba o DMARC de `p=none` sem histórico de entrega estável.

### Troubleshooting

| Sintoma (código no outbox ou no log) | Causa provável | Ação |
| --- | --- | --- |
| `MissingZEPTOMAIL_SEND_TOKEN`, `InvalidZeptoMailSendToken` | token ausente, com espaço ou quebra de linha | recolar o token no serviço (web **e** worker) |
| `InvalidZeptoMailApiBase` | `ZEPTOMAIL_API_BASE` fora dos hosts oficiais | remover a variável ou usar o host do seu data center |
| `ZeptoMailAuthenticationFailed` (401) | token inválido, revogado ou de outro data center | gerar novo Send Mail token; conferir o host |
| `ZeptoMailForbidden` (403), `providerErrorCode` `AE_101`/`SERR_156` | conta bloqueada ou IP não autorizado no Mail Agent | resolver no painel da ZeptoMail |
| `ZeptoMailCreditsUnavailable` (402) | créditos esgotados ou expirados | recarregar; depois revisar linhas `failed` |
| `ZeptoMailRejectedRequest` (400) | remetente/domínio não verificado, campo inválido | conferir domínio verificado e `EMAIL_FROM_ORDERS` |
| `ZeptoMailRateLimited`, `ZeptoMailServerError` | limite ou instabilidade | o outbox repete sozinho; após 5 tentativas vira `failed` (`RetryLimitReached`) |
| `ZeptoMailDeadlineExceeded`, `ZeptoMailAcceptanceUnknown`, `ZeptoMailUnexpectedResponse` (`uncertain`) | pode ter sido aceito | conferir o *Email Logs* da ZeptoMail pelo `providerRequestId`/`client_reference`, depois `email:review-outbox` |
| Aceito, mas em Spam | reputação e DNS | ver DNS acima; não é defeito da aplicação |

### Rollback

Parar os envios **não exige reverter código:** `EMAIL_DRIVER=disabled` nos serviços web e worker. O outbox segue enfileirando; ao religar, `EMAIL_SEND_NOT_BEFORE` impede enviar o backlog. Voltar ao SMTP é só `EMAIL_DRIVER=smtp` (as variáveis `SMTP_*` legadas ficam nos ambientes até a migração ser consolidada; a limpeza é tarefa separada).

## Pagamento, fila e falhas

- A transição confiável para `paid` grava `EmailOutbox` na mesma transação do pedido, estoque e evento Stripe. A restrição única `(orderId, kind)` impede duas entradas `payment_approved`, inclusive com eventos de sessão e PaymentIntent concorrentes.
- O snapshot contém somente destinatário, nome, número e total do pedido; não contém CPF, endereço, cartão ou payload Stripe. Não há envio no webhook nem na transação.
- O worker assume uma linha por operação SQL `FOR UPDATE SKIP LOCKED`, com lease de cinco minutos e token de posse. Ao atingir 45 segundos, encerra a tentativa como incerta e destrói o socket SMTP, inclusive durante TLS; não deixa a conexão em segundo plano. Isso não permite concluir se o servidor já havia aceitado a mensagem.
- Rejeição temporária explícita e falha comprovadamente anterior a DATA permitem até cinco tentativas, com espera exponencial a partir de um minuto. Rejeição permanente ou destinatário inválido termina em `failed` para revisão.
- Desconexão/timeout sem prova de rejeição, resposta desconhecida, worker interrompido ou perda da gravação após aceitação viram `uncertain`. **Não há retry automático** nesses casos. Um worker atrasado não sobrescreve a recuperação de seu lease.
- `accepted` significa aceitação SMTP; não comprova chegada à caixa. O `Message-ID` permanece estável nas tentativas, mas SMTP não garante deduplicação por esse ID. Não prometemos envio exatamente uma vez.
- `disabled` não assume mensagens nem abre conexão SMTP. Pedidos novos continuam registrando sua intenção de notificação. Não existe backfill de pedidos históricos.

O banco precisa receber a migration aditiva `20260907230000_payment_email_outbox` antes deste código. Falha na persistência da intenção reverte a transação para reentrega do webhook; falha posterior de SMTP nunca desfaz pagamento ou estoque. Rollback do aplicativo preserva a tabela.

## Configuração do ensaio

Nenhuma variável secreta é pública ou deve ser colocada em comandos, evidências ou Git. Somente depois de comprovar o isolamento do staging:

| Variável | Valor/requisito |
| --- | --- |
| `APP_ENV` | `staging` |
| `EMAIL_DRIVER` | `smtp` somente no ensaio autorizado; padrão `disabled` |
| `EMAIL_DELIVERY_MODE` | `test`; staging/preview/test rejeitam `production` |
| `EMAIL_TEST_RECIPIENTS` | Lista exata de caixas sob nosso controle, separadas por vírgula; sem curingas |
| `EMAIL_SEND_NOT_BEFORE` | Instante UTC ISO do começo do ensaio; impede disparar filas anteriores ao corte |
| `SMTP_HOST` | Host exibido em **Server Configuration Details** da própria conta Zoho, conforme região/tipo |
| `SMTP_PORT` | `465` TLS implícito ou `587` STARTTLS obrigatório |
| `SMTP_USER` | Endereço completo de autenticação confirmado na conta |
| `SMTP_PASSWORD` | Credencial SMTP/app password guardada no ambiente |
| `EMAIL_FROM_ORDERS` | `contato@raredept.com.br`, confirmado pelo proprietário; deve ser remetente/alias autorizado |
| `EMAIL_REPLY_TO` | `contato@raredept.com.br` |

Zoho documenta hosts diferentes por tipo de conta/datacenter, autenticação por endereço completo e possível senha de aplicativo com 2FA. Não foi inferido host regional, nem foram criados aliases ou novas contas. Ver [configuração SMTP oficial do Zoho](https://www.zoho.com/mail/help/zoho-smtp.html).

O transporte valida certificados e TLS 1.2+, proíbe leitura de arquivos/URLs, restringe o envelope a um destinatário e não ativa logs SMTP. A classificação usa comando e código numérico documentados pelo [Nodemailer](https://nodemailer.com/errors); quando não há certeza suficiente, o estado é `uncertain`.

## Executar e operar

No checkout completo do mesmo commit, com dependências instaladas e `DATABASE_URL` do próprio ambiente, execute `npm run email:process-outbox`. Cada execução processa até dez linhas. O CLI usa `tsx`; não deve ser executado apenas dentro do diretório standalone do Next. Logs e resultado exibem contagens e códigos, sem destinatários.

Depois da homologação, um serviço cron dedicado pode executar esse comando, usando banco/SMTP do mesmo ambiente. Nenhum agendamento de envio foi criado nesta entrega. Não reaproveite referências de produção no staging; a cron existente de reservas permanece independente. `env`/health distinguem configuração SMTP de entrega comprovada.

Para `uncertain`, conferir a pasta Enviados/logs do Zoho e o `Message-ID`, e confirmar com o destinatário controlado. Não repetir somente porque a aplicação não gravou o resultado. Após investigação, um operador pode registrar uma única linha:

```text
npm run email:review-outbox -- ID accepted REFERENCIA_DA_EVIDENCIA
npm run email:review-outbox -- ID retry REFERENCIA_DA_REJEICAO_CONFIRMADA
npm run email:review-outbox -- ID failed REFERENCIA_DA_REVISAO
```

Escolher somente uma resolução: `accepted` quando comprovada aceitação; `retry` somente após comprovar que não foi aceita e corrigir a causa; `failed` para encerrar. A referência deve ser opaca, sem PII/segredos. O comando não envia e aceita apenas linhas `failed`/`uncertain`; `retry` reinicia o limite de tentativas. O corte temporal continua valendo. A revisão manual também não representa prova automática de entrega.

## Gates e DNS

`npm run qa:email-outbox` cria PostgreSQL **local descartável**, aplica migrations somente nele, testa concorrência/duplicatas/backoff/falhas/allowlist/reconciliação manual e o remove. Provedores são doubles em memória. O teste de cancelamento SMTP usa apenas um servidor em `127.0.0.1`, antes de autenticação ou envio da mensagem. `scripts/qa-checkout-concurrency.ts` também confere uma entrada da fila por pedido pago em cada corrida de pagamento/estoque. Esses testes não substituem: Stripe test real → fila → SMTP → recebimento na caixa controlada, com cabeçalhos SPF/DKIM/DMARC e confirmação do destinatário.

Preserve MX, SPF e DMARC existentes. Qualquer DKIM ou ajuste SPF depende dos valores da conta Zoho e deve consolidar, não sobrescrever, políticas atuais. Envio transacional não exige automaticamente trocar MX. Produção continua com driver desabilitado até homologação e autorização final; ativação futura exige modo `production`, ambiente de produção explícito, corte temporal novo e revisão da fila anterior.
