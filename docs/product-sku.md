# SKU no catálogo e foto no pedido

Guia interno curto (ciclo RARE-ORDER-ITEM-IMAGE-01).

## O que é SKU

SKU é o **código interno** que identifica uma peça vendável no estoque. Ele aparece no Admin ao
lado do tamanho e do estoque, na lista de produtos e no detalhe do pedido, para o vendedor saber
exatamente qual peça separar, mesmo quando há várias parecidas (por exemplo, camisetas Corteiz).

O cliente não digita nem escolhe SKU. Ele não muda preço, frete, estoque nem pagamento.

## Onde o SKU fica

- Cada **variação** (tamanho) tem o próprio SKU. Exemplo: a camiseta em M e em G tem dois SKUs.
- Produto **sem tamanhos** usa uma variação só (por exemplo, "Único"). O SKU dessa linha é o SKU
  do produto. Não existe um segundo campo de SKU no produto.

## Como criar ou editar

1. Admin → Produtos → Novo produto (ou Editar).
2. Em **Variações / estoque / SKU**, preencha Tamanho, Estoque e, se quiser, SKU em cada linha.
   "Adicionar variação" cria outra linha.
3. Salve.

Regras aplicadas ao salvar:

- **Opcional.** Pode deixar em branco. O produto continua publicando, vendendo e movimentando
  estoque normalmente. Em branco é gravado como vazio de verdade (NULL), não como texto vazio.
- **Normalizado.** Espaços nas pontas são removidos e tudo vira maiúscula: `crtz-tsh-blk-g` é
  salvo como `CRTZ-TSH-BLK-G`.
- **Formato.** De 3 a 64 caracteres, só letras sem acento (A-Z), números, hífen (`-`) e
  sublinhado (`_`).
- **Único.** Dois itens não podem ter o mesmo SKU. Se já existir, o Admin mostra
  "Este SKU já está sendo utilizado por outro item." e nada é salvo.
- Remover uma variação libera o SKU dela para outro item.
- O sistema não gera SKU automaticamente.

## Por que precisa ser único

O SKU só serve para identificar a peça se apontar para **uma** peça. A unicidade é garantida duas
vezes: pela validação do Admin e por um índice único no banco (`ProductVariant_sku_key`). Assim,
nem dois salvamentos ao mesmo tempo conseguem criar um SKU repetido.

## Convenção sugerida (recomendação, não regra)

`MARCA-TIPO-MODELO/COR-TAMANHO`, em abreviações curtas:

| Peça | SKU sugerido |
| --- | --- |
| Camiseta Corteiz preta, G | `CRTZ-TSH-BLK-G` |
| Camiseta Corteiz branca, M | `CRTZ-TSH-WHT-M` |
| Bolsa Supreme, tamanho único | `SUP-BAG-RED-UN` |

Qualquer código no formato permitido é aceito. Use a convenção que facilitar a separação no
estoque e mantenha-a igual em todo o catálogo.

## Busca

- **Produtos:** a busca aceita nome, marca ou SKU (parte do código também serve).
- **Pedidos:** a busca aceita número, nome, e-mail ou o SKU **gravado no pedido**.

## Foto e SKU no pedido (histórico)

Ao criar o pedido, cada item grava uma cópia ("snapshot") de nome, tamanho, SKU, preço unitário e
imagem. A imagem vem só do catálogo (imagem da variação, se um dia existir; senão a primeira foto
do produto; vídeos são ignorados) e nunca de algo enviado pelo cliente.

Depois disso, mudar o SKU ou a foto no catálogo, ocultar ou excluir o produto **não altera** o
pedido.

Pedidos criados antes deste ciclo não têm essa cópia, e nada foi preenchido retroativamente. Para
eles o Admin mostra:

- **Foto:** a foto atual do produto, se ele ainda existir; senão, o quadro "Sem imagem".
- **SKU:** o SKU atual só quando a ligação ainda é certa (mesma variação, mesmo produto e mesmo
  tamanho do pedido), escrito como **"SKU atual: … (do catálogo hoje; o pedido é anterior ao
  registro do SKU)"**. Caso contrário a linha de SKU não aparece.

## Migração e dados existentes

Migration `20261116120000_variant_sku_order_item_snapshot` (aplicada pelo `prisma migrate deploy`
do deploy normal; nunca rodar manualmente em produção):

1. normaliza os SKUs já cadastrados (trim + maiúsculas; vazio vira NULL);
2. se dois itens tiverem o mesmo SKU, o ativo mais antigo fica com ele e os outros ficam sem SKU
   (estoque, tamanhos e pedidos não mudam);
3. cria o índice único;
4. adiciona `skuSnapshot`, `imageUrlSnapshot` e `catalogSnapshotAt` (todos opcionais) em
   `OrderItem`, sem preencher pedidos antigos.

Antes do deploy, dá para conferir (somente leitura) se o passo 2 vai mexer em algo:

```sql
SELECT UPPER(BTRIM("sku")) AS sku, COUNT(*)
FROM "ProductVariant"
WHERE NULLIF(BTRIM("sku"), '') IS NOT NULL
GROUP BY 1
HAVING COUNT(*) > 1;
```

Nenhuma linha = nenhum SKU será removido.
