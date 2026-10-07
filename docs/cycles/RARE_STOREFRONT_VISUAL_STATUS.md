# RARE — Storefront Visual Evolution

## Estado atual

- Branch: `codex/storefront-visual-overhaul-20261007`.
- Baseline reconciliada: `cc72e3b` (documentação Phase 2); frontend anterior: `44c6fa2`.
- Ciclo atual: 0 — inventário e plano concluídos; implementação em curso.
- Resultado: direção editorial aprovada pelo pedido; nenhuma publicação autorizada.
- Release: **PAUSED**. Histórico Phase 2 preservado: 14 APPLIED / 0 pending / 0 failed / 0 mismatch; backup bloqueador YES; config NOT VERIFIED; incidente OPEN; freeze ACTIVE.

## Plano concreto / critérios por ciclo

| Ciclo | Entrega | Verificação |
| --- | --- | --- |
| 0 | Preservar documentação, isolar branch, mapear rotas/contratos | diff check, release guard, revisão estática |
| 1 | Tokens storefront, tipografia Geist, superfícies planas, foco | lint, types, unidades |
| 2 | Masthead centralizado, busca, navegação mobile e footer | unidades + teclado/preview |
| 3 | Hero editorial, drop, seleção, categorias, novidades, confiança | mídia/fallback/movimento + screenshots |
| 4 | Grid 2/3/4, cards 4:5, catálogo, filtros e busca | unidades + preview resultados/vazio |
| 5 | Galeria ampliada, zoom, variantes/painel PDP | unidades + teclado/galeria/mídia |
| 6 | Carrinho, auth, conta e checkout: somente apresentação | unidades + guard pausado/ações bloqueadas QA |
| 7 | 360/390/430/768/1024/1280/1440+, reduced motion/a11y | screenshots, Axe e teclado |
| 8 | Imagens responsivas, estabilidade e acabamento | build, revisão de bundle e rede local |
| 9 | QA final e relatório, commits e push da branch | suíte local, diff/guard/status |

## Inventário e contratos

19 páginas: home (busca `/?q=`), categoria, produto, `/cart` (redirect), finalizar-compra, entrar, cadastro, minha-conta e dados/endereços/pedidos/detalhe, pedido/sucesso, pedidos legado, sobre, contato, política de envio, privacidade/termos e trocas/devoluções.

Preservar server/client boundaries, metadata/canonical/JSON-LD, slugs, categorias dinâmicas, filtros q/brand/page, ordem disponível/esgotado, estoque ativo menos reservado, variant IDs/limites/cart localStorage, sessões/Server Actions, checkout-disabled guards, mídia real e fallback. Não há sort nem recuperação de senha implementados: nenhuma interface fictícia será criada.

## Concluído

- Cinco documentos de auditoria anterior consolidados em `cc72e3b`, após diff check e release guard: 6 OK / 1 aviso legado de cron Vercel / 0 FAIL.
- Branch isolada criada; dois documentos untracked do proprietário preservados e excluídos de commits.
- Inventário dos componentes, fontes locais e Tailwind 4; direção monocromática editorial, sem imagens/claims inventados.

## Em andamento / pendente

- Fundação, shell, home, catálogo/PDP, superfícies de cliente e preview seguro.
- QA e screenshots nos sete breakpoints; commits por entregas lógicas; relatório final e push.

## Regressões / acessibilidade / performance

- Nenhuma regressão nova verificada ainda; baseline estática identificou targets 40px, contraste do preço no drawer, busca persistente desatualizada, fallback de mídia e pausa de autoplay incompleta.
- Manter 44px, focus-visible, traps/retorno de foco, anúncio do carrinho, headings, safe-area e reduced motion.
- Manter fonte local, media plans/srcset, imagem prioritária acima da dobra, lazy abaixo, vídeo preload metadata/none e componentes server.

## Testes e limite de evidência

Navegação SSR normal chama `getStoreSettings()` com upsert. Não iniciar QA no Next ligado a banco. O preview será **UI fixture QA**, renderizando componentes reais com catálogo/settings em memória, sem credenciais nem rede externa. Não equivale a homologação do catálogo real, auth servidor, pagamento, frete, CDN ou deploy. Não executar isolated-admin-E2E (cria/migra banco).

## Backlog backend / próximo ciclo

Ver [RARE_BACKEND_BACKLOG.md](./RARE_BACKEND_BACKLOG.md). Próximo: concluir tokens e fundação visual. Backend permanece fora de escopo.
