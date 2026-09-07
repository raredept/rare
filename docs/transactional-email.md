# E-mail transacional e DNS

O projeto possui uma interface de provider e templates para confirmação de pedido,
pagamento aprovado, pagamento recusado, pedido enviado e contato/suporte. O driver
permanece `disabled`: nenhum e-mail real é enviado e nenhum fornecedor foi fixado.
Falhas futuras do provider são contidas e não devem reverter a confirmação do pedido.

Variáveis não secretas preparadas:

- `EMAIL_DRIVER=disabled`
- `EMAIL_FROM_ORDERS=pedidos@raredept.com.br`
- `EMAIL_FROM_SUPPORT=suporte@raredept.com.br`
- `EMAIL_REPLY_TO=contato@raredept.com.br`

Depois de confirmar o provedor disponivel, implemente um adaptador `TransactionalEmailProvider`,
configure as credenciais apenas no ambiente e troque o driver pelo nome do adaptador.

## DNS pendente

Os valores finais dependem do fornecedor. Envio transacional nao exige trocar os MX
da caixa de entrada: preserve os registros existentes. Configure somente os registros
de autenticacao de envio e, quando exigido, o subdominio de retorno indicado pelo provedor.
Publique SPF com uma única política consolidada e adicione
os seletores DKIM entregues pelo provedor. Preserve o registro DMARC existente; revise
os relatórios e somente endureça a política depois de confirmar SPF/DKIM alinhados.
Não invente prioridades, hosts MX, includes SPF ou chaves DKIM antes da contratação.

As caixas/aliases planejados são `contato@raredept.com.br`,
`suporte@raredept.com.br` e `pedidos@raredept.com.br`.

## Gate de homologacao

Os templates e testes locais nao comprovam entrega. Este checkout ainda nao chama
um adaptador real nem possui outbox persistente de e-mail. Faltam identificar o
provedor, credencial, remetente autenticado e destinatario de teste controlado;
implementar a fila persistente com chave idempotente por pedido/tipo, tentativas
recuperaveis e identificador idempotente do provedor; e comprovar recebimento real.
Aceitacao HTTP pela API do provedor tambem nao basta. A confirmacao do pagamento
deve permanecer commitada independentemente de falha de notificacao. Mantenha
`EMAIL_DRIVER=disabled` ate essa homologacao.
