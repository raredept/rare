# 02 — Central de Promoções

## Modelo (`Promotion`, migration `20261106130000_promotions`)

`id, name, slug (código interno, único), status, type, value, scope, startsAt, endsAt, priority, homepageFeatured, badgeText, headline, subheadline, ctaLabel, ctaHref, bannerImageUrl, bannerMobileImageUrl, bannerAlt, createdAt, updatedAt, createdById, updatedById` + `PromotionProduct` / `PromotionCategory`.

- Status: `DRAFT, SCHEDULED, ACTIVE, PAUSED, ENDED`. Tipos: `PERCENTAGE` (inteiro 1–100), `FIXED_AMOUNT` (centavos). Escopos: `ALL_PRODUCTS, SELECTED_PRODUCTS, SELECTED_CATEGORIES` (categoria cobre também subcategoria).
- Nenhum tipo extra foi adicionado.
- Sem exclusão física: "Encerrar" (ENDED) é terminal; encerrada não se edita — usa-se "Duplicar".

## Regras de preço (servidor)

`produto → preço base → promoções ativas agora que miram o produto → prioridade → preço final`.

- Desconto que deixaria o preço abaixo de R$ 1,00 **não se aplica** àquele produto (nunca é "ajustado" para outro valor). 100% portanto nunca vale; o preview mostra "preço baixo demais".
- Percentual exibido = `floor(desconto*100/base)`, calculado; nunca digitado.
- Snapshot no `OrderItem`: `basePriceInCents, promotionId, promotionName, promotionCode, promotionDiscountInCents, unitPriceInCents`; `Order.promotionDiscountInCents`. Pedido antigo continua legível se a promoção mudar ou sumir.
- Falha ao carregar promoções na vitrine → exibe preço de catálogo (nunca cobra a mais: o checkout relê as regras e, se falhar, não cria pedido).

## Stacking

- Uma promoção automática por item; desempate determinístico `priority DESC, desconto DESC, createdAt ASC, id`.
- Cupom `RARE10` (1ª compra, 10%): **somente sobre itens sem promoção**. Código inválido continua dando erro; código válido sem item elegível simplesmente não desconta.
- Coberto em `engine.test.ts`, `checkout-session.test.ts`.

## Validação (allowlist — `promotions/validation.ts`)

Bloqueia: desconto ≤ 0 ou negativo, % > 100 ou não inteiro, fixo acima do teto, fim ≤ início, fim já passado (ao ativar/editar ativa), escopo sem alvo (ao ativar), produto/categoria inexistente (consulta ao banco), CTA fora da loja (`resolveSafeInternalPath`), banner que não seja caminho interno ou `https`, banner sem `alt`, destaque na home sem título. Textos comerciais: sem `<`, `>` e caracteres de controle, tamanho limitado; renderizados como texto pelo React (sem HTML). Campos internos (`status`, ids, `createdBy`, auditoria) nunca vêm do formulário.

## Ações e transições

| Ação | De | Para |
|---|---|---|
| Ativar | DRAFT, PAUSED, SCHEDULED | SCHEDULED se `startsAt` futuro, senão ACTIVE (exige config completa) |
| Pausar | ACTIVE, SCHEDULED | PAUSED |
| Encerrar | qualquer não encerrada | ENDED |
| Duplicar | qualquer | nova DRAFT sem datas e sem destaque |

Transições usam `updateMany` condicionado ao status lido (concorrência vira no-op + erro amigável). Todas exigem `requireAdmin()` (MFA).

## Audit log (`AdminAuditLog`)

`promotion.created/updated/activated/paused/ended/duplicated` com quem, quando, promotionId, `before`/`after` (só campos de negócio: nome, código, status, tipo, valor, escopo, datas, prioridade, destaque, ids de alvo). Sanitizador descarta chaves com cara de segredo/PII.

## Feature flags

`PROMOTIONS_ENABLED=false` remove preços promocionais em catálogo, carrinho e checkout. `BLACK_FRIDAY_HOME_ENABLED=false` esconde só a campanha da home.

## Achado deste ciclo

Nenhum defeito novo nas promoções. Observação (Low, aceita): uma edição concorrente com "Encerrar" pode gravar campos numa promoção recém-encerrada (o status não muda; preços não são afetados porque ENDED nunca aplica).
