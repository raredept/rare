# 03 — SALE BLACK FRIDAY

## Como entra

Não há texto nem banner fixo no código. A campanha é um registro da Central de Promoções:

```
npm run promotions:seed-black-friday                                   # dev/staging
CONFIRM_PRODUCTION_SEED=true npm run promotions:seed-black-friday       # produção
```

O seed cria **uma vez** (idempotente pelo código `black-friday-<ano>`) uma promoção **DRAFT** com nome/título "SALE BLACK FRIDAY", selo "Black Friday", CTA "Ver ofertas" → `/categoria/tudo`, `homepageFeatured=true`, **sem desconto, sem produtos e sem datas**. Registro no audit log. A loja não muda até um Admin preencher valor, alvos e período, conferir o preview e ativar.

Nenhum percentual, "ATÉ 70% OFF", "12x" etc. foi inventado.

## Home

`src/app/(store)/page.tsx` (dinâmica) chama `getHomepageCampaign()`: promoção ACTIVE (status + janela de datas no instante) com `homepageFeatured=true`, maior prioridade. Renderiza `HomeCampaign`:

- selo, título (`h2`, a home mantém seu `h1`), subtítulo, oferta derivada do valor real ("25% OFF nos produtos participantes"), CTA;
- até 4 produtos cuja promoção vencedora **é** esta campanha (disponíveis antes, esgotados no fim);
- banner opcional com `<picture>` (fonte mobile separada), `alt` obrigatório, sem vídeo;
- contagem regressiva só quando há `endsAt`.

## Countdown

Deriva de `endsAt` real (ISO do servidor). Nunca reinicia; ao zerar mostra "Campanha encerrada" e recarrega a página — o servidor já não trata a campanha como ativa. Leitores de tela recebem a data de término (sem anúncio por segundo); `role="timer"`, `aria-live="off"`. SSR mostra "--" (sem números falsos, sem hydration mismatch).

## Produto em promoção / esgotado

`PriceTag`: preço original riscado + preço atual + `-N%` em texto; rótulo `sr-only` completo ("Preço original…, preço promocional…, economia de N%"). Desconto nunca só por cor. Esgotado continua visível, com selo, não comprável e no fim da lista — promoção não altera estoque.

## Preview

`/admin/promotions/[id]/preview` (protegido por MFA) renderiza a mesma `HomeCampaign` em molduras desktop e mobile (container queries), com os preços que a promoção **teria**; não publica nada e funciona com a promoção em DRAFT.

## Pendências (não executáveis daqui)

| Item | Estado |
|---|---|
| Conferência visual em 320–1920 px, teclado, contraste, leitor de tela | **MANUAL** — sem staging publicado neste ciclo (ver 12_STAGING) |
| Definir desconto, produtos/categorias, período, banner | **BUSINESS DECISION** |
| Medir CLS/LCP com banner real | **MANUAL** (depende da imagem escolhida) |
