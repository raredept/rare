# Handoff técnico — RARE

## 1. Resumo executivo

O projeto está tecnicamente preparado para staging/homologação. Várias pendências do relatório foram resolvidas no código, mas venda aberta ainda depende de configuração real do cliente na Vercel, Redis/Upstash, Stripe, R2, Melhor Envio e bancos isolados.

O estado e o checklist de evidências mais recentes estão em [docs/full-project-readiness-audit.md](./full-project-readiness-audit.md). A auditoria de 2026-06-04 permanece apenas como histórico.

O desenvolvedor não tinha acesso direto à Vercel, Redis/Upstash, Stripe Dashboard e algumas credenciais do cliente. Por isso, a etapa final precisa ser executada pelo cliente ou por quem tenha acesso aos painéis.

## 2. O que foi corrigido

| Área | Correção | Status | Como validar |
| --- | --- | --- | --- |
| 404 público | Produto/categoria inexistentes retornam HTTP 404 real. | Preparado no código | `curl.exe -I https://raredept.com.br/produto/nao-existe` e `curl.exe -I https://raredept.com.br/categoria/nao-existe`. |
| SEO técnico | `robots.txt`, `sitemap.xml`, canonical absoluto, Open Graph e Twitter Cards implementados nas páginas públicas principais. | Preparado no código | `curl.exe -I https://raredept.com.br/robots.txt`, `curl.exe -I https://raredept.com.br/sitemap.xml` e inspeção do HTML/head das rotas públicas. |
| Mídia | Produto/banner aceitam JPG, JPEG, PNG, WEBP, AVIF, GIF e MP4. | Preparado no código | Upload e renderização pelo Admin/staging. |
| Performance de mídia | Cards/listagens evitam MP4, imagens usam plano responsivo por contexto e `srcSet` somente com variantes reais. | Preparado no código | Navegar cards/produto e inspecionar loading, dimensões, prioridade e `srcSet` quando houver variantes. |
| Rate limit | Suporte a Redis/Upstash REST com fallback `memory` para dev/test. | Depende de envs | Ver [docs/rate-limit.md](./rate-limit.md) e `/api/health`. |
| Categorias | Categorias vazias ocultadas da navegação pública/home/sitemap, sem apagar do Admin. | Preparado no código | Conferir navegação pública, home e sitemap. |
| Segurança HTTP | CSP progressiva adicionada em `Content-Security-Policy-Report-Only`. | Preparado no código | `npm run smoke -- https://raredept.com.br`. |
| Metadata | Metadata de `/entrar` e `/cadastro` corrigida. | Preparado no código | Conferir HTML/head nas rotas. |
| Dados estruturados | JSON-LD `Organization` e `BreadcrumbList` adicionados. | Preparado no código | Inspecionar HTML das páginas públicas. |
| Checkout seguro | Guard criado para impedir smoke inseguro com Stripe live, domínio de produção ou banco suspeito. | Preparado no código | `npm run checkout:smoke`. |
| Storage local | Storage local endurecido e warning de Turbopack corrigido. | Preparado no código | `npm run build` e upload local em dev. |
| Catálogo/Admin | Admin bloqueia produto ativo sem peso/dimensões. | Preparado no código | Tentar ativar produto incompleto no Admin. |
| Smoke público | Smoke público local criado. | Preparado no código | `npm run smoke -- https://raredept.com.br`. |
| Pendências do catálogo | Admin mostra pendências de catálogo. | Preparado no código | Abrir painel Admin em staging. |
| Prontidão de venda | Admin mostra uma área somente leitura com bloqueios, warnings e ações para go-live. | Preparado no código | Abrir `/admin/readiness` no Admin. |

Nota: `WebSite/SearchAction` fica como melhoria futura quando houver uma página de busca canônica estável. Um domínio/CDN dedicado para imagens sociais também pode ser avaliado depois, se o cliente quiser controlar previews por campanha.

Nota de mídia: `next/image` não foi aplicado amplamente porque o catálogo aceita URLs antigas de origens variadas e o projeto não possui allowlist/loader remoto estável para todas elas. JPG/PNG/WEBP enviados pelo Admin continuam sendo convertidos para WEBP quando isso reduz o arquivo; GIF e MP4 permanecem permitidos. Produtos antigos sem thumbnail/medium usam a URL original até existir geração e persistência de variantes reais.

## 3. O que o cliente precisa configurar

- Variáveis da Vercel conforme [docs/vercel-env-checklist.md](./vercel-env-checklist.md).
- Redis/Upstash REST para rate limit compartilhado.
- Stripe test mode em Preview/Staging.
- Stripe live futuramente, somente em Production e após aprovação.
- Webhook Stripe test e live separados para `/api/stripe/webhook`.
- Cloudflare R2 para uploads persistentes.
- Melhor Envio com token válido e ambiente correto.
- Banco isolado de staging.
- Banco production separado, nunca usado para smoke.
- `CRON_SECRET` para liberação de reservas expiradas.

## 4. O que ainda bloqueia venda aberta

- O Admin deve mostrar `/admin/readiness` sem bloqueios de venda aberta.
- Produção precisa estar atualizada com os commits mais recentes.
- Redis/Upstash precisa estar configurado e compartilhado.
- `/api/health` precisa ficar sem erro crítico.
- Smoke Stripe test mode precisa ser executado antes de live.
- Pedido pago de teste precisa aparecer no Admin.
- Estoque/reserva precisa ser validado.
- Expiração/cancelamento precisa liberar reserva.
- A cron de liberação de reservas precisa ter execução comprovada.
- Produtos ativos precisam ter peso e dimensões reais.
- Produção online precisa passar no smoke público.
- O cliente precisa autorizar formalmente a produção limitada e a venda aberta.

## 5. Como validar depois do deploy

Comandos PowerShell:

```powershell
npm run smoke -- https://raredept.com.br
curl.exe -I https://raredept.com.br/robots.txt
curl.exe -I https://raredept.com.br/sitemap.xml
curl.exe -I https://raredept.com.br/produto/nao-existe
curl.exe -I https://raredept.com.br/categoria/nao-existe
curl.exe https://raredept.com.br/api/health
```

O smoke público também aceita:

```powershell
$env:SITE_URL="https://raredept.com.br"
npm run smoke
```

`FAIL` bloqueia a entrega do deploy. `WARNING` indica pendência operacional; por exemplo, `/api/health` pode responder `ok_with_warnings` enquanto Redis/envs de produção ainda não estiverem completos. O script não altera dados, não chama checkout real e não cria pedidos.

## 6. Como validar checkout antes de venda

Use o guia canônico em [docs/checkout-smoke-test.md](./checkout-smoke-test.md).

Resumo operacional:

```powershell
npm run checkout:smoke
```

Depois do guard aprovado, execute o fluxo manual em Stripe test mode, com banco isolado e webhook test assinado. Não use `sk_live_`, cartão real, domínio público de produção ou banco de produção nessa homologação.

## 7. Checklist de go-live

- [ ] Vercel Production com envs revisadas.
- [ ] Vercel Preview/Staging com envs separadas.
- [ ] Redis/Upstash ativo em produção.
- [ ] `/api/health` sem `status: "error"`.
- [ ] R2 ativo e uploads carregando em domínio público.
- [ ] Melhor Envio cotando frete real.
- [ ] Produtos ativos completos, com estoque e dimensões.
- [ ] Stripe test mode aprovado ponta a ponta.
- [ ] Webhook test assinado validado.
- [ ] Pedido pago test mode visível no Admin.
- [ ] Reserva de estoque baixa ao pagar.
- [ ] Reserva expirada/cancelada é liberada.
- [ ] Smoke público online sem `FAIL`.
- [ ] Cliente autoriza produção limitada.
- [ ] `CHECKOUT_ENABLED=true` aplicado em Production somente após aprovação.

## 8. Avisos de segurança

- Não enviar secrets por chat aberto.
- Não commitar `.env`.
- Não usar `sk_live_` em staging/local.
- Não usar banco de produção para smoke.
- Não desativar verificação de assinatura do webhook.
- Não ativar checkout live antes da homologação.
- Não trocar R2 por outro storage sem nova validação.
- Não transformar CSP Report-Only em enforcement nesta entrega.
