# RARE-PRODUCT-CATALOG-ORDER-01 — ordem manual dos produtos

Branch `fix/rare-product-catalog-order-01`, base `main` 80c99e5. Sem migration, sem push/merge/deploy neste ciclo.

## Relato do seller

"A ordem dos produtos fica bugada quando eu altero": ele define a posição de uma peça no Admin e ela não vai para o lugar certo.

## Causa (reproduzida em PostgreSQL descartável)

- O catálogo ordenava por `featured desc, sortOrder asc, createdAt desc` e mostra disponíveis antes de esgotadas.
- O campo "Ordem no catálogo" (`sortOrder`) era um **peso**, não uma posição. Todas as peças tinham 0 por padrão, então colocar 2 mandava a peça para **depois de todas as peças com 0** — ou seja, para o fim da lista.
- Peças em **destaque** sempre vinham antes no catálogo geral, qualquer que fosse o número.
- "Ordem nos destaques" (`featuredSortOrder`) só vale para a home e `/categoria/destaques`, o que confundia ainda mais.

### Explicação curta para o seller

> O campo antigo não era "posição", era um peso: todas as peças estavam com 0, então quando você colocava 2 a peça ia para depois de todas as outras. Além disso, peças em destaque furavam a fila. Agora o campo virou **Posição no catálogo**: 1 é a primeira peça da loja, 2 a segunda, e assim por diante — as outras andam uma casa. Na lista de Produtos do Admin também tem ↑ e ↓ para subir ou descer uma peça. Destaque continua valendo só para a home e "Destaques"; peças esgotadas continuam aparecendo depois das disponíveis.

## Decisão do operador (2026-11-18)

- Abordagem: **posição real + setas ↑/↓ na lista** do Admin.
- Destaques: **não furam mais a fila** no catálogo geral; a posição manual manda. Home e `/categoria/destaques` seguem com a própria ordem.

## O que mudou

- `src/lib/product-catalog-order.ts` (novo): uma única lista com todos os produtos (ativos e ocultos), ordem canônica `sortOrder asc, createdAt desc, id asc`. Mover = `pg_advisory_xact_lock` + ler a lista + reinserir a peça + regravar posições 1..N só nas linhas que mudam, via SQL (não mexe em `updatedAt`, que alimenta o desempate dos destaques, sitemap e feed do Merchant).
- Formulário do produto: "Posição no catálogo" (1 = primeira; padrão 1 para peça nova, como antes — a mais nova no topo). Mostra "Hoje é a Xª de N peças". Só reordena quando o número mostrado foi alterado (campo oculto com a posição original), então salvar outro campo nunca move a peça.
- Lista de Produtos do Admin: badge "Posição N" e botões ↑/↓ (44 px, rótulo acessível). Funcionam com filtros e atravessam a borda da página (a consulta traz a linha anterior e a seguinte da página). Ao mover, volta para a mesma página/filtro.
- Vitrine: `productOrderBy` = `sortOrder asc, createdAt desc` (sem `featured desc`). Disponíveis antes de esgotadas: mantido.
- RBAC: as duas ações exigem `commerce.products`.
- Audit log: `product.catalog_position_changed` (entidade `Product`) com posição antes/depois, total e origem (`form` ou `arrow`).

## Primeiro uso em produção

Nada muda no banco no deploy. Hoje todas as peças têm 0, então a ordem inicial é "mais nova primeiro" (como já era fora dos destaques). O primeiro movimento renumera a lista inteira 1..N. **Efeito visível no deploy:** as peças em destaque deixam de aparecer sempre no topo do catálogo geral.

## Provas

- Unitários: `src/lib/product-catalog-order.test.ts`, `products/actions.test.ts` (posição pelo formulário, setas, RBAC, audit, entradas inválidas), `admin-products-data.test.ts` (linhas vizinhas da página), `product-form.test.ts`, `admin-catalog-pages.test.ts`.
- PostgreSQL descartável: `QA_DATABASE_URL=postgresql://…@localhost:…/postgres npx tsx scripts/qa-product-catalog-order.ts` — 8 provas (posição 2 vira 2ª, renumeração 1..N, `updatedAt` intacto, destaques intactos, esgotada no fim/oculta fora da loja, setas, 20 movimentos concorrentes sem buracos/duplicatas, paginação).
- Lab (build de produção, navegador real): `tests/e2e/product-catalog-order.spec.ts` via `QA_LAB_EXTRA_SPECS=tests/e2e/product-catalog-order.spec.ts npx tsx scripts/qa-staging-lab.ts --https --only=product-catalog-order`.

## Resultados (2026-11-18, local)

- `npm test`: 212 arquivos, 2471 testes passaram, 0 falhas. `tsc --noEmit` limpo; ESLint limpo nos arquivos tocados.
- `scripts/qa-product-catalog-order.ts`: PASS, 8/8 provas.
- Lab `--https` (Chromium, build de produção `APP_ENV=staging`, seller com SELLER_ADMIN + MFA): 6/6 passaram; varredura de log sem vazamentos; integridade de dados sem anomalias.
- Não testado: WebKit/Firefox, staging e produção.
