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

Depois de contratar um provedor, implemente um adaptador `TransactionalEmailProvider`,
configure as credenciais apenas no ambiente e troque o driver pelo nome do adaptador.

## DNS pendente

Os valores finais dependem do fornecedor contratado. No Cloudflare, configure os MX
informados pelo provedor, publique SPF com uma única política consolidada e adicione
os seletores DKIM entregues pelo provedor. Preserve o registro DMARC existente; revise
os relatórios e somente endureça a política depois de confirmar SPF/DKIM alinhados.
Não invente prioridades, hosts MX, includes SPF ou chaves DKIM antes da contratação.

As caixas/aliases planejados são `contato@raredept.com.br`,
`suporte@raredept.com.br` e `pedidos@raredept.com.br`.
