# SKU + foto no item do pedido — plano de produção e rollback

Ciclo RARE-ORDER-ITEM-IMAGE-01, auditado em RARE-ORDER-ITEM-IMAGE-SKU-AUDIT-01.
Migration: `20261116120000_variant_sku_order_item_snapshot`. **Nada aqui foi executado em
produção.** Cada passo exige autorização do operador.

## Preflight já medido (2026-11-16, somente leitura, transação `READ ONLY`)

| Medida | Valor |
| --- | --- |
| Variações (`ProductVariant`) | 214 |
| Variações com SKU | 5 |
| SKUs que a normalização mudaria | 0 |
| SKU só com espaços / vazio | 0 |
| Grupos de SKU duplicado | 0 |
| Variações que perderiam SKU | 0 |
| SKUs fora do formato depois de normalizar | 0 |
| Itens de pedido existentes | 10 (ficam sem snapshot, sem backfill) |
| Última migration aplicada | `20261114140000_support_requests` |
| Fotos de produto | 179 (todas R2; 100 com miniatura gerada, 79 sem) |

Com esses números a migration **não altera nenhum valor existente**: só cria o índice e as três
colunas novas.

## Plano

1. **Preflight somente leitura** (repetir logo antes, o catálogo pode ter mudado): a consulta de
   `docs/product-sku.md`, em transação `BEGIN READ ONLY ... ROLLBACK`. Esperado: nenhuma linha.
   Se aparecer duplicata ou SKU fora do formato, parar e decidir caso a caso.
2. **Evidência pré-migration dos SKUs** (somente leitura), guardada fora do repositório junto ao
   backup:
   ```sql
   BEGIN READ ONLY;
   COPY (SELECT id, "productId", size, sku, active, "createdAt" FROM "ProductVariant" WHERE sku IS NOT NULL ORDER BY id) TO STDOUT WITH CSV HEADER;
   ROLLBACK;
   ```
   Registrar o sha256 do arquivo.
3. **Backup de produção** no mesmo procedimento do go-live (dump + restore de verificação), com
   sha256.
4. **Migration**: pelo `preDeployCommand` do Railway (`prisma migrate deploy`) no deploy normal.
   Nunca rodar SQL manual. Duração esperada: milissegundos (214 linhas); o índice bloqueia
   escritas em `ProductVariant` só durante a criação.
5. **Deploy** de `rare` (web). O worker `rare-cron` não usa os campos novos; pode ficar no SHA
   anterior ou acompanhar.
6. **Health**: `/api/health` 200, `prisma migrate status` em dia, logs sem erro P2002/P2022.
7. **Smoke Admin produto**: abrir um produto, ver as linhas Tamanho / Estoque / SKU, salvar sem
   mudar nada (estoque e SKU iguais depois).
8. **Smoke busca**: buscar um dos 5 SKUs em Produtos (completo e em minúsculas).
9. **Smoke pedido existente**: abrir `RARE-20261116-SPVPKE`. Esperado: foto atual do produto (ou
   "Sem imagem") e SKU só como "SKU atual … (do catálogo hoje)", se houver.
10. **Smoke pedido novo**: no próximo pedido real, conferir no banco (somente leitura) que
    `catalogSnapshotAt` está preenchido e que o Admin mostra foto + SKU gravados.
11. **Monitorar** 24 h: erros 5xx no Admin de pedidos/produtos, P2002 inesperados, tempo do
    detalhe do pedido.

Opcional, separado: `npm run media:variants:backfill -- --dry-run` e depois `--apply` (em lotes)
gera miniaturas para as 79 fotos que ainda não têm; até lá, a miniatura do pedido dessas fotos
carrega o arquivo original (lazy, caixa fixa de 80 × 100 px).

## Rollback

O que a migration faz e como desfazer:

| Mudança | Reverter código basta? | Como desfazer |
| --- | --- | --- |
| Colunas `skuSnapshot`, `imageUrlSnapshot`, `catalogSnapshotAt` | Sim: o código anterior não as lê nem escreve; colunas nulas extras não quebram nada | Manter. Remover só com migration nova, se um dia for preciso |
| Índice único `ProductVariant_sku_key` | Sim para leitura. O Admin anterior não trata o erro: salvar um SKU repetido mostraria a página de erro em vez da mensagem | Se for preciso, migration nova com `DROP INDEX IF EXISTS "ProductVariant_sku_key";` |
| Normalização / limpeza de SKUs (passos 1-2) | **Não**: reverter o código não restaura os valores antigos | Restaurar a partir da evidência do passo 2 do plano (CSV id → sku). Com o preflight atual (0 mudanças), não há o que restaurar |

Ordem do rollback: reverter o deploy de `rare` para `44db0f3` pelo Railway. Não apagar o registro
da migration em `_prisma_migrations` nem rodar SQL manual: a migration é aditiva e o código
anterior funciona com ela aplicada (o único efeito é a página de erro para SKU duplicado, descrito
acima). Pedidos criados no intervalo guardam snapshot nas colunas novas, que continuam lá se o
código for reaplicado.
