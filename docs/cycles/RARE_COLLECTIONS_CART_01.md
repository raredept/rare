# RARE-COLLECTIONS-CART-01 — Coleções promocionais + correção do parcelamento no carrinho

Base: `main@87eb664` (produção `rare` e `rare-cron` no mesmo SHA). Branch: `cycle/rare-collections-cart-01`.
Produção **não** foi alterada neste ciclo (sem migration, deploy, merge, criação de promoção ou movimentação de produto).

## 1. Problema

- Para montar uma "SALE BLACK", o operador criou uma **categoria** (`SALE`, slug `sale-black`). Como
  `Product.categoryId` é único, colocar uma peça ali a tiraria de Camisetas/Jaquetas. Categoria é
  **taxonomia**; campanha comercial é **promoção**.
- O carrinho dizia "Até 3x sem juros · ou até 12x no cartão" para qualquer total. Com a parcela mínima
  de R$ 10,00, R$ 42,21 só permite 4x (o checkout listava 4x; a PDP já dizia 4x desde o UIUX-PDP-002).

## 2. Arquitetura

| Conceito | Modelo | Exemplo |
| --- | --- | --- |
| Taxonomia | `Category`, `Product.categoryId`, `Product.subcategoryId` (inalterados) | Camisetas, Jaquetas |
| Coleção / campanha | `Promotion` + `PromotionProduct` / `PromotionCategory` (já existentes) | SALE BLACK, Drop especial |

Uma coleção é uma **promoção** com a exibição na loja ligada. Nenhum `ProductCategory` many-to-many foi
criado; `categoryId`/`subcategoryId` não mudam em nenhum fluxo.

### Migration (aditiva)

`prisma/migrations/20261117190000_promotion_storefront_collection` — somente `ADD COLUMN` com defaults:

| Coluna | Tipo | Default | Uso |
| --- | --- | --- | --- |
| `storefrontCollectionEnabled` | boolean | `false` | Exibir como coleção pública |
| `storefrontCollectionLabel` | text, nulo | `NULL` | Nome no menu (vazio = nome da promoção) |
| `storefrontCollectionSortOrder` | integer | `0` | Ordem no menu (0–999) |

Sem backfill: toda promoção existente continua com a coleção desligada. `homepageFeatured` continua
independente (uma promoção pode ser destaque da home **e** coleção).

### Quando uma coleção é pública

Todas as condições, avaliadas no instante da requisição:

1. `storefrontCollectionEnabled = true`;
2. status **efetivo** `ACTIVE` (mesma função `getEffectivePromotionStatus` do motor — datas incluídas);
3. desconto definido e promoções ligadas (`PROMOTIONS_ENABLED`);
4. pelo menos **um produto ativo cuja promoção vencedora é esta** (motor `selectPromotionForProduct`).

Fora disso: fora do menu e `/colecao/<slug>` responde **404 real** (rota em grupo próprio
`(store-collection)`, sem `loading.tsx`, como o `(store-missing)` do UIUX). DRAFT, SCHEDULED antes do
início, PAUSED, ENDED, vencida pela data de fim, desligada ou vazia → 404.

### Produtos da coleção (promoção vencedora)

`getPromotionWinnerProducts` (em `storefront.ts`) carrega os produtos **alvo** da promoção
(SELECTED_PRODUCTS → ids; SELECTED_CATEGORIES → categoria **ou** subcategoria; ALL_PRODUCTS → catálogo
ativo), precifica com o motor e mantém só os que **esta** promoção vence. Se outra promoção (maior
prioridade ou desconto) vence um produto, ele não aparece na coleção — e continua na categoria com o
preço que realmente paga. A campanha da home (`getCampaignProducts`) passou a usar a mesma função: o
cálculo de promoção não foi duplicado. Esgotados aparecem depois dos disponíveis, como no catálogo.

### Página `/colecao/[slug]`

Mesmo layout e componentes do catálogo (`CatalogProductGrid`, `CatalogEmptyState`, `CatalogToolbar`
com `basePath="/colecao"`): breadcrumb `Início / <nome>`, eyebrow (selo da promoção), H1 (nome no
menu), descrição **da própria promoção** (subtítulo, senão título; sem texto inventado), total,
filtros (Marca, Tamanho, Preço, Disponível agora — "Em promoção" é implícito e não aparece), ordenação
(Destaques, Mais recentes, Menor/Maior preço, esgotados no fim), paginação de 24, estado na URL.

SEO mínimo: `title`, `description` da promoção, canonical absoluto `/colecao/<slug>`, JSON-LD de
breadcrumb, 404 correto. **Fora do sitemap** — decisão do RARE-SEO-GOOGLE-01.

### Navegação

- `StoreChrome` carrega `getNavigationCollections()` em paralelo com as categorias (2 consultas no total,
  qualquer que seja o número de coleções; falha nela nunca derruba a loja).
- Desktop: pílulas depois das categorias, borda vermelha + ícone de etiqueta (forma, não só cor), mesmo
  tamanho/foco das categorias. Ordem: `storefrontCollectionSortOrder`, nome, id.
- A barra fica centralizada só quando tudo cabe; quando não cabe (ex.: 1024 px com coleção), alinha à
  esquerda com rolagem horizontal e o submenu de Acessórios abre fixo sob o botão — nada cortado, página
  sem rolagem lateral.
- Mobile: seção **Coleções** no topo do menu, antes de "Comprar por categoria".

### Admin

Promoções → editar → **Exibição na loja**: "Exibir esta promoção como coleção", "Nome no menu",
"Ordem no menu", com o texto: *Os produtos continuam em suas categorias originais. Esta opção cria uma
coleção promocional separada na loja.* e *Adicionar um produto à coleção NÃO altera a categoria dele.*

- Validação: nome no menu em texto simples (sem `<`/`>`/controle), até 40 caracteres; ordem inteira
  0–999; o rótulo nunca vira link (só texto). A opção não altera status, desconto, escopo, alvos ou
  prioridade.
- Duas coleções não podem ter o mesmo nome no menu (comparação sem maiúsculas/espaços; encerradas não
  contam).
- Auditoria: os três campos entram no before/after de `promotion.created`/`promotion.updated`
  (`AdminAuditLog`, sem sistema paralelo).
- Tela da promoção: bloco **Coleção na loja** com o endereço público e "No ar agora: N produto(s)" ou
  "A coleção só fica pública quando a promoção estiver ativa e tiver produtos elegíveis."
- RBAC: mesma permissão `commerce.promotions` (já inclui `SELLER_ADMIN`). Nenhuma permissão nova.
- Duplicar promoção: a cópia nasce com a coleção desligada.

## 3. Parcelamento no carrinho

`buildCardInstallmentHint` usa `listCardInstallmentPlans(amount, rules)` nos dois contextos (PDP e
carrinho) — a mesma função do checkout:

- maior sem juros disponível + maior plano disponível;
- só sem juros → "Até 3x sem juros" (sem "no cartão" redundante); só 1x → nada;
- o carrinho usa o total que mostra (`discountedTotalInCents`, já com promoção automática e cupom); antes
  do frete é conservador — o checkout pode oferecer mais quando o frete entra no total.

R$ 42,21 → "Até 3x sem juros · ou até 4x no cartão"; R$ 100,00 → 11x (antes dizia 12x); R$ 600,00 → 12x.
Nenhuma taxa, mínimo, arredondamento, `installmentCount`, validação do servidor, payload Asaas, webhook
ou snapshot mudou.

Busca por "12x" fixo: nenhuma promessa comercial restante (as ocorrências são comentários, texto do
Admin e uma métrica de teste).

## 4. Correção extra (defeito anterior em produção)

A barra "N produtos · Filtrar · Ordenar" estourava 30 px a 320 px em `/categoria/*` (produção `87eb664`):
o seletor de ordenação (16 px no celular para o iOS não dar zoom) não cabia ao lado de "Filtrar". Agora
os controles quebram linha. Coberto no teste de navegação (catálogo e coleção de 320 a 1440 px).

Também corrigido: `tests/e2e/bf-mfa-payments.spec.ts` procurava o aviso "30 minutos" só dentro do resumo
do pedido; o UIUX-CHECKOUT-005 (já em produção) moveu esse aviso para o passo "3 Pagamento". O teste agora
lê o resumo + o passo de pagamento (mesmas garantias: só Asaas, 30 minutos, nenhum outro gateway). Era só
o escopo do teste — o aviso continua na tela.

## 5. Testes

- Unitários: `src/lib/promotions/collections.test.ts`, `src/lib/storefront-collections.test.ts`
  (escopos, promoção vencedora, esgotados, estados, vazia, filtros/paginação, menu com 2 consultas,
  campanha da home), `promotions/actions.test.ts` (campos, auditoria, duplicidade, nenhuma escrita em
  `Product`), `card-installments-ui.test.ts` (carrinho e consistência PDP × carrinho × checkout).
- Lab (`tests/e2e/collections-cart.spec.ts`, build de produção, banco descartável, `SELLER_ADMIN`):
  criar e ativar a SALE BLACK pelo Admin; camiseta presente em `/categoria/camisetas` **e** na coleção
  com o preço da coleção; `categoryId`/`subcategoryId` idênticos antes/depois de criar, ativar,
  adicionar/remover produto e ligar/desligar a coleção; filtros, ordenação, paginação, voltar/avançar/
  recarregar; menu desktop e mobile de 320 a 1440 px sem rolagem lateral; axe limpo na coleção, no
  menu mobile e no formulário; PAUSED/SCHEDULED/vencida/ENDED/vazia → 404 e fora do menu; concorrente
  parcial; SELECTED_CATEGORIES e ALL_PRODUCTS; carrinho R$ 42,21 → 4x e R$ 600 → 12x iguais à PDP e ao
  checkout.

## 6. Produção — situação encontrada (somente leitura, 2026-11-17)

- **Categoria "SALE"** (slug `sale-black`, id `cmwkybymf000l01pgu05roikj`): ativa, criada em
  2026-11-17 17:13 UTC, **0 produtos**, fora do menu (o menu omite categorias vazias), `noindex`.
- **Promoção "SALE BLACK"**: não existe.
- Promoções ativas: três "BLACK FRIDAY SALE" (10%, 15%, 30%), todas SELECTED_PRODUCTS, sem datas, sem
  destaque na home, 24 produtos no total, **sem sobreposição** entre elas.
- Produtos movidos para a categoria SALE: nenhum (`ORIGINAL_CATEGORY` não se aplica). O log de auditoria
  não registra trocas de categoria de produto.

## 7. Rollout (depois de aprovado)

1. Merge + deploy normal (a migration aditiva roda no deploy; promoções existentes ficam com a coleção
   desligada — nada muda na loja até alguém ligar).
2. No Admin: Promoções → abrir/criar a promoção → selecionar produtos → **Exibir esta promoção como
   coleção** → nome no menu → ativar. Sem tocar na categoria dos produtos.
3. Decisão do operador para a SALE BLACK com as três Black Friday atuais (10/15/30%): uma coleção é
   **uma** promoção. Para uma única entrada "SALE BLACK" com todos os 24 produtos, ou se liga a coleção
   em uma promoção que vença todos esses produtos, ou se aceita até três entradas com nomes distintos
   (o Admin não permite dois nomes iguais).
4. Categoria `SALE` (`sale-black`): **DEACTIVATE recomendado** (está vazia; evita confusão com a coleção e
   uma futura entrada duplicada no menu se alguém mover produtos para ela). Não alterada neste ciclo.

## 8. Rollback

Preferido: desligar "Exibir esta promoção como coleção" (some do menu e a rota dá 404 na hora). Depois,
se preciso, reverter o código. **Não** dropar as colunas em produção como rollback emergencial — elas
têm default e não afetam nada com a coleção desligada.
