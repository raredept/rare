# RARE-UIUX-AUDIT-01 — Achados do operador

Base: `main@2adec1a` (produção `https://raredept.com.br`). Lote 01 recebido em 2026-11-17.
Somente os achados enviados pelo operador estão aqui. Nada foi implementado neste ciclo.

```text
OPERATOR_FINDINGS_RECEIVED=7
OPERATOR_FINDINGS_REPRODUCED=7
```

Evidências ficam fora do Git, em `output/uiux-audit-01/` (índice em [SCREENSHOT_GALLERY.md](./SCREENSHOT_GALLERY.md)).
O detalhamento técnico e a correção proposta de cada item estão no [UIUX_BACKLOG.md](./UIUX_BACKLOG.md).

| ID | Tela | Descrição (operador) | Evidência | Impacto | Prioridade | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UIUX-NAV-001 | Header + catálogo | Segunda linha do header concentrada à esquerda com área vazia; catálogo repete as mesmas categorias | `gallery/storefront/desktop/chromium-1440-categoria-camisetas-full.png`, `layout-probe.json` | Redundância e hierarquia confusa no ponto de entrada da navegação | P1 | REPRODUZIDO |
| UIUX-CATALOG-001 | Catálogo / categorias / busca | Sem filtros nem ordenação | `gallery/storefront/*/chromium-*-categoria-tudo*.png` | Fricção crescente com o catálogo; conversão | P1 | REPRODUZIDO |
| UIUX-BRANDS-001 | Home | Faixa de marcas parada; nomes "hardcoded" | `brands-marquee.json` | Percepção de site quebrado; marcas não levam a lugar nenhum | P2 | REPRODUZIDO (causa encontrada) |
| UIUX-ORDERS-001 | `/minha-conta/pedidos` e `/[id]` | Pedidos parecem tabela administrativa; sem foto do item | `lab/account/*.png`, produção (Chrome do operador) | Cliente não reconhece a compra visualmente | P1 | REPRODUZIDO |
| UIUX-CHECKOUT-001 | `/finalizar-compra` | 12 opções de parcelamento empilhadas ocupam a coluna inteira | `lab/checkout/checkout-cartao-12x-*.png`, `lab/metrics.json` | Resumo e CTA empurrados para baixo; leitura do valor final prejudicada | P1 | REPRODUZIDO |
| UIUX-PDP-001 | `/produto/[slug]` | Área vazia entre o bloco comercial e "Detalhes do produto" | `gallery/product/desktop/chromium-1440-pdp-vazio-full.png` | Página parece incompleta; descrição longe da decisão de compra | P1 | REPRODUZIDO |
| UIUX-SUPPORT-001 | `/suporte` (pós-envio) | Estado "Mensagem recebida" básico demais | `lab/storefront/suporte-recebido-*.png` | Confiança/atendimento abaixo do padrão premium | P2 | REPRODUZIDO |

## O que a reprodução confirmou — e o que corrige a premissa

### UIUX-NAV-001
- Confirmado em produção (1024–1920 px): a barra do header usa **863 px fixos** (8 itens). Sobram 129 px à direita em 1024, **537 px em 1440** e 777 px em 1920 (contando a margem do container de 1440).
- O catálogo repete **8 atalhos**, 7 deles idênticos ao header ("Tudo", "Destaques", "Camisetas", "Jaquetas", "Conjuntos", "Bermudas", "Calças"; "Acessórios" vira link simples). O cabeçalho do catálogo ocupa 285 px antes do primeiro produto.
- **Correção da premissa:** no mobile e no tablet (< 1024 px) a barra do header **não existe** (fica no menu ☰). Nessas larguras a linha de atalhos do catálogo é a única navegação rápida entre categorias. Remover essa linha exige uma alternativa no mobile (seletor de categoria dentro do painel de filtros ou a própria barra do header rolável abaixo de 1024 px).
- Extra (causa técnica): o botão "Acessórios ▾" aparece com peso de fonte diferente dos outros itens — ver UIUX-GLOBAL-001.

### UIUX-CATALOG-001
- Confirmado: nenhum controle de filtro ou ordenação (`select`/botão) nas páginas de categoria e busca.
- Existe filtro por marca **só pela URL** (`/categoria/tudo?brand=Corteiz`), sem interface. A contagem mostra "24 produtos nesta página · Página 1", não o total.
- Dados reais disponíveis para filtros (sem inventar atributo): **marca** (`Product.brand`, 18 marcas publicadas), **categoria/subcategoria**, **tamanho** (`ProductVariant.size`, texto livre — precisa normalizar P/M/G/GG/Único), **preço**, **disponibilidade** (estoque − reserva), **promoção** (`PromotionProduct`/categoria). **Não existe cor** nem outro atributo.
- Ordenações calculáveis no servidor hoje: Destaques (`featuredSortOrder`), Mais recentes (`createdAt`), Menor/Maior preço **base** (`priceInCents`). Menor/Maior preço **final** e Maior desconto dependem do motor de promoções (calculado na aplicação): com ~95 produtos dá para ordenar na aplicação depois de calcular o preço final, mas isso precisa ser decidido no REFINE.

### UIUX-BRANDS-001
- **Correção da premissa:** a lista **não é hardcoded**. Já vem do catálogo (`getAvailableBrandsForStore`): marcas de produtos ativos com variação ativa e estoque disponível, deduplicadas sem diferenciar maiúsculas. O "modo automático" pedido já existe.
- **Causa de parecer parada (provada em produção):** o carrossel do hero e a faixa compartilham a mesma preferência de movimento. Um único clique na seta ou num indicador do hero grava `rare:home-motion-paused=true` no `localStorage`; a faixa para (deslocamento 0 px em 2 s) e **continua parada em todas as visitas seguintes** daquele navegador. O único botão "Retomar animações" fica no bloco "Drop RARE", bem abaixo. Visitante novo: a faixa anda (−131 px em 2 s). Com `prefers-reduced-motion` ela fica parada de propósito (correto).
- Extras: as marcas **não são clicáveis** (0 links), embora o filtro `?brand=` exista; a grafia "Trasher" vem do cadastro do produto (dado, não código).

### UIUX-ORDERS-001
- Produção (pedido real `RARE-20261117-XQQJL7`, Chrome do operador): lista e detalhe com **0 imagens**; status só em texto; a linha "Pagamento: Cartão" não mostra o parcelamento na lista.
- Lab (pedidos de 1, 2, 5, 10 e 20 itens): 0 imagens em todos; o pedido de 20 itens tem 5.607 px de altura no celular (390 px). No celular a lista vira blocos sem rótulo ("20" sem dizer que são itens) e a forma de pagamento aparece **depois** do botão "Ver".
- Os dados para a correção já existem: `OrderItem.imageUrlSnapshot` e `skuSnapshot` (gravados desde o PR #4). O Admin já mostra foto e SKU no mesmo pedido.

### UIUX-CHECKOUT-001
- Lab, pedido de R$ 600,00 com 12 opções: o bloco "Parcelamento no cartão" mede **852 px** em 390 px e em 1440 px (a tela do celular tem 844 px). No desktop a página cresce de 1.842 px (Pix) para 2.686 px (cartão).
- A lista aparece **depois** do Total e da forma de pagamento; o botão "Finalizar compra" fica ~1.870 px abaixo do topo no desktop.
- Os radios de 4x a 12x ficam menores que os de 1x a 3x (o texto quebra em duas linhas e o `input` encolhe) — UIUX-CHECKOUT-006.

### UIUX-PDP-001
- Produção, 1440 px (Camiseta Corteiz): galeria + miniaturas terminam em ~1.265 px; o bloco comercial (fixo ao rolar) termina em ~1.450 px; "Detalhes do produto" só começa em **1.502 px**, depois do fim do grid, numa coluna de texto estreita que deixa a direita vazia. O lado vazio troca conforme o número/proporção das fotos.
- No celular (390 px) o título aparece em y≈803 e o botão "Adicionar ao carrinho" em y≈1.192 — fora da primeira tela (UIUX-PDP-003).

### UIUX-SUPPORT-001
- Lab (e-mail desligado), 390 e 1440 px: o estado pós-envio é um cartão dentro de outro cartão com "MENSAGEM RECEBIDA", "Recebemos sua solicitação.", protocolo no meio da frase e **um único botão** ("Voltar para a loja"). O texto de introdução do formulário continua acima. Não há como copiar o protocolo nem atalho para pedidos.
- Canais: "Prefere conversar?" só mostra WhatsApp quando o número está configurado (no lab só Instagram).
- Não há SLA operacional documentado; a proposta não promete prazo.
