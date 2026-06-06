# Auditoria final de release — RARE

Data desta consolidação: 2026-06-04.

> Documento histórico. A referência atual de prontidão e o checklist de evidências
> estão em [full-project-readiness-audit.md](./full-project-readiness-audit.md).

Este relatório consolida o estado técnico atual da RARE para entrega ao cliente. Ele não substitui os guias operacionais detalhados; aponta para eles quando a execução depende de acesso a Vercel, Stripe, Redis/Upstash, Cloudflare R2, Melhor Envio ou credenciais do cliente.

## 1. Resumo executivo

A base do projeto está pronta para staging/homologação. O storefront público, SEO técnico, segurança HTTP, mídia, catálogo, Admin, health/readiness e documentação operacional já têm os principais controles implementados e testáveis localmente.

Recomendação objetiva:

- Pronto para staging/homologação.
- Produção online atual: funcional com warning operacional conhecido enquanto Redis/Upstash compartilhado não estiver ativo.
- Produção limitada: pendente de Redis/Upstash em produção, `/api/health` sem bloqueios críticos e smoke público pós-deploy.
- Venda aberta: bloqueada até concluir smoke Stripe test-mode real com webhook assinado, confirmar pedido pago no Admin e validar baixa de estoque/reserva.

O desenvolvedor não tem acesso direto aos painéis do cliente. A liberação final depende de quem opera Vercel, Redis/Upstash, Stripe Dashboard, Cloudflare R2, Melhor Envio e bancos isolados.

## 2. Escopo da auditoria

Áreas auditadas:

- Rotas públicas de home, categoria, produto, páginas institucionais, auth e 404.
- SEO técnico: `robots.txt`, `sitemap.xml`, canonical absoluto, Open Graph, Twitter Cards e JSON-LD.
- Segurança: headers, CSP Report-Only, noindex em rotas privadas/auth e sanitização de health/readiness.
- Mídia: uploads, extensões aceitas, MP4 em listagens e imagem social segura.
- Catálogo: produtos ativos, variações compráveis, estoque, mídia, peso/dimensões e categorias vazias.
- Admin: dashboard, pendências de catálogo e `/admin/readiness`.
- Checkout smoke guard e documentação de Stripe test mode.
- Scripts de validação: `lint`, `typecheck`, testes, build, smoke público, app check e checkout guard.
- `/api/health` e readiness administrativa.

Fora do escopo desta auditoria:

- Pagamento real.
- Chamada Stripe live.
- Criação de pedido real.
- Chamada a endpoint mutável.
- Alteração de env real.
- Migration.
- Alteração de schema.
- Alteração de banco de produção.
- Acesso à Vercel API.

## 3. Melhorias implementadas

| Área | Implementação | Arquivos principais | Status | Como validar |
| --- | --- | --- | --- | --- |
| 404 real produto/categoria | Slugs inexistentes retornam HTTP 404 real, com UI branded e `x-robots-tag: noindex`. | `src/proxy.ts`, `src/app/(store)/produto/[slug]/not-found.tsx`, `src/app/(store)/categoria/[slug]/not-found.tsx` | Preparado no código | `curl.exe -I https://raredept.com.br/produto/nao-existe` e `curl.exe -I https://raredept.com.br/categoria/nao-existe` |
| `robots.txt` e `sitemap.xml` | Rotas públicas são listadas; rotas privadas/admin/API ficam fora. | `src/app/robots.ts`, `src/app/sitemap.ts` | Preparado no código | `curl.exe -I https://raredept.com.br/robots.txt` e `curl.exe -I https://raredept.com.br/sitemap.xml` |
| Smoke público | Script valida home, headers, robots, sitemap, 404 real, health e marcadores sensíveis. | `scripts/smoke-public-site.ts`, `src/lib/public-site-smoke.ts` | Preparado no código | `npm run smoke -- https://raredept.com.br` |
| Mídia e uploads | Suporte a JPG, JPEG, PNG, WEBP, AVIF, GIF e MP4; listagens evitam renderizar MP4 pesado diretamente. | `src/lib/product-media.ts`, `src/lib/storage.ts`, `src/app/api/admin/uploads/route.ts` | Preparado no código | Upload em staging/Admin e navegação de cards/listagens com produtos contendo MP4 |
| Rate limit Redis/Upstash | Driver `redis` via REST/Upstash com fallback `memory` para dev/test e health sanitizado. | `src/lib/rate-limit-config.ts`, `src/lib/rate-limit.ts`, `docs/rate-limit.md` | Depende de envs em produção | Configurar `RATE_LIMIT_DRIVER=redis` e validar `/api/health` |
| Categorias vazias | Categorias vazias saem da navegação/home/sitemap, mas rotas existentes continuam com empty state seguro. | `src/lib/storefront.ts`, `src/app/(store)/categoria/[slug]/page.tsx` | Preparado no código | Conferir header, footer, home, sitemap e rota direta da categoria vazia |
| CSP Report-Only | Headers de segurança incluem CSP progressiva em modo relatório. | `src/lib/security-headers.ts`, `next.config.ts` | Preparado no código | `npm run smoke -- https://raredept.com.br` |
| Metadata/auth | `/entrar` e `/cadastro` seguem `noindex/nofollow` com título e canonical corretos. | `src/app/(store)/entrar/page.tsx`, `src/app/(store)/cadastro/page.tsx` | Preparado no código | Inspecionar metadata ou rodar testes de auth metadata |
| JSON-LD | Organization, Product e BreadcrumbList foram validados sem duplicação. | `src/lib/structured-data.tsx`, páginas de home/produto/categoria | Preparado no código | Inspecionar HTML das rotas públicas e rodar `npm test` |
| SEO/OG/canonical | Canonical absoluto, Open Graph, Twitter Cards e fallback seguro de imagem social. | `src/lib/seo.ts`, `src/app/layout.tsx`, páginas públicas do storefront | Preparado no código | Inspecionar head das rotas públicas e rodar `npm test -- seo` |
| Checkout smoke guard | Guard bloqueia live key, domínio de produção sem confirmação, env de produção e banco suspeito. | `scripts/check-checkout-smoke-env.ts`, `src/lib/stripe-smoke-guard.ts`, `docs/checkout-smoke-test.md` | Preparado no código | `npm run checkout` ou `npm run checkout:smoke` em ambiente seguro |
| Storage local seguro | Upload local foi endurecido contra traversal e produção deve usar R2. | `src/lib/storage.ts`, `src/app/uploads/[...path]/route.ts`, `docs/vercel-env-checklist.md` | Preparado no código; R2 depende do cliente | `npm run build` e validação de upload em staging/Admin |
| Produto ativo exige peso/dimensões | Admin bloqueia ativação de produto incompleto para frete real. | `src/lib/admin-catalog-issues.ts`, telas Admin de produto/catálogo | Preparado no código | Tentar ativar produto incompleto no Admin staging |
| Pendências do catálogo no Admin | Admin mostra problemas de estoque, variação, mídia, dimensões e categorias vazias. | `src/lib/admin-catalog-issues.ts`, Admin dashboard | Preparado no código | Abrir Admin e revisar pendências |
| Prontidão de Venda | `/admin/readiness` consolida bloqueios, warnings, dependências do cliente e ações. | `src/lib/admin-readiness.ts`, `src/app/admin/(protected)/readiness/page.tsx` | Preparado no código | Abrir `/admin/readiness` em staging |
| Documentação de Vercel/handoff | Guias operacionais para envs, Redis, Stripe, smoke e handoff. | `docs/vercel-env-checklist.md`, `docs/client-handoff.md`, `docs/checkout-smoke-test.md`, `docs/rate-limit.md` | Preparado no código | Seguir checklist antes de liberar venda |

## 4. Validações executadas

Comandos locais esperados antes de qualquer release:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Validações públicas e checkout guard:

```powershell
npm run smoke -- https://raredept.com.br
npm run checkout
```

Resultado desta rodada de auditoria local:

- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK, 72 arquivos de teste e 378 testes passaram.
- `npm run build`: OK.
- `git diff --check`: OK; apenas warnings locais de LF/CRLF do Git.
- `npm run smoke -- https://raredept.com.br`: OK com 18 OK, 1 WARNING, 0 FAIL.
- `npm run checkout`: bloqueado pelo guard, como esperado no ambiente atual, por falta de `CHECKOUT_ENABLED=true` e `STRIPE_WEBHOOK_SECRET` test-mode.

Comportamento esperado:

- `lint`, `typecheck`, testes e build devem passar antes de release.
- Smoke público deve terminar com `0 FAIL`. `WARNING` indica pendência operacional, não criação de pedido.
- Checkout smoke guard pode bloquear corretamente se faltarem envs seguras, Stripe test mode, webhook test ou banco isolado. Esse bloqueio é esperado e não é falha da aplicação.
- O guard não chama Stripe real, não cria pedido e não executa checkout; ele só valida o ambiente antes da homologação.

## 5. Status online conhecido

Estado online verificado nesta auditoria para `https://raredept.com.br`:

- `robots.txt` online respondeu 200.
- `sitemap.xml` online respondeu 200.
- Produto inexistente retorna 404 real.
- Categoria inexistente retorna 404 real.
- Headers de segurança estão presentes.
- `Content-Security-Policy-Report-Only` está presente.
- Smoke público online passou sem `FAIL`.
- Resultado do smoke público nesta rodada: 18 OK, 1 WARNING, 0 FAIL.
- `/api/health` respondeu `ok_with_warnings`.
- Warning conhecido: produção ainda usa `RATE_LIMIT_DRIVER=memory`, sem Redis/Upstash compartilhado.
- Health indicou `checkoutEnabled: true`; se venda aberta ainda não estiver autorizada, o cliente deve avaliar `CHECKOUT_ENABLED=false` em Production até homologar Stripe.

Após qualquer mudança de env na Vercel, faça redeploy e rode novamente:

```powershell
npm run smoke -- https://raredept.com.br
curl.exe https://raredept.com.br/api/health
```

## 6. Bloqueios para venda aberta

Bloqueios atuais:

- Redis/Upstash compartilhado ainda precisa ser configurado em Production.
- `/api/health` ainda possui warning operacional enquanto o rate limit ativo for `memory`.
- Smoke Stripe test-mode real ainda precisa ser executado com webhook assinado.
- Pedido pago test-mode ainda precisa ser confirmado no Admin.
- Estoque e reserva precisam ser validados no fluxo real de checkout test-mode.
- Cliente precisa decidir se `CHECKOUT_ENABLED` fica ativo em Production antes da homologação.
- Produção precisa ser revalidada após cada redeploy ou alteração de env.

Venda aberta não deve ser liberada apenas com build/test/smoke público. A evidência mínima de checkout precisa incluir Stripe test mode, webhook assinado, pedido pago no Admin e estoque/reserva corretos.

## 7. Pronto para quê?

| Ambiente/uso | Status | Motivo |
| --- | --- | --- |
| Desenvolvimento local | OK | Testes e build locais validam a base; warnings de env local são esperados quando secrets reais não existem. |
| Staging/homologação | Pronto, desde que envs sejam configuradas | Código e documentação estão prontos; cliente precisa configurar Vercel Preview/Staging, banco isolado, Stripe test, webhook test, R2, frete e Redis. |
| Produção online atual | Funcional com warning | Smoke público informado sem `FAIL`, mas `/api/health` segue `ok_with_warnings` por rate limit `memory`. |
| Produção limitada | Pendente | Requer Redis/Upstash compartilhado, health sem bloqueios críticos e smoke público pós-deploy. |
| Venda aberta | Bloqueada | Requer smoke Stripe test-mode real, webhook assinado, pedido pago no Admin, estoque/reserva validados e aprovação do cliente. |

## 8. Checklist do cliente

- [ ] Subir todos os commits para `origin/main`.
- [ ] Aguardar deploy da Vercel.
- [ ] Configurar `RATE_LIMIT_DRIVER=redis`.
- [ ] Configurar `UPSTASH_REDIS_REST_URL`.
- [ ] Configurar `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Decidir `CHECKOUT_ENABLED` em Production.
- [ ] Configurar Stripe test em staging.
- [ ] Configurar webhook test para `/api/stripe/webhook`.
- [ ] Rodar `npm run checkout` em ambiente seguro.
- [ ] Executar smoke de pagamento test-mode.
- [ ] Confirmar pedido pago no Admin.
- [ ] Confirmar baixa de estoque e reserva.
- [ ] Rodar `npm run smoke -- https://raredept.com.br`.
- [ ] Validar `/api/health` sem bloqueios críticos.
- [ ] Autorizar produção limitada.
- [ ] Autorizar venda aberta.

## 9. Comandos de validação

Local:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Online público:

```powershell
npm run smoke -- https://raredept.com.br
```

PowerShell manual:

```powershell
curl.exe -I https://raredept.com.br/robots.txt
curl.exe -I https://raredept.com.br/sitemap.xml
curl.exe -I https://raredept.com.br/produto/nao-existe
curl.exe -I https://raredept.com.br/categoria/nao-existe
curl.exe https://raredept.com.br/api/health
```

Checkout guard:

```powershell
npm run checkout
```

Se o guard bloquear por falta de envs seguras, o comportamento está correto. Configure Stripe test mode, webhook test, `APP_ENV` seguro e banco isolado antes de executar o fluxo manual de homologação.

## 10. Segurança e secrets

- Nenhum secret real deve estar no repositório.
- Não commitar `.env`.
- Não enviar secrets em WhatsApp, chat aberto ou comentário de PR.
- Admin readiness não exibe secrets; mostra apenas presença/ausência, modo sanitizado e ações.
- `/api/health` é sanitizado e não imprime valores de credenciais.
- O smoke público procura marcadores sensíveis em respostas públicas verificadas.
- Exemplos de segredo em docs devem usar reticências, como `sk_live_...`, `sk_test_...`, `whsec_...` ou nomes de variáveis.

## 11. Pendências futuras não bloqueantes

- Usar domínio próprio/CDN dedicado para mídia pública em vez de domínio padrão do storage, se o cliente quiser controle maior de previews.
- Monitorar relatórios de CSP Report-Only antes de converter para enforcement.
- Criar `WebSite/SearchAction` quando houver página de busca canônica estável.
- Melhorias incrementais de conversão/layout após homologação.
- Observabilidade e logs estruturados para produção.
- E2E completo com ferramenta dedicada, caso o projeto adote esse padrão.
- Previews com dados reais de homologação, sem usar banco de produção.

## 12. Links úteis

- [Checklist de variáveis da Vercel](./vercel-env-checklist.md)
- [Handoff técnico do cliente](./client-handoff.md)
- [Checkout Stripe test-mode smoke](./checkout-smoke-test.md)
- [Rate limit em produção](./rate-limit.md)
- Admin protegido: `/admin`
- Prontidão de Venda: `/admin/readiness`
- Smoke público: `npm run smoke -- https://raredept.com.br`
- Checkout guard: `npm run checkout`
