# Handoff técnico — RARE

> Estado vigente: [FINAL_RELEASE_STATUS.md](../FINAL_RELEASE_STATUS.md). As listas
> abaixo documentam o handoff anterior; a execução autorizada de 2026-09-07 já
> publicou autenticação, uploads endurecidos e fontes locais, criou staging
> isolado e comprovou Stripe test. Os gates externos restantes estão no registro
> vigente. Vendas reais continuam desativadas.

## 1. Resumo executivo

O projeto está tecnicamente preparado para staging/homologação. Várias pendências do relatório foram resolvidas no código, mas venda aberta ainda depende de configuração real do cliente na Railway, Redis/Upstash, Stripe, R2, Melhor Envio e bancos isolados.

O estado e o checklist de evidências mais recentes estão em [docs/full-project-readiness-audit.md](./full-project-readiness-audit.md). A auditoria de 2026-06-04 permanece apenas como histórico.

As auditorias iniciais não tinham acesso aos painéis externos. A consolidação de 2026-09-07 obteve evidência Railway somente leitura e registra um deployment Admin já realizado em tarefa anterior, mas não acessou Redis/Upstash, Stripe Dashboard, R2 nem Cloudflare. As etapas externas restantes precisam ser executadas pelo cliente ou por quem tenha autorização nesses painéis.

## 2. O que foi corrigido

| Área | Correção | Status | Como validar |
| --- | --- | --- | --- |
| 404 público | Produto/categoria inexistentes retornam HTTP 404 real. | Preparado no código | `curl.exe -I https://raredept.com.br/produto/nao-existe` e `curl.exe -I https://raredept.com.br/categoria/nao-existe`. |
| SEO técnico | `robots.txt`, `sitemap.xml`, canonical absoluto, Open Graph e Twitter Cards implementados nas páginas públicas principais. | Preparado no código | `curl.exe -I https://raredept.com.br/robots.txt`, `curl.exe -I https://raredept.com.br/sitemap.xml` e inspeção do HTML/head das rotas públicas. |
| Mídia | Produto/banner aceitam JPG, JPEG, PNG, WEBP, AVIF, GIF e MP4; original, GIF e MP4 são preservados. | Preparado no código | Upload e renderização pelo Admin/staging. |
| Performance de mídia | Upload server-routed pode gerar thumbnail 640 e medium 1200 em WEBP; cards/detail/banner/OG usam variantes reais e zoom usa o original. | Preparado no código para novos uploads elegíveis | Ver [docs/media-optimization.md](./media-optimization.md), rodar `npm run media:variants:audit`, reenviar uma fixture em staging e inspecionar `src`/`srcSet`. |
| Rate limit | Suporte a Redis/Upstash REST com fallback `memory` para dev/test. | Depende de envs | Ver [docs/rate-limit.md](./rate-limit.md) e `/api/health`. |
| Categorias | Categorias vazias ocultadas da navegação pública/home/sitemap, sem apagar do Admin. | Preparado no código | Conferir navegação pública, home e sitemap. |
| Segurança HTTP | Headers de proteção existentes; CSP experimental foi removida e não está ativa. | Verificado no smoke público | `npm run smoke -- https://raredept.com.br`. |
| Metadata | Metadata de `/entrar` e `/cadastro` corrigida. | Preparado no código | Conferir HTML/head nas rotas. |
| Dados estruturados | JSON-LD `Organization` e `BreadcrumbList` adicionados. | Preparado no código | Inspecionar HTML das páginas públicas. |
| Checkout seguro | Guard criado para impedir smoke inseguro com Stripe live, domínio de produção ou banco suspeito. | Preparado no código | `npm run checkout:smoke`. |
| Storage local | Storage local endurecido e warning de Turbopack corrigido. | Preparado no código | `npm run build` e upload local em dev. |
| Primeiro acesso Admin | Conta temporária fica restrita à troca de senha; a troca invalida senha e sessões anteriores. | Publicado no release técnico de 2026-09-07 | `npm run qa:admin-access` e `npm run qa:e2e:isolated`; senhas definitivas dos administradores foram preservadas. |
| Fontes | Geist Sans/Mono servidas por arquivos locais com licença OFL; sem chamada a Google Fonts no build. | Preparado no código | Build com rede de fontes bloqueada e `npm run lighthouse`. |
| Catálogo/Admin | Admin bloqueia produto ativo sem peso/dimensões. | Preparado no código | Tentar ativar produto incompleto no Admin. |
| Smoke público | Smoke público local criado. | Preparado no código | `npm run smoke -- https://raredept.com.br`. |
| Pendências do catálogo | Admin mostra pendências de catálogo. | Preparado no código | Abrir painel Admin em staging. |
| Prontidão de venda | Admin mostra bloqueios, warnings, ações e evidências operacionais manuais/sanitizadas para go-live. | Preparado no código | Abrir `/admin/readiness` no Admin e preencher evidências sem secrets. |
| Migration de evidências | Tabela aditiva `OperationalEvidence` registra evidências sem misturar com configurações da loja. | Requer `migrate deploy` por ambiente | Seguir [docs/deploy-with-migrations.md](./deploy-with-migrations.md). |

Nota: `WebSite/SearchAction` fica como melhoria futura quando houver uma página de busca canônica estável. Um domínio/CDN dedicado para imagens sociais também pode ser avaliado depois, se o cliente quiser controlar previews por campanha.

Nota de mídia: `next/image` não foi aplicado amplamente porque o catálogo aceita URLs antigas de origens variadas e o projeto não possui allowlist/loader remoto estável para todas elas. Novos JPG/JPEG/PNG/WEBP/AVIF estáticos e elegíveis enviados pelo fluxo server-routed podem gerar thumbnail/medium WEBP persistidos por convenção versionada de key. GIF continua sem variantes, mas precisa ser decodificável pelo Sharp; MP4 passa apenas por validação de extensão, MIME e assinatura básica do container, sem decoder/transcoder. O antigo presign direto foi encerrado com `410 Gone` e não emite URL de escrita. As gravações usam chaves server-side e são condicionais contra sobrescrita; associação e substituição não apagam automaticamente objetos, portanto falhas posteriores de banco podem deixar órfãos até existir uma política de limpeza autorizada. Produtos antigos continuam na URL original até reupload manual ou um job futuro explícito. A triagem segura é `npm run media:variants:audit`, que é dry-run e não chama R2/rede externa por padrão.

## 3. O que o cliente precisa configurar

- Variáveis da Railway conforme [docs/railway-env-checklist.md](./railway-env-checklist.md).
- Serviço web Railway e worker de reservas separado (`npm run checkout:worker`, contínuo, sem cronSchedule). O worker consulta a fila a cada15 segundos e confirma o estado na Stripe antes de liberar estoque. Preserve as referências de banco/chave no mesmo ambiente; veja `docs/railway-env-checklist.md`.
- Redis/Upstash REST para rate limit compartilhado.
- Stripe test mode em Preview/Staging.
- Stripe live futuramente, somente em Production e após aprovação.
- Webhook Stripe test e live separados para `/api/stripe/webhook`.
- Cloudflare R2 para uploads persistentes.
- Melhor Envio com token válido e ambiente correto.
- Banco isolado de staging.
- Banco production separado, nunca usado para smoke.
- `CRON_SECRET` para liberação de reservas expiradas.
- Migration `OperationalEvidence` aplicada com `npx prisma migrate deploy` no banco correto antes de registrar evidências.

## 4. O que ainda bloqueia venda aberta

- O Admin deve mostrar `/admin/readiness` sem bloqueios de venda aberta.
- A tabela `OperationalEvidence` precisa existir no ambiente; se não existir, o Admin mostra warning sanitizado e mantém venda aberta bloqueada.
- As evidências operacionais críticas em `/admin/readiness` devem estar aprovadas ou justificadas como não aplicáveis.
- Produção precisa estar atualizada com os commits mais recentes.
- Redis/Upstash precisa estar configurado e compartilhado.
- `/api/health` precisa ficar sem erro crítico.
- Smoke Stripe test mode precisa ser executado antes de live.
- Pedido pago de teste precisa aparecer no Admin.
- Estoque/reserva precisa ser validado.
- Expiração/cancelamento precisa liberar reserva.
- A cron de liberação de reservas precisa ter execução comprovada.
- Durante a transição, `vercel.json` permanece como rollback temporário até Railway passar smoke e domínio final.
- Produtos ativos precisam ter peso e dimensões reais.
- Produção online precisa passar no smoke público.
- O cliente precisa autorizar formalmente a produção limitada e a venda aberta.

Nota de evidências: `/admin/readiness` diferencia configuração presente de homologação comprovada. Os registros são manuais e sanitizados; servem como checklist operacional, não substituem logs reais da Railway, Stripe, Redis ou R2. Não salvar secrets, tokens, URLs assinadas, cartão, CPF real, e-mail real, payload Stripe/webhook ou dados pessoais.

## 5. Como validar depois do deploy

Comandos PowerShell:

```powershell
npx prisma migrate status
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

- [ ] Railway Production com envs revisadas.
- [ ] Railway Staging/Homologação com envs separadas.
- [ ] `npx prisma migrate deploy` aplicado no banco correto para criar `OperationalEvidence`.
- [ ] Redis/Upstash ativo em produção.
- [ ] `/api/health` sem `status: "error"`.
- [ ] R2 ativo e uploads carregando em domínio público.
- [ ] Checklist de variantes de mídia aprovado em staging.
- [ ] Mídias legadas pesadas triadas com `npm run media:variants:audit`.
- [ ] Melhor Envio cotando frete real.
- [ ] Produtos ativos completos, com estoque e dimensões.
- [ ] Stripe test mode aprovado ponta a ponta.
- [ ] Webhook test assinado validado.
- [ ] Pedido pago test mode visível no Admin.
- [ ] Reserva de estoque baixa ao pagar.
- [ ] Reserva expirada/cancelada é liberada.
- [ ] Evidências operacionais críticas registradas no Admin sem dados sensíveis.
- [ ] Smoke público online sem `FAIL`.
- [ ] Cliente autoriza produção limitada.
- [ ] `CHECKOUT_ENABLED=true` aplicado em Production somente após aprovação.

## 8. Avisos de segurança

- Não enviar secrets por chat aberto.
- Não commitar `.env`.
- Não usar `sk_live_` em staging/local.
- Não usar banco de produção para smoke.
- Não usar `prisma migrate dev` nem shadow DB de produção em Production.
- Não desativar verificação de assinatura do webhook.
- Não ativar checkout live antes da homologação.
- Não trocar R2 por outro storage sem nova validação.
- Não transformar CSP Report-Only em enforcement nesta entrega.
