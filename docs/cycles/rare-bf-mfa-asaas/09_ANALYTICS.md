# 09 — Analytics

Fonte: snapshots dos itens de pedidos **pagos** (mesma definição de pago e mesma janela por data de pagamento, fuso São Paulo, do restante do Analytics). Sem visitas, funil ou conversão — a loja não mede isso e nada foi inventado.

| Métrica | Origem |
|---|---|
| Pedidos com promoção | `COUNT(DISTINCT orderId)` com `promotionId` |
| Receita promocional | soma de `OrderItem.totalInCents` promocionais |
| Desconto concedido | soma de `promotionDiscountInCents × quantity` |
| Itens vendidos em promoção | soma de `quantity` |
| Promoções mais usadas | top 5 por receita (nome do snapshot) |

Black Friday: basta filtrar o período da campanha — a linha da promoção "SALE BLACK FRIDAY" no top mostra pedidos, receita, desconto e itens. "Top produtos da campanha" não tem visão própria: **FUTURE FEATURE** (os dados existem no snapshot).

Dashboard operacional: ver 08_ADMIN_UX.

Validação: `analytics/page.test.ts`. Números reais: **MANUAL** após vendas em staging/produção.
