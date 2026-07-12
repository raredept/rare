# Runbook de deploy controlado do storefront

Este procedimento não autoriza deploy, alteração de DNS, Railway, Cloudflare ou serviços externos. Ele define gates para uma publicação posterior. Durante a pausa comercial, `CHECKOUT_ENABLED=false` é obrigatório.

## Pré-deploy

- Confirmar branch esperada, worktree limpa e commits revisados com `git status --short --branch`, `git log -10 --oneline` e `git diff`.
- Confirmar backup válido do banco e responsável pelo rollback. Não executar backup destrutivo nem backfill.
- Conferir variáveis sem imprimir valores: URLs, sessão, storage, banco, e-mail, frete, Push e checkout.
- Confirmar `CHECKOUT_ENABLED=false`, `EMAIL_DRIVER=disabled` e ausência de credenciais Stripe live no ambiente de preview.
- Confirmar que Melhor Envio, e-mail e Push não serão acionados no smoke.
- Executar `npm run db:check`, `npx prisma validate` e `npx prisma migrate status`. Não aplicar migration destrutiva.
- Executar `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit` e `git diff --check`.
- Executar `npm run test:e2e`, `npm run test:a11y`, `npm run check:links` e `npm run lighthouse`.
- Revisar screenshots de Home, catálogo, produto, login e carrinho pausado em desktop/mobile.
- Verificar secrets no diff e no bundle sem imprimir conteúdo sensível.
- Tratar todo warning: corrigir, documentar limitação ou bloquear o deploy.

## Preview ou staging

- Criar deploy isolado, sem alterar produção ou DNS.
- Verificar `noindex,nofollow` no HTML e `Disallow: /` em `robots.txt`.
- Usar banco isolado quando a jornada puder escrever; para este ciclo, preferir somente leituras.
- Usar Redis isolado se rate limit compartilhado for testado.
- Não configurar Stripe live, credenciais reais de envio, SMTP real ou VAPID novo.
- Manter `CHECKOUT_ENABLED=false` e `EMAIL_DRIVER=disabled`.
- Rodar smoke funcional e visual sem criar pedido, pagamento, cotação real, e-mail ou Push.
- Verificar console, hydration, requests 404/500, manifest, ícones, canonical e headers.
- Registrar resultados Axe/Lighthouse e o hash do commit testado.

## Produção

Executar somente após aprovação explícita e gates anteriores aprovados:

1. Publicar o commit aprovado sem migration destrutiva.
2. Confirmar health check e logs de inicialização sem secrets.
3. Validar Home, catálogo, um produto ativo, login e carrinho pausado.
4. Validar contato, sobre, trocas, envio, privacidade/termos e 404.
5. Confirmar que adicionar ao carrinho/finalizar/frete automático permanecem indisponíveis.
6. Confirmar que não há promessa de Pix, cartão ou parcelamento.
7. Validar `manifest.webmanifest`, ícones, `sitemap.xml` e `robots.txt`.
8. Confirmar canonical/Open Graph em `https://raredept.com.br`, sem `www`, localhost ou Railway.
9. Verificar console e logs, mobile real e pelo menos uma navegação por teclado.
10. Registrar deploy, horário, hash, responsável e resultado do smoke.

Não afirmar compatibilidade real com iPhone apenas por WebKit; exige teste manual em dispositivo.

## Rollback

- Fazer rollback em erro 500 principal, hydration recorrente, flag comercial incorreta, canonical quebrado, violação crítica de acessibilidade, regressão severa de performance ou secret em bundle/log.
- Selecionar o commit/deploy anterior conhecido e aprovado; não usar `git reset --hard` para preparar rollback local.
- Preferir imagem/deploy anterior da plataforma quando disponível.
- Não reverter ou alterar banco se este deploy não mudou schema/dados.
- Reconfirmar `CHECKOUT_ENABLED=false`, e-mail/frete/Push desabilitados após rollback.
- Comunicar incidente sem payload financeiro, PII, tokens ou stack pública.
- Reexecutar health, Home, catálogo, produto, login, carrinho pausado, canonical, console e logs.

## Critérios de interrupção

Interromper imediatamente se houver:

- Falha de build, typecheck ou teste crítico.
- Erro de hydration ou warning React inesperado.
- Home, catálogo ou produto em 500.
- Carrinho/checkout/frete habilitado indevidamente.
- Promessa ativa de pagamento, Pix, cartão ou parcelamento.
- Canonical incorreto, sitemap quebrado ou preview indexável.
- Violação Axe crítica/séria ou regressão de teclado/foco.
- Performance abaixo do orçamento documentado.
- Secret, PII, token ou stack em bundle, console, resposta ou log público.

## Pendências deliberadas

- CSP não é emitida neste ciclo. A política `Report-Only` anterior não tinha endpoint de relatório e era incompatível com scripts/estilos inline do runtime Next/React, gerando ruído no WebKit sem proteção. Uma CSP futura exige nonces/hashes, endpoint de relatório e homologação de imagens, fontes, Stripe, analytics, PWA e Push.
- O service worker existente atende apenas Push administrativo e usa escopo `/admin/`; não existe cache offline do storefront.
- Preview/staging, dispositivo iPhone real, DNS e deploy de produção não fazem parte da validação local.

