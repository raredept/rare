# RARE-UIUX-AUDIT-01 — Galeria de evidências (BEFORE)

As capturas **não são versionadas** (225 MB; `output/` está no `.gitignore`, como nos ciclos
anteriores). Ficam neste worktree em `output/uiux-audit-01/`. Para navegar:

- abrir `output/uiux-audit-01/index.html` no navegador (gerado por `node tests/uiux-audit/build-gallery.mjs`);
- dados brutos: `report.json` (matriz), `keyboard.json`, `brands-marquee.json`, `layout-probe.json`,
  `pdp-installments.json`, `lab/metrics.json`.

```text
SCREENSHOT_GALLERY=PASS
CAPTURAS=610  (produção 522 · lab 82 · Chrome do operador 5 · ciclo 02 1)
AFTER=não se aplica a este ciclo
```

## Organização

`output/uiux-audit-01/gallery/<área>/<dispositivo>/<navegador>-<largura>-<rota>[ -full].png`

| Área | mobile (320–430) | tablet (768/820) | desktop (1024–1920) |
| --- | --- | --- | --- |
| storefront (home, busca, categorias, 404, banner de cookies, menu) | 72 | 40 | 62 |
| product (5 PDPs, PDP 404, PDP vazia 1024–1920) | 42 | 24 | 40 |
| checkout (carrinho vazio, drawer vazio, 12x do ciclo 02) | 10 | 4 | 8 |
| account (entrar, cadastro, conta/pedidos anônimos, pedidos reais do operador) | 35 | 20 | 32 |
| institutional (sobre, contato, suporte, envio, trocas, privacidade, cookies) | 49 | 28 | 42 |
| admin (login; Configurações e Prontidão do operador) | 7 | 4 | 9 |

`-full` = página inteira (390 e 1440); demais larguras = primeira tela.

`output/uiux-audit-01/lab/<área>/` — lab local com dados sintéticos:

| Pasta | Conteúdo |
| --- | --- |
| `lab/account` | `/minha-conta`, dados, endereços, pedidos, pedidos de 1/2/5/10/20 itens (390 e 1440) |
| `lab/checkout` | cartão 1x–12x em 390/768/1440 (página e viewport), Pix, drawer com item, item de R$ 30 |
| `lab/product` | PDP de R$ 30 com "até 12x" |
| `lab/storefront` | suporte logado e "Mensagem recebida" (390 e 1440) |
| `lab/admin` | 16 telas do SELLER × 1440/768/390 (página inteira), promoção salva, "Falha temporária" |

## Evidência principal por achado

| Achado | Arquivos |
| --- | --- |
| UIUX-NAV-001 | `gallery/storefront/desktop/chromium-1440-categoria-camisetas-full.png`, `layout-probe.json` |
| UIUX-CATALOG-001 | `gallery/storefront/{mobile,desktop}/chromium-{390,1440}-categoria-tudo-full.png` |
| UIUX-BRANDS-001 | `brands-marquee.json` |
| UIUX-ORDERS-001 | `gallery/account/desktop/producao-chrome-{meus-pedidos,pedido-XQQJL7-sem-foto}.jpg`, `lab/account/pedido-*` |
| UIUX-CHECKOUT-001 | `lab/checkout/checkout-cartao-12x-{390,768,1440}*.png`, `gallery/checkout/mobile/ciclo02-lab-checkout-12x-375.png` |
| UIUX-PDP-001 | `gallery/product/desktop/chromium-{1024,1280,1440,1920}-pdp-vazio-full.png` |
| UIUX-SUPPORT-001 | `lab/storefront/suporte-recebido-{390,1440}.png` |
| UIUX-ADMIN-PROMO-001 | `lab/admin/promocao-editada-ok-1440.png`, `lab/admin/promocao-acao-desatualizada-1440.png` |
| UIUX-PDP-002 | `pdp-installments.json`, `lab/product/pdp-meia-r30-1440.png`, `lab/checkout/checkout-meia-r30-1440.png` |
| UIUX-HOME-001 | `gallery/storefront/mobile/chromium-{320,390}-home*.png`, `gallery/storefront/desktop/chromium-1440-home-full.png` |
| UIUX-GLOBAL-001 | `gallery/storefront/desktop/chromium-1440-menu-acessorios.png`, PDPs desktop |
| UIUX-404-001 | `gallery/storefront/*/chromium-*-404-full.png`, `gallery/product/*/chromium-*-pdp-404-full.png` |
| UIUX-ADMIN-001/002/003 | `gallery/admin/desktop/producao-chrome-*.{png,jpg}` |
| UIUX-ADMIN-004 | `lab/admin/*-390.png`, `lab/admin/*-768.png` |
| UIUX-COOKIES-002 | `gallery/storefront/mobile/chromium-*-_cookie-banner.png` |

Os prints do Chrome do operador foram feitos com zoom de 50% no navegador dele (por isso parecem
pequenos); nenhuma ação foi executada nessas sessões.
