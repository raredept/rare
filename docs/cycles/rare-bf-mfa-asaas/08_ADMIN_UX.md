# 08 — UX do Admin

## Central de Promoções (`/admin/promotions`)

- Busca por nome/código, filtro por status **efetivo** (o que o cliente vê agora), filtro por período (sobreposição), ordenação (atualização, início, fim, prioridade, nome), paginação.
- Colunas: nome, status, tipo, desconto, escopo, início, fim, produtos/categorias afetados, destaque na home.
- Detalhe: ações Ativar / Pausar / Encerrar / Duplicar / Editar / Pré-visualizar, pendências que impedem ativação, histórico do audit log.
- Formulário: campos comerciais, datas em horário de Brasília, seleção de produtos/categorias, preview do efeito nos preços antes de salvar, mensagens de erro em português.
- Preview desktop + mobile sem publicar.
- Item "Promoções" no menu Admin.

## Segurança da conta (`/admin/security`)

Status do segundo fator, códigos de recuperação restantes, regenerar códigos (exige TOTP novo, mostra uma vez).

## Pedido (`/admin/orders/[id]`)

Preço original, promoção aplicada, desconto, preço final por item; frete e total; provider; id de pagamento parcial; botão de reembolso Asaas (pedido pago via Asaas).

## Dashboard

Card "Promoções": ativas, programadas, encerrando em 48 h (com links) e alertas "ativa sem produtos/categorias" e "período terminou mas ainda marcada ativa (já não altera preços)".

## Não verificado

Responsividade 320–1920 px, teclado, leitor de tela, contraste e overflow horizontal das telas novas: **MANUAL** (sem staging/navegador publicado neste ciclo; build de produção local OK).
