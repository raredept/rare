# RARE-UIUX-REFINE-01 — Implementação dos 9 itens P1 aprovados

```text
BASE_SHA=41fb8dd (audit/rare-uiux-01, sobre main@2adec1a)
BRANCH=refine/rare-uiux-01 (local, sem push)
APPROVED=todos os P1 (operador, 2026-11-17)
PRODUCTION_CHANGED=NO · PRODUCTION_DEPLOYED=NO · MIGRATIONS=0
FINANCIAL_LOGIC_CHANGED=NO (cálculo, taxas, installmentCount, snapshot, total, Asaas, webhook,
  estoque, reservas, cupons, frete, RBAC, SEO: nenhum arquivo tocado)
```

## Resultado por item

| ID | Status | O que mudou | Prova |
| --- | --- | --- | --- |
| UIUX-NAV-001 | DONE | Barra do header centralizada no grid (≥ 1024 px); "Acessórios ▾" com o mesmo peso/tamanho dos links; atalhos do catálogo só abaixo de 1024 px (onde o header não tem barra) | `uiux-refine-lab.spec.ts` (sobras esquerda/direita e fonte medidas); `category/[slug]/page.test.ts` |
| UIUX-CATALOG-001 | DONE (fase 1) | Toolbar "N produtos · Filtrar · Ordenar"; painel lateral (≥ 640 px) / bottom sheet (celular) com Marca, Tamanho disponível, Preço, Disponível agora, Em promoção; ordenação Destaques / Mais recentes / Menor preço / Maior preço; chips removíveis; estado na URL; total real; busca com atalho "Filtrar e ordenar" | `catalog-refinements.test.ts`, `storefront-catalog.test.ts`, `page.test.ts`, lab |
| UIUX-ORDERS-001 | DONE | Lista em cards com até 3 miniaturas (+N), status com ícone + texto, data, "N itens", "Cartão · 8x"/"Pix", total e "Ver pedido"; detalhe com foto, tamanho, quantidade, preço e "Ref." (SKU gravado no pedido) | `customer-order-parts.test.ts`, lab (pedidos de 1/2/5/10/20 itens) |
| UIUX-CHECKOUT-001 | DONE | Seletor compacto: uma linha com o plano escolhido (e o total no cartão quando há acréscimo) + "Alterar"; abre os mesmos radios em caixa com rolagem própria, agrupados "Sem juros" / "Com acréscimo" | `card-installments.spec.ts` 4/4 no lab, `card-installments-ui.test.ts`, lab (altura medida) |
| UIUX-PDP-001 | DONE | "Detalhes do produto" saiu da linha própria do grid e foi para a coluna direita, logo abaixo do bloco de compra (antes de frete e confiança); coluna deixou de ser `sticky` (nunca engatava) | lab 1024/1440 (posição medida), `product-detail-client.test.ts` |
| UIUX-ADMIN-PROMO-001 | DONE (UI) | Boundary do Admin reconhece ação desatualizada: "Esta tela foi atualizada enquanto estava aberta" + "Recarregar página" (sem reenvio); erro genérico diz "Não foi possível concluir esta ação" e mostra o código (digest). Lógica de promoções intacta | lab (promoção salva + tela da ação desatualizada) |
| UIUX-PDP-002 | DONE | "ou até Nx no cartão" com o N real que o preço da peça permite sozinho (mesmo cálculo do checkout); sem "no cartão" quando só cabe sem juros | `card-installments-ui.test.ts`; `tests/uiux-audit/pdp-installments-after.ts` nos 75 preços reais: 0 promessas impossíveis, só os 7 produtos do achado mudam |
| UIUX-HOME-001 | DONE (sem migration) | Banner com imagem e **sem título** = "arte manda": o site não desenha scrim, eyebrow nem subtítulo por cima (ficam para leitor de tela); indicadores saíram de cima da arte para uma faixa abaixo dela; orientação no formulário de banners do Admin | `home-hero-carousel.test.ts`, lab 390/1440 |
| UIUX-CHECKOUT-002 | DONE | Só a pausa real vira "checkout pausado"; a falha genérica vira "Não conseguimos iniciar o pagamento agora. Seu carrinho foi mantido — tente de novo em alguns instantes." | `checkout-messages.test.ts` (inclusive conferindo o texto exato da rota) |

## Decisões tomadas (sem inventar regra)

- **Preço do filtro e da ordenação = preço final da peça agora** (`pricing.finalPriceInCents`, promoção
  automática já aplicada pelo motor de promoções, que só é lido). Cupom e frete não entram. Está escrito no
  próprio painel.
- **Esgotados continuam depois dos disponíveis** em qualquer ordenação (regra que já existia).
- **"Maior desconto" não foi incluído**: o desconto por peça existe, mas ordenar por ele não foi pedido
  na fase 1; fica para quando o operador quiser.
- **Filtros de seleção única** por grupo (fase 1). Opções e contagens vêm só do escopo atual (categoria /
  busca); cada número já considera os outros filtros ativos.
- **Leitura do catálogo:** a página agora lê o escopo inteiro uma vez (dezenas de produtos) para ter
  opções, total e ordenação do mesmo conjunto; a paginação (24) acontece depois, na aplicação. Com
  milhares de produtos isso precisaria voltar para o banco.
- **Catálogo filtrado ou ordenado** em "Tudo"/"Acessórios" vira uma lista única paginada (seções
  esconderiam a ordem escolhida). Sem filtro, as seções continuam iguais.
- **SEO intocado:** metadata e canonical continuam lendo a página sem filtro (canonical sem parâmetros).
  Indexação de URLs filtradas fica para o ciclo de SEO.
- **HOME-001 sem migration:** a regra usa o campo que já existe (título vazio). Foto do celular cortando o
  "COMPRAR AGORA" desenhado na arte é conteúdo (recorte mobile do banner), não código.
- **SKU para o cliente:** só o gravado no pedido ("Ref."). O SKU atual do catálogo não aparece para pedidos
  antigos — para o cliente seria um palpite.
- **Fonte dos botões novos:** a regra global `font: inherit` (UIUX-GLOBAL-001, P2, não aprovado) continua; os
  componentes novos põem tamanho/peso no contêiner para não depender dela.

## Regressão

```text
typecheck=PASS  lint=PASS  vitest=200 arquivos / 2233 testes PASS (3 skipped, como antes)
lab (build de produção com APP_ENV=staging, banco descartável, Asaas falso, e-mail desligado):
  card-installments.spec.ts 4/4 PASS  ·  order-item-sku.spec.ts 8/8 PASS
  uiux-refine-lab.spec.ts 3/3 PASS
  uiux-audit-lab.spec.ts 6/6 PASS na rodada com o código final do Admin e do checkout;
    na última rodada (após o ajuste de largura dos pedidos) 4 PASS, 1 timeout no helper de medição
    das telas do Admin (mesmo travamento intermitente em redirect visto na auditoria), 1 não executado
```

O spec `card-installments.spec.ts` mudou só a interação (abrir o seletor antes de ler as opções); todas as
asserções de valores são as mesmas.

## Evidências AFTER (antes → depois)

Prints em `output/uiux-refine-01/` (99 capturas; fora do Git, como no ciclo da auditoria). Métricas em
`output/uiux-refine-01/lab/metrics.json` e `refine-metrics.json`.

| Item | Antes | Depois |
| --- | --- | --- |
| CHECKOUT-001 | lista de parcelas com 852 px (390 e 1440); página do cartão 4.530 px (390) / 2.686 px (1440) | seletor fechado com 48 px, aberto 352 px com rolagem própria; página 3.754 px (390) / 1.910 px (1440); "Finalizar compra" em 1.154 px no desktop; escolher 8x fecha a lista e mostra "8x de R$ 85,50 com acréscimo · Total no cartão R$ 684,00" |
| ORDERS-001 | 0 imagens na lista e no detalhe | lista com miniaturas (15 imagens para 5 pedidos de teste) e status com ícone; detalhe com 1/2/5/10/20 fotos; pedido de 20 itens no celular 5.607 → 4.879 px |
| PDP-001 | "Detalhes do produto" começava em 1.502 px (1440) | começa em 850 px (1440) e 852 px (1024), na coluna da direita |
| PDP-002 | item de R$ 30 anunciava "até 12x" com checkout 1x–3x | "ou em até 3x sem juros"; nos 75 preços reais, 0 promessas impossíveis |
| ADMIN-PROMO-001 | "Falha temporária / Não foi possível carregar esta área." | "Tela desatualizada / Esta tela foi atualizada enquanto estava aberta." + "Recarregar página"; edição normal continua salvando |
| HOME-001 | eyebrow e subtítulo do site sobre a arte; indicadores sobre o falso botão | nenhum texto visível sobre a arte; indicadores começam exatamente onde a arte termina (390 e 1440) |
| NAV-001 | barra com 537 px vazios à direita (1440); "Acessórios" 400/16px | 331 px de cada lado; "Acessórios" 700/14px como os links; atalhos do catálogo só abaixo de 1024 px |
| CATALOG-001 | sem filtro/ordenação; "24 produtos nesta página" | "10 produtos" (total real); filtro BAPE → 3; "Menor preço" ordena R$ 42,21 → 72,00 → 180,00; painel lateral no desktop e bottom sheet de 717 px no celular, Esc fecha, sem rolagem horizontal |

## P2 e P3 (aprovados depois dos P1)

O operador aprovou também os 26 itens P2/P3. Mesma regra: só apresentação; nenhum cálculo, Asaas,
webhook, estoque, cupom, frete, RBAC, SEO ou migration. Resultado:

| ID | Status | O que mudou |
| --- | --- | --- |
| GLOBAL-001 | DONE | Regra `font: inherit` saiu de fora das camadas (o preflight do Tailwind já herda a fonte em `@layer base`); botões renderizam o peso/tamanho desenhado ("Adicionar ao carrinho" 900/14px, "Acessórios" 700/14px). Campos de texto continuam com 16 px abaixo de 768 px (sem zoom do iOS). |
| A11Y-002 | DONE | `scroll-padding-top` 9,5rem / 11rem (≥ 1024): o foco volta abaixo do header (medido: header termina em 158 px, foco em 523 px). |
| TYPE-001 | DONE | Textos informativos de 10 px (categoria e disponibilidade do card, selo de desconto, subtotal da gaveta, menu, contador) passaram a 11 px; decorativos ficaram. |
| A11Y-003 | DONE | "Mostrar senha" 44×44; "Ver acessórios", "Ver política de envio" com 44 px de altura; breadcrumbs e "Troca e devolução" com 24 px (mínimo AA). |
| A11Y-001 | DONE | Tabelas da Política de Cookies em região rolável com foco por teclado (`tabIndex=0`, `role="region"`, rótulo). |
| COOKIES-001 | DONE | Painel mostra finalidade e duração em linguagem simples; nomes técnicos em "Ver detalhes técnicos"; cookies do painel da equipe só na Política (marcados "Só no painel da equipe da loja"). Lógica de consentimento intacta. Revisão jurídica do texto continua recomendada. |
| COOKIES-002 | DONE | Banner com texto de uma frase, "Aceitar" e "Recusar não essenciais" lado a lado (mesmo peso), "Configurar" como link: 24% da tela em 390 px (antes ~45%). |
| 404-001 | DONE | URL inexistente: rota própria `(store-missing)` sem `loading.tsx`, dentro da moldura da loja (header, busca, rodapé), status 404 e `noindex`. Produto/categoria inexistentes: o `proxy.ts` continua respondendo o 404 real (contrato e testes mantidos), agora com cabeçalho preto, logo, busca, links e rodapé. |
| PERF-001 | PARTIAL | Os estados vazios continuam dentro de `main` com `flex-1` (rodapé não sobe). Placeholder com cor dominante depende das variantes de imagem (IMG-001). |
| BRANDS-001 | DONE | Clique nas setas do hero pausa só o hero (em memória). A faixa obedece só a movimento reduzido, aba oculta, o controle explícito "Pausar animações" e hover/foco nela. Chave nova `rare:home-motion-paused:v2` zera a pausa gravada pelo bug. Cada marca abre `/categoria/tudo?brand=…`. |
| SUPPORT-001 | DONE | Confirmação no mesmo cartão (sem cartão dentro de cartão), protocolo em destaque com "Copiar" (feedback "Copiado"), "A resposta será enviada para o e-mail informado" (sem prazo), "Ver meus pedidos" (logado) e "Voltar para a loja"; atalhos de assunto antes do formulário. |
| ACCOUNT-001 | DONE | Abas da conta em grade 2×2 no celular. |
| ORDERS-002 | DONE | Cabeçalho com status, data/hora do pedido e do pagamento, forma de pagamento; blocos Valores · Pagamento · Entrega; cartão de itens não estica; link para o produto (se ativo); "Continuar pagamento" pelo mesmo aviso/prazo do checkout quando aguardando pagamento. |
| ORDERS-003 | DONE | Itens ordenados por criação (cliente e Admin). |
| FORMS-001 | DONE (sem busca por CEP) | `autocomplete` em todos os campos, ordem CEP → rua → número → complemento → bairro → cidade/UF → destinatário/telefone, `store-input`, lista salva primeiro e "Adicionar endereço" recolhido, texto atualizado, telefone `type=tel`. A busca do endereço pelo CEP **não** foi feita: exige um serviço externo (envio do CEP a terceiro + CSP), decisão do operador. |
| CHECKOUT-003 | DONE | Respostas não-JSON (502 HTML) e falhas de rede nunca mostram texto do parser/navegador. |
| CHECKOUT-004 | PARTIAL | Cada falha conhecida virou mensagem com próximo passo (sessão expirada com link "Entrar", tamanho indisponível, estoque, frete com WhatsApp, checkout em andamento). **Não feito:** citar o nome do produto na mensagem — exige o servidor de checkout devolver código + variante (mudança de contrato na rota de checkout, fora do escopo de UI). |
| CHECKOUT-005 | DONE | Passos 1 Contato · 2 Entrega · 3 Pagamento na coluna principal; resumo à direita só com valores, total e botão. Aviso de reserva alinhado ao container. Mesmos estados e condições. |
| CHECKOUT-006 | DONE | Resolvido pelo seletor de parcelas do CHECKOUT-001 (`shrink-0`). |
| PDP-003 | DONE | Miniaturas numa linha rolável no celular; barra fixa com nome, tamanho, preço e "Adicionar" enquanto o botão principal está fora da tela (só com checkout aberto e tamanho disponível). |
| CATALOG-002 | DONE | Total real no catálogo e na busca (feito com o CATALOG-001). |
| IMG-001 | PARTIAL | `sizes` das miniaturas corrigido (tablet deixa de ampliar a variante de ~95 px). O **backfill de variantes** (`media:variants:backfill`) escreve no storage/banco de produção e **não foi executado**: precisa de autorização operacional. |
| ADMIN-001 | DONE | Acentos (Notificações, Método, Endereço, Instruções, Frete grátis…), "Método: Cartão/Pix", cobrança de parcelamento identificada, histórico da promoção em português, opções de frete com a de produção primeiro e as de homologação em "Avançado / homologação" (mesmos valores). |
| ADMIN-002 | DONE | "Alterações não salvas nesta seção" ao lado de cada botão, aviso do navegador ao sair, confirmação com resumo antes de salvar o parcelamento; o botão da loja diz que salva só a seção. Validação intacta. |
| ADMIN-003 | DONE (texto) | Rótulo "Checklist de lançamento com pendências" (em vez de "bloqueado para venda aberta") e nota de que o painel confere configuração/evidências, não o status de vendas. Registrar as evidências pendentes é processo do operador. |
| ADMIN-004 | DONE | Formulário de produto com barra fixa "Salvar produto" abaixo de 1280 px; lista de produtos em duas colunas no celular, linhas secundárias só na tabela larga. |

Provas: `src/components/store/uiux-refine-p2.test.ts`, `src/lib/checkout-messages.test.ts`, `src/proxy.test.ts`;
lab `uiux-refine-lab.spec.ts` 5/5 (404 com status, banner 24%, fonte dos botões, barra de compra presa na tela,
foco abaixo do header); `prelaunch-consent-analytics.spec.ts` 5/5 (com `--https`, que a rota de análise exige em
build de produção); `support.spec.ts` 7/7.

## Não feito / limites

- Nada foi enviado para produção; nenhum push; nenhum merge.
- WebKit/Firefox não rodaram neste ciclo (lab em Chromium, como os specs financeiros).
- O erro real de backend da promoção continua sem prova (sem logs de produção nesta máquina).
- Polimento não feito: na lista de pedidos, o texto começa em posições diferentes conforme o número de
  miniaturas (1, 2 ou 3+). Funcional, mas pode ganhar uma coluna de largura fixa.
- Encontrado e corrigido durante a prova: a primeira versão da lista de pedidos estourava a largura no
  desktop (linha de nomes sem quebra dentro de um grid); trocada por lista em bloco e reconferida.
