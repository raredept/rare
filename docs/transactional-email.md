# E-mail de confirmação de pagamento

O release implementa outbox persistente e adaptador SMTP compatível com Zoho. A entrega externa continua **não homologada** e produção mantém `EMAIL_DRIVER=disabled`. O proprietário confirmou a caixa Zoho `contato@raredept.com.br`; faltam host/região, credencial SMTP e destinatário controlado para o ensaio. Estado consolidado: [FINAL_RELEASE_STATUS.md](../FINAL_RELEASE_STATUS.md).

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
