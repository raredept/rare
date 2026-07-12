# Checklist de liberação do storefront

Marque somente após executar no commit candidato. Os itens de ambiente permanecem desmarcados neste ciclo local.

## Código

- [x] Modernização visual preservada, sem nova reformulação.
- [x] Fronteiras Client/Server revisadas; interações continuam isoladas.
- [x] Imagens locais sem variantes usam otimização do Next; variantes persistidas continuam preferidas.
- [x] Estados `not-found`, `error`, `global-error` e loading revisados.
- [x] Worktree limpa no commit candidato.

## Testes

- [x] `npm test` aprovado no fechamento.
- [x] `npm run lint` aprovado no fechamento.
- [x] `npm run typecheck` aprovado no fechamento.
- [x] `npm run build` e standalone aprovados no fechamento.
- [x] `npm run test:e2e` aprovado no fechamento.
- [x] Axe aprovado em Home, catálogo, produto, carrinho, login, cadastro e institucionais, desktop/mobile/WebKit.
- [x] Testes de teclado aprovados em Chromium desktop/mobile.
- [x] Verificação local de links aprovada.

## Acessibilidade

- [x] Uma `h1` e um `main` nas páginas auditadas.
- [x] Contraste automático sem violações Axe.
- [x] Labels, nomes acessíveis, landmarks e ARIA validados.
- [x] Menu, carrinho e lightbox com Escape, trap e retorno de foco.
- [x] Feedbacks relevantes usam `aria-live`/`role=status`.
- [ ] Teste manual com leitor de tela realizado.

## Performance

- [x] `npm run lighthouse` aprovado no fechamento.
- [x] Performance pública mobile >= 80 e desktop >= 90 na medição atual.
- [x] CLS igual a 0 nas rotas Lighthouse atuais.
- [x] Orçamento de recursos definido em `docs/frontend-quality-budget.md`.
- [ ] Medição em preview/staging registrada.

## SEO

- [x] Metadata específica, canonical e Open Graph revisados.
- [x] Canonical sem `www`, localhost ou Railway.
- [x] Robots diferencia produção de preview/staging.
- [x] Sitemap inclui estáticas, categorias com conteúdo e produtos ativos.
- [x] Login, cadastro, conta, pedidos, carrinho e Admin com `noindex`/bloqueio adequado.
- [x] Organization, WebSite, BreadcrumbList e Product validados estruturalmente.
- [x] `Product.offers` ausente quando checkout está pausado.

## Segurança e observabilidade

- [x] Links externos usam `noopener noreferrer`.
- [x] Erros frontend são registrados sem mensagem, stack, PII ou token.
- [x] Teste de console falha em erros/warnings inesperados.
- [x] Headers de segurança mantidos; CSP incompatível removida e pendência documentada.
- [x] Service worker administrativo restrito ao escopo `/admin/`.
- [x] Verificação final de secrets no diff e bundle aprovada.
- [x] `npm audit` com 0 vulnerabilidades no fechamento.

## Feature flags e integrações

- [x] Validações locais executadas com `CHECKOUT_ENABLED=false`.
- [x] Nenhum pagamento, cotação real, e-mail, Push ou backfill executado.
- [ ] `CHECKOUT_ENABLED=false` confirmado no preview/staging.
- [ ] `CHECKOUT_ENABLED=false` confirmado em produção antes do deploy.
- [ ] Stripe live ausente do ambiente candidato.
- [ ] Melhor Envio, e-mail e Push real desabilitados no smoke.

## Responsividade e conteúdo

- [x] Viewports desktop/mobile cobertos por Playwright.
- [x] Reduced motion e forced colors cobertos por automação compatível.
- [x] Mensagens de checkout pausado preservadas.
- [ ] QA visual final em preview/staging aprovado.
- [ ] iPhone real e teclado virtual validados manualmente.

## Deploy e rollback

- [ ] Backup e responsável pelo rollback confirmados.
- [ ] Preview/staging isolado aprovado e `noindex` confirmado.
- [ ] Smoke de produção autorizado e concluído.
- [ ] Health, Home, catálogo, produto, login, carrinho pausado e institucionais aprovados.
- [ ] Manifest, sitemap, robots, canonical, console, logs e mobile aprovados em produção.
- [ ] Commit/deploy anterior identificado para rollback.
- [ ] Comunicação e critérios de interrupção revisados.
