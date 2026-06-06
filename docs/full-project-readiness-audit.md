# Auditoria completa de prontidão — RARE

Data da auditoria: 2026-06-06.

Escopo: código local, Git, documentação, scripts, testes, banco local, Admin, APIs, checkout, frete, SEO, segurança, mídia, catálogo, deploy e o site público `https://raredept.com.br`.

Restrições respeitadas nesta auditoria:

- Nenhum pagamento foi executado.
- Nenhum pedido foi criado.
- Nenhuma chamada Stripe real foi feita.
- Nenhum endpoint de checkout foi chamado.
- Nenhum cron foi acionado.
- Nenhum upload real foi feito.
- Nenhuma env real foi alterada.
- Nenhuma migration destrutiva foi criada.
- A migration aditiva `20260606182000_operational_evidence` existe para a tabela `OperationalEvidence`.
- Nenhuma alteração de banco de produção foi executada.
- Nenhum secret foi exibido.

## Atualização de higiene do repositório

Em 2026-06-06, as pendências locais de código e documentação desta auditoria foram resolvidas:

- `src/app/admin/(protected)/page.test.ts` foi revisado e passou a validar explicitamente que o resumo de readiness não renderiza valores sensíveis de teste.
- `CHECKLIST_STRIPE_HOMOLOGATION.md` foi reduzido a um aviso legado que aponta para o guia canônico `docs/checkout-smoke-test.md`.
- `docs/final-release-audit.md` foi marcado como histórico e aponta para este relatório.
- Este relatório permanece como checklist atual de evidências; não foi criado `docs/production-evidence-checklist.md` para evitar uma terceira fonte duplicada.
- `/admin/readiness` passou a registrar evidências operacionais manuais e sanitizadas em tabela aditiva, diferenciando configuração presente de homologação comprovada.
- `/admin/readiness` degrada com aviso sanitizado se a tabela `OperationalEvidence` ainda não existir no ambiente, bloqueando venda aberta até `npx prisma migrate deploy`.
- `docs/deploy-with-migrations.md` documenta a ordem segura de deploy com migrations.

Esses ajustes não alteram os bloqueadores operacionais P0 descritos abaixo.

## 1. Resumo executivo

O site público está funcional e a base de código está tecnicamente sólida: lint, typecheck, 434 testes, build, Prisma, migrations, smoke público, SEO essencial, rotas, R2 público e cotação Melhor Envio passaram nas validações possíveis sem credenciais administrativas.

O projeto ainda não está 100% pronto para venda aberta.

Principais motivos:

1. Produção ainda usa `RATE_LIMIT_DRIVER=memory`, sem Redis/Upstash compartilhado.
2. Não existe evidência acessível de homologação Stripe test-mode ponta a ponta com webhook assinado, pedido pago no Admin, baixa de estoque e liberação de reserva.
3. Produção informa `CHECKOUT_ENABLED=true`; isso precisa ser uma decisão consciente do cliente enquanto a homologação não está aprovada.
4. A cron de liberação de reservas está configurada uma vez ao dia e não houve acesso aos logs da Vercel para provar execução bem-sucedida.
5. O projeto Vercel secundário `rare-hjw3` continua gerando check falho, embora o projeto oficial `rare` tenha concluído o deploy.

Recomendação: pronto para staging/homologação. Produção atual está pública e funcional, mas produção limitada com vendas e venda aberta permanecem bloqueadas até fechar os itens P0.

## 2. Resultado por ambiente

| Ambiente | Status | Conclusão |
| --- | --- | --- |
| Local | OK com warnings de dados/configuração | Código validado. Storage local, frete fixo legado, produtos locais sem dimensões e shadow DB contaminado são pendências locais conhecidas. |
| Staging/homologação | Pronto para configurar e homologar | Requer banco isolado, Stripe test, webhook test, R2, Melhor Envio e Redis próprios do ambiente. |
| Produção atual | Funcional com warning operacional | Site, catálogo, SEO, R2 e frete respondem; health está `ok_with_warnings` por rate limit em memória. |
| Produção limitada com vendas | Bloqueada | Exige Redis compartilhado, homologação Stripe aprovada, decisão sobre checkout e evidência de reserva/cron. |
| Venda aberta | Bloqueada | Falta prova operacional completa de pagamentos, estoque, reservas e autorização do cliente. |

## 3. O que está OK

- `main` está limpa localmente e à frente de `origin/main` com commits pré-push de evidência operacional segura e documentação de readiness.
- O repositório GitHub `raredept/rare` está público.
- O projeto oficial Vercel `rare` concluiu o deploy público anterior; após o push, precisa redeployar o commit pré-push atual.
- Home, catálogo, categorias, produtos e páginas institucionais testadas respondem `200`.
- Produto e categoria inexistentes respondem `404` real.
- `/minha-conta`, `/admin` e `/admin/readiness` redirecionam para login sem sessão.
- `robots.txt` e `sitemap.xml` respondem `200`.
- Sitemap não inclui Admin, APIs, checkout, conta ou pedidos privados.
- Canonical absoluto, Open Graph, Twitter Cards e imagens sociais seguras estão presentes.
- Home possui JSON-LD `Organization`.
- Produtos testados possuem JSON-LD `Product` e `BreadcrumbList`.
- `/entrar` e `/cadastro` usam `noindex, nofollow`.
- Headers de segurança estão presentes, incluindo CSP Report-Only.
- `/api/health` é sanitizado e não expõe secrets.
- Banco local conecta e as migrations estão aplicadas.
- Checkout exige cliente autenticado e CPF válido.
- Preço, estoque, frete e total são recalculados no backend.
- Reserva e baixa de estoque usam transações e movimentos de inventário.
- Webhook Stripe exige assinatura e possui idempotência por evento.
- Eventos pagos, falhos e expirados possuem tratamento de estoque/reserva.
- Rota cron exige `Authorization: Bearer` com `CRON_SECRET`.
- Cotação pública retornou opções reais Correios PAC e SEDEX via Melhor Envio.
- Produção informa CEP de origem configurado e zero produtos ativos sem dimensões.
- R2 público respondeu `200` com cache imutável.
- Admin bloqueia ativação de produto sem peso e dimensões.
- Pendências de catálogo têm links diretos para correção.
- Upload ativo do Admin usa `/api/admin/uploads`, sessão Admin, rate limit e limite de 4 MB.
- Cards não carregam MP4 como mídia principal pesada.
- Zoom de produto funciona acima do header, usa portal no `body`, respeita viewport e fecha com Escape.
- Produtos testados não apresentaram overflow horizontal no viewport mobile.
- Home e `/categoria/tudo` não apresentaram erros de console no Browser.
- Varredura dos arquivos versionados encontrou apenas placeholders e fixtures de secrets.

## 4. Bloqueadores para venda aberta

### P0.1 — Rate limit compartilhado ausente

- Status: bloqueador confirmado.
- Evidência: `/api/health` informa `configuredDriver=memory`, `activeDriver=memory` e `shared=false`.
- Impacto: proteção contra abuso não é consistente entre múltiplas instâncias da Vercel.
- Correção: configurar `RATE_LIMIT_DRIVER=redis` e credenciais Redis REST/Upstash em Production, fazer redeploy e validar o health.
- Responsável: cliente.
- Validação: `curl.exe https://raredept.com.br/api/health` e confirmar `activeDriver=redis`, `shared=true`.

### P0.2 — Homologação Stripe ponta a ponta não comprovada

- Status: pendente por acesso externo.
- Evidência: o guard local bloqueou corretamente; não há evidência acessível de sessão Stripe test, webhook assinado, pedido pago no Admin e movimentos `reserve`, `sale` e `release`.
- Impacto: não é possível afirmar que pagamentos e estoque funcionam operacionalmente fora dos testes automatizados.
- Correção: executar `docs/checkout-smoke-test.md` em staging isolado, somente com Stripe test mode.
- Responsável: ambos.
- Validação: guard aprovado, evento webhook `200`, pedido pago no Admin, estoque baixado e reserva liberada em falha/expiração.

### P0.3 — Checkout ativo em produção sem aprovação documentada

- Status: risco operacional confirmado.
- Evidência: `/api/health` informa `checkoutEnabled=true`.
- Impacto: clientes podem chegar ao fluxo de compra antes de a homologação operacional estar formalmente aprovada.
- Correção: manter `CHECKOUT_ENABLED=false` até aprovação ou documentar a autorização consciente para produção limitada.
- Responsável: cliente.
- Validação: health após redeploy e aprovação registrada no checklist de go-live.

### P0.4 — Liberação de reservas sem prova operacional

- Status: pendente por acesso externo.
- Evidência: a rota está protegida e `vercel.json` agenda `0 3 * * *`, mas não houve acesso aos logs da cron.
- Impacto: se o webhook de expiração falhar, reservas podem permanecer presas até a execução de segurança.
- Observação: no plano Hobby, a Vercel limita cron a uma execução diária e não garante precisão dentro da hora. A Vercel também não faz retry automático de cron falha.
- Correção: validar logs e uma reserva expirada em staging. Se retenção de até aproximadamente 24 horas for inaceitável para estoque limitado, usar plano/agendador que permita frequência maior.
- Responsável: cliente, com validação do dev.
- Validação: logs da cron e movimento `release` para pedido expirado.

### P0.5 — Autorização final de go-live ausente

- Status: pendente por decisão do cliente.
- Evidência: não há registro de aprovação após Redis, Stripe, webhook, estoque, upload e cron.
- Impacto: venda aberta não deve ser inferida apenas por build e smoke público.
- Correção: concluir o checklist desta auditoria e registrar autorização.
- Responsável: cliente.

## 5. Pendências por acesso do cliente

- Criar/configurar Redis/Upstash em Production.
- Executar Stripe test-mode smoke em staging isolado.
- Validar webhook test e, depois, webhook live separado.
- Confirmar pedido pago no Admin.
- Confirmar movimentos de estoque e reserva.
- Confirmar execução e logs da cron.
- Validar upload autenticado de produto e banner no R2.
- Resolver ou desconectar o projeto Vercel secundário `rare-hjw3`.
- Confirmar se o projeto oficial `rare` está no plano e região pretendidos.
- Decidir conscientemente o valor de `CHECKOUT_ENABLED` em Production.
- Autorizar produção limitada e venda aberta.

## 6. Warnings atuais

### Produção

- `/api/health` está `ok_with_warnings` por rate limit em memória.
- O check do commit está `1/2`: `Vercel – rare` passou; `Vercel – rare-hjw3` falhou.
- Cron diária é apenas uma rede de segurança lenta para reservas; depende de webhook confiável.
- O Admin readiness avalia presença/coerência de configuração e agora também registra evidências operacionais manuais/sanitizadas; ainda assim, os registros não substituem logs reais de Stripe, Vercel, Redis ou R2.
- Se a migration `OperationalEvidence` ainda não tiver sido aplicada em um ambiente, `/admin/readiness` deve carregar com warning e bloquear venda aberta, sem expor stacktrace ou SQL.
- A imagem principal antiga de `Supreme Bag` continua sendo um PNG de aproximadamente 2,86 MB até ser substituída ou receber variantes reais.
- `/admin/readiness` agora também pode sinalizar mídia legada sem variantes como warning de performance, sem bloquear venda aberta sozinho.
- `ProductMedia` usa um plano central por contexto, dimensões, loading, decoding e prioridade corretos. Novos uploads server-routed elegíveis persistem thumbnail 640 e medium 1200; URLs antigas continuam usando o original, sem `srcSet` falso.

### Local

- `STORAGE_DRIVER=local`, apropriado apenas para desenvolvimento.
- Configuração local usa frete fixo legado/provisório.
- 10 produtos locais estão sem peso/dimensões; 5 deles estão ativos e usam fallback.
- Shadow database contém objetos da aplicação e deve ser recriado/limpo antes de uma nova `prisma migrate dev`.
- A mudança local de `src/app/admin/(protected)/page.test.ts` foi revisada e incorporada à atualização de higiene do repositório.

### Documentação

- Documentos principais estão coerentes com staging, Redis, Stripe e venda aberta.
- `docs/final-release-audit.md` é histórico de 2026-06-04, contém contagem antiga de 378 testes e agora aponta explicitamente para este documento.
- `CHECKLIST_STRIPE_HOMOLOGATION.md` agora é apenas um aviso legado; `docs/checkout-smoke-test.md` é a única fonte operacional canônica.
- `docs/production-evidence-checklist.md` não existe por decisão consciente; o checklist deste relatório cobre essa finalidade sem duplicação.

## 7. Melhorias futuras

Nenhuma correção funcional de código foi identificada como P0 nesta auditoria. Os bloqueadores de venda aberta são configuração, homologação e evidência operacional. As mudanças de código restantes são melhorias de performance, observabilidade e prevenção de conclusão indevida.

### P2 — Operação e qualidade

- Reenviar seletivamente mídia antiga pesada ou criar um job futuro explícito para backfill; novos uploads server-routed elegíveis já geram variantes WEBP.
- Padronizar a origem pública de mídia antes de avaliar `next/image` ou CDN de transformação para URLs legadas.
- Persistir no Admin evidências operacionais de homologação, sem secrets.
- Adicionar monitoramento de falhas de webhook, cron e rate limit compartilhado.
- Consolidar os dois documentos de homologação Stripe.
- Limpar/recriar o shadow database local.

### P3 — SEO, conversão e evolução

- Enriquecer JSON-LD Product com `brand`, `sku` e, quando aplicável, `priceValidUntil`.
- Medir Core Web Vitals e Lighthouse mobile após otimização de mídia.
- Avaliar domínio/CDN próprio para mídia pública.
- Converter CSP de Report-Only para enforcement somente após observar violações reais.
- Avaliar noindex explícito para páginas operacionais públicas como `/finalizar-compra` e `/pedidos`.
- Considerar carteiras digitais e melhorias de conversão somente após homologar o fluxo atual.

## 8. Evidências coletadas

### Git

Estado observado na revisão pré-push:

```text
Branch: main
HEAD local: à frente de origin/main
origin/main: 3d62e2e no início da revisão pré-push
Commits locais não enviados: 2
Worktree: limpo
```

Commits locais pendentes de push:

```text
Add safe readiness evidence migration
Document pre-push readiness state
Classificação: válido para push após validações finais.
Risco de secret: não; contém nomes de variáveis, fixtures falsas e mensagens sanitizadas.
```

### Validações locais

| Comando | Resultado |
| --- | --- |
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm test` | OK — 77 arquivos, 434 testes |
| `npm run build` | OK |
| `git diff --check` | OK; somente aviso LF/CRLF |
| `npm run media:variants:audit` | OK dry-run — 10 mídias locais, 0 com variantes, 5 candidatas a reupload, 10 sem tamanho conhecido, sem rede externa |
| `npm test -- media-variant image-variant storage` | OK — 3 arquivos, 35 testes |
| `npm test -- operational-evidence admin-readiness readiness` | OK — 4 arquivos, 26 testes |
| `npx prisma validate` | OK |
| `npx prisma migrate status` | OK — schema atualizado no banco local |
| `npm run db:check` | OK com warning de shadow DB |
| `npm run app:check` | OK sem erro bloqueante, com warnings locais |
| `npm run shipping:dimensions:audit` | 10/10 produtos locais sem dimensões |
| `npm run checkout` | Bloqueado pelo guard, comportamento esperado |

Resultado seguro do guard:

```text
Stripe mode: test
Ambiente: development
App: localhost
Banco: local
Bloqueios: CHECKOUT_ENABLED não habilitado e webhook test ausente
```

### Smoke público

```text
npm run smoke -- https://raredept.com.br
18 OK
1 WARNING
0 FAIL
```

Warning:

```text
health:app-status = ok_with_warnings
```

### Rotas públicas

| Rota | Resultado |
| --- | --- |
| `/` | 200 |
| `/robots.txt` | 200 |
| `/sitemap.xml` | 200 |
| `/produto/nao-existe` | 404 |
| `/categoria/nao-existe` | 404 |
| `/categoria/tudo` | 200 |
| `/categoria/camisetas` | 200 |
| `/categoria/jaquetas` | 200 |
| `/categoria/acessorios` | 200 |
| `/categoria/bags` | 200 |
| Produtos reais testados | 200 |
| Páginas institucionais testadas | 200 |
| `/entrar` e `/cadastro` | 200, noindex |
| `/minha-conta` | 307 para login |
| `/admin` e `/admin/readiness` | 307 para login Admin |

### Health de produção

```text
status: ok_with_warnings
database: ok
checkoutEnabled: true
storageDriver: r2
rateLimit: memory, shared=false
shippingProvider: melhor_envio
originCepConfigured: true
activeProductsMissingDimensions: 0
configurationErrors: 0
```

### Produto, mídia e frete

- `Supreme Bag` e `Jaqueta Puffer` foram validados em desktop e mobile.
- Título, descrição, preço, variação, quantidade, carrinho visual e frete estão presentes.
- Não existe duplicação visível de “Detalhes > Descrição”.
- Zoom usa portal no `body`, `position: fixed`, `z-index: 90` e altura igual à viewport.
- Escape fecha o zoom.
- Mobile não apresentou overflow horizontal.
- CEP genérico `01001-000` retornou:
  - Correios PAC: R$ 31,32, até 7 dias úteis.
  - Correios SEDEX: R$ 42,57, até 2 dias úteis.
- Mídia R2 testada respondeu `200` com `Cache-Control: public, max-age=31536000, immutable`.

### Deploy

```text
Commit online antes do próximo push: origin/main atual (3d62e2e na revisão)
Commits locais pré-push: evidência operacional segura e documentação de readiness
Vercel – rare: deployment anterior concluído
Vercel – rare-hjw3: Deployment has failed
Domínio oficial raredept.com.br: online; precisa validar novamente após push/redeploy
```

## 9. Auditoria por área

### Git/deploy

- Branch local limpa, com 1 commit pendente de push.
- Mudanças de readiness/evidência foram revisadas, validadas e commitadas.
- Projeto oficial está online.
- Projeto secundário continua gerando ruído de CI/deploy.

### Env/Vercel

- Produção possui banco, R2, Stripe/webhook e Melhor Envio suficientes para health sem erro de configuração.
- Rate limit compartilhado está ausente.
- Não houve acesso ao painel para confirmar envs, plano, logs ou cron.

### Health

- Endpoint válido, sanitizado e com HTTP 200.
- Único warning explícito: rate limit em memória.
- Health não comprova execução real de Stripe, webhook, upload ou cron.

### SEO

- Robots, sitemap, canonical, OG, Twitter, 404 e JSON-LD essenciais estão ativos.
- Auth está noindex.
- Enriquecimento de schema e noindex de páginas operacionais são melhorias futuras.

### Produto/UX

- Fluxo visual principal funciona em desktop/mobile.
- Zoom corrigido e validado.
- Imagens grandes sem transformação responsiva são o principal warning de performance.

### Catálogo/Admin

- Regras de ativação, estoque, mídia, variações e dimensões existem.
- Pendências de catálogo apontam para edição.
- Readiness não expõe secrets.
- Falta validação autenticada do Admin em produção e evidência operacional persistida.

### Checkout/Stripe

- Código preparado e testes automatizados passam.
- Backend é autoritativo.
- Webhook é assinado e idempotente.
- Homologação externa ainda é obrigatória.

### Frete/Melhor Envio

- Produção usa Melhor Envio, CEP de origem configurado e catálogo ativo sem dimensões ausentes.
- PAC e SEDEX foram cotados com sucesso.
- Warnings de fallback pertencem ao banco local, não à produção atual.

### R2/upload/mídia

- R2 público funciona e usa cache imutável.
- Upload server-side ativo está protegido e limitado a 4 MB.
- Presign R2 existe no backend, mas o cliente atual não o chama.
- Upload autenticado real continua pendente por acesso.
- JPG/JPEG/PNG/WEBP/AVIF estáticos elegíveis no upload server-routed preservam o original e persistem thumbnail 640 e medium 1200 em WEBP.
- GIF e MP4 preservam o original. Presign direto continua sem variantes porque não passa pelo backend.
- O banco continua guardando a URL original; uma convenção versionada de key permite derivar apenas variantes que foram realmente geradas, sem migration.
- Mídia antiga não é reprocessada automaticamente e continua usando fallback para o original.
- `npm run media:variants:audit` lista mídia legada em produtos e banners em dry-run; por padrão não chama R2, não faz HEAD remoto, não apaga, não substitui URL e mascara querystrings/tokens no console.
- `/admin/readiness` possui evidência `admin_r2_upload` para registrar a homologação manual de upload em staging, sem executar upload automaticamente.

### Segurança

- Headers essenciais presentes.
- CSP está em Report-Only por decisão explícita.
- Admin, uploads e cron estão protegidos.
- Checkout/CPF exigem autenticação no código e testes.
- Webhook rejeita assinatura ausente/inválida.
- Nenhum secret real foi encontrado nos arquivos versionados ou respostas públicas verificadas.

### Docs/scripts

- Scripts documentados existem.
- Smoke público é read-only.
- Checkout é somente guard.
- Auditoria de variantes de mídia é read-only e não usa rede externa por padrão.
- Evidências operacionais no Admin são submissões manuais protegidas por sessão Admin e rejeitam padrões de secrets/dados sensíveis em notas.
- Deploy com migrations está documentado em `docs/deploy-with-migrations.md`; produção deve usar `npx prisma migrate deploy`, não `prisma migrate dev`.
- Scripts mutáveis são explicitamente nomeados e não rodam por padrão.
- Documentação principal é coerente; há duplicação parcial no checklist Stripe da raiz.

### Banco/Prisma

- Schema válido e migrations aplicadas.
- Banco principal local íntegro.
- `OperationalEvidence` é aditiva e possui fallback defensivo no Admin enquanto a tabela estiver ausente em algum ambiente.
- Shadow DB precisa limpeza antes de migrations futuras.
- Nenhuma alteração de banco de produção foi feita nesta auditoria.

### Cron/reservas

- Código de liberação existe e está protegido.
- Webhook trata expiração e falha.
- Cron é fallback diário.
- Execução real e frequência aceitável ainda precisam de validação operacional.

## 10. Checklist para chegar a 100%

### Matriz priorizada

| Prioridade | Item | Por que importa | Evidência | Ação | Responsável | Como validar | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | Redis/Upstash em Production | Rate limit precisa ser compartilhado entre instâncias. | Health: `memory`, `shared=false`. | Configurar Redis REST e redeploy. | Cliente | `/api/health` com `redis`, `shared=true`. | Bloqueado |
| P0 | Migration `OperationalEvidence` por ambiente | Sem a tabela, não é possível registrar evidências de go-live. | Migration aplicada só no banco local; produção depende de operador com acesso ao banco. | Rodar `npx prisma migrate deploy` no banco correto antes ou junto do deploy. | Cliente/DevOps | `npx prisma migrate status` e `/admin/readiness` sem warning de tabela ausente. | Pendente por ambiente |
| P0 | Stripe test-mode ponta a ponta | Testes unitários não provam o fluxo externo. | Sem evidência de sessão, webhook, pedido pago e estoque. | Executar runbook em staging isolado. | Ambos | Pedido pago e movimentos `reserve`, `sale`, `release`. | Pendente externo |
| P0 | Decisão sobre checkout em Production | Checkout está ativo antes da aprovação documentada. | Health: `checkoutEnabled=true`. | Desabilitar ou autorizar conscientemente. | Cliente | Health e checklist aprovados. | Pendente decisão |
| P0 | Reserva e cron | Estoque pode ficar preso se webhook falhar. | Cron diária sem logs acessíveis. | Validar cron e aceitar/melhorar frequência. | Ambos | Log de execução e movimento `release`. | Pendente externo |
| P1 | Upload Admin/R2 autenticado | Operação do catálogo depende de upload real. | R2 público funciona; upload Admin não foi executado. | Testar produto e banner com sessão Admin. | Cliente | Upload, persistência e renderização após redeploy. | Pendente externo |
| P1 | Projeto `rare-hjw3` | Mantém check vermelho e confunde deploy oficial. | Check Vercel secundário falhou. | Desconectar/remover integração duplicada. | Cliente | Commit com apenas checks esperados. | Pendente externo |
| P1 | Mudança local de teste | Worktree precisava de decisão consciente. | `page.test.ts` foi revisado, reforçado e validado. | Manter no commit de higiene/readiness. | Dev | Teste direcionado e validações gerais. | Resolvido |
| P2 | Otimização de mídia antiga | PNG antigo de 2,86 MB ainda prejudica mobile e Core Web Vitals. | Novos uploads elegíveis já persistem thumbnail/medium/original; mídia legada mantém fallback e pode ser listada por dry-run. | Rodar `npm run media:variants:audit`, reenviar seletivamente mídia pesada em staging e só repetir em produção com autorização. | Dev/Cliente | `srcSet` real no HTML, Lighthouse e bytes transferidos menores. | Parcial para legado |
| P2 | Evidência no Admin readiness | Configuração presente não prova homologação executada. | Readiness agora registra evidências manuais/sanitizadas, sem executar integrações reais. | Preencher evidências críticas em staging/produção conforme runbooks. | Cliente/Dev | Admin distingue “configurado”, “homologado” e “aprovado pelo cliente”. | Implementado no código; pendente preencher evidências |
| P2 | Documentação Stripe duplicada | Dois guias podiam divergir. | Checklist raiz foi reduzido a ponteiro legado. | Manter `docs/checkout-smoke-test.md` como única fonte operacional. | Dev | Referências documentais apontam para o guia canônico. | Resolvido |
| P3 | SEO estruturado | Pode melhorar rich results. | Product JSON-LD não inclui `brand`, `sku`, `priceValidUntil`. | Enriquecer schema com dados reais. | Dev | Rich Results Test sem warnings relevantes. | Futuro |
| P3 | CSP enforcement e observabilidade | Report-Only não bloqueia violações. | Header atual é Report-Only. | Coletar relatórios e ativar enforcement gradualmente. | Ambos | CSP sem regressões e logs monitorados. | Futuro |

- [ ] Redis/Upstash production
- [ ] Migration `OperationalEvidence` aplicada no banco correto
- [ ] Health sem warnings críticos
- [ ] Checkout mode decidido
- [ ] Stripe test-mode smoke aprovado
- [ ] Webhook validado
- [ ] Pedido pago no Admin
- [ ] Estoque/reserva validado
- [ ] Expiração/falha gera movimento `release`
- [ ] Upload Admin/R2 validado
- [ ] Upload de variantes de mídia homologado em staging
- [ ] `npm run media:variants:audit` revisado sem tratar legado como falha
- [ ] Cron validada
- [ ] Evidências operacionais críticas registradas no Admin
- [ ] Frequência da cron aceita ou melhorada
- [ ] Projeto Vercel secundário resolvido
- [ ] Smoke público com 0 FAIL
- [x] Mudança local de teste revisada e incorporada conscientemente
- [ ] Cliente autorizou produção limitada
- [ ] Cliente autorizou go-live

Ordem exata recomendada:

1. Cliente decide se checkout deve permanecer ativo agora.
2. DevOps aplica `npx prisma migrate deploy` no banco correto.
3. Cliente configura Redis/Upstash em Production.
4. Dev valida health, `/admin/readiness` e smoke público após redeploy.
5. Cliente prepara staging isolado com Stripe test e webhook test.
6. Ambos executam o checkout smoke completo.
7. Ambos validam pedido pago, estoque, reserva e liberação.
8. Cliente valida upload Admin/R2 autenticado.
9. Cliente valida logs da cron e aceita a frequência diária ou altera plano/agendador.
10. Cliente resolve `rare-hjw3`.
11. Dev repete lint, typecheck, testes, build e smoke público.
12. Cliente autoriza produção limitada.
13. Após monitoramento sem incidentes, cliente autoriza venda aberta.

## 11. Recomendação final

**Pronto para staging/homologação. Produção atual funcional com ressalvas. Bloqueado para produção limitada com vendas e para venda aberta até fechar Redis, Stripe/webhook/estoque, cron e aprovação do cliente.**
