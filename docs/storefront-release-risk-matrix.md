# Matriz de risco do release candidate do storefront

Escopo: revisão local do candidato iniciado em `bd1adad`, com checkout e integrações
comerciais desabilitados. `Bloqueador` significa que o preview não deve ser publicado
na condição descrita; uma pendência externa seguramente isolada pode permanecer como
warning sem bloquear o catálogo.

| Área | Mudança | Probabilidade | Impacto | Detecção | Mitigação | Rollback | Responsável pela validação | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Next.js 16.2.10 | Patch do framework e build standalone | Baixa | Alto | Unitários, E2E, build e Lighthouse | Versão registrada no lockfile; sem upgrade principal neste ciclo | Reimplantar código anterior | Engenharia | Aprovado local |
| React 19.2.4 | Runtime do storefront | Baixa | Alto | Typecheck, render tests, console/hydration E2E | Console estrito e error boundaries | Reimplantar código anterior | Engenharia/QA | Aprovado local |
| Dependências atualizadas | Next, ESLint, tsx, Vitest e overrides transitivos | Baixa | Médio | `npm audit`, suíte e build | Atualizações conservadoras; sem `audit fix --force` | Reverter commit de dependências e lockfile | Engenharia | Aprovado local |
| Design system | Tokens, botões, inputs e shells do storefront | Média | Médio | Axe, teclado, visual desktop/mobile | Sem nova rodada visual; mudanças já cobertas | Reimplantar versão anterior | QA | Pendente QA visual de preview |
| Menu mobile | Drawer, trap de foco, Escape e retorno de foco | Média | Alto | Playwright mobile, teclado e Axe | Teste dedicado e navegação sem JS comercial | Reverter componente de navegação | QA | Aprovado automatizado; iPhone pendente |
| Carrossel Home | Controles e indicadores com alvo real mínimo de 24 px | Baixa | Médio | Teste determinístico, mobile e Lighthouse | Aparência interna preservada; botão ampliado sem sobreposição | Reverter alteração isolada | QA/Acessibilidade | Corrigido; remedição Lighthouse pendente |
| Imagens otimizadas | Variantes, `srcSet`, prioridade LCP e fallback | Média | Alto | Render tests, E2E, Lighthouse e orçamento | Original preservado; backfill dry-run por padrão | Voltar ao render anterior; não apagar originais | Engenharia/QA | Aprovado local |
| Metadata | Canonical e social metadata sanitizada | Baixa | Alto | Unitários e smoke de release | Canonical fixo sem host Railway/local em produção | Reimplantar código anterior | SEO/Engenharia | Aprovado local |
| Robots | Produção indexável; preview/local `noindex` e `Disallow: /` | Média | Alto | Unitários e smoke por ambiente | Fail-closed fora do domínio canônico | Corrigir env e reimplantar | SEO/Operação | Aprovado local; confirmar no preview |
| Sitemap | Rotas públicas e catálogo ativo, sem privadas/técnicas | Baixa | Médio | Unitários, crawler e smoke | Allowlist de rotas e exclusão por prefixo | Reimplantar versão anterior | SEO | Aprovado local |
| JSON-LD | Product, Organization, WebSite e breadcrumbs | Baixa | Médio | Unitários e smoke | `Product.offers` depende de checkout explícito | Reverter structured data | SEO/Engenharia | Aprovado local |
| Carrinho pausado | CTA comercial removido/desabilitado | Baixa | Alto | Render tests e smoke | Estado comercial propagado pelo layout | Reimplantar código anterior | QA | Aprovado local |
| Checkout desativado | Flag agora falha fechada quando ausente | Baixa | Bloqueador | Unitários, API e smoke | Somente `CHECKOUT_ENABLED=true` ativa; preview exige `false` | Reimplantar safeguard; nunca habilitar para rollback | Engenharia/Operação | Bloqueador corrigido |
| Frete desativado | API de cotação retorna antes de banco/provider | Baixa | Bloqueador | Teste prova zero acesso a settings, banco e `fetch` | Gate por checkout antes de rate limit/provider | Reimplantar safeguard | Engenharia | Bloqueador corrigido |
| Frete fixo legado | Configuração ainda existe no banco | Média | Médio | Readiness e inspeção de settings | Inofensivo com checkout/frete fechados | Manter flag off; não migrar dados no rollback | Operação | Warning não bloqueante para catálogo |
| Cinco produtos sem dimensões | Não atendem frete automático | Alta | Alto quando frete ativo | `shipping:dimensions:audit` | Frete automático e checkout desligados | Manter features desligadas | Catálogo/Operação | Warning; bloqueia futura ativação de frete |
| Login e cadastro | Shell, formulário, senha visível e foco | Média | Alto | Unitários, Axe, teclado, E2E e console | Noindex e validação server-side preservados | Reimplantar versão anterior | QA/Engenharia | Aprovado automatizado |
| PWA e manifest | Manifest e ícones essenciais | Baixa | Médio | Unitários e smoke | Assets versionados e sem cache offline do storefront | Reimplantar manifest anterior | QA | Aprovado local |
| Service worker Admin | Push restrito ao escopo `/admin/` | Baixa | Alto | Unitários, inspeção do escopo e smoke de acesso | Sem cache do storefront; VAPID ausente desabilita Push | Remover registro/voltar deploy | Engenharia | Automatizado; dispositivo real pendente |
| Error boundaries | `error`, `global-error`, 404 e fallback | Baixa | Alto | Unitários, resilience E2E e smoke 404 | Mensagens sanitizadas e observabilidade sem PII | Reimplantar versão anterior | Engenharia/QA | Aprovado local |
| Redis | Rate limit compartilhado | Média | Alto | `app:check` e `/api/health` | Preview deve usar instância separada | Voltar ao serviço Redis anterior do mesmo ambiente | Operação | Produção não revalidada neste ciclo; preview pendente |
| Cron | Liberação de reservas via Railway | Média | Alto se checkout ativo | Config-as-code, logs e execução manual autorizada | Desabilitar/isolar cron no preview; checkout off | Desativar cron e reimplantar app anterior | Operação | Warning: `vercel.json` legado requer confirmação |
| PostgreSQL Railway | Datasource de produção e migrations em pre-deploy | Média | Bloqueador | `db:check`, Prisma validate/status e health | Banco de preview separado; migrations não destrutivas | Rollback somente de app; restaurar DB apenas por plano próprio | DBA/Operação | Preview isolado ainda não provisionado |
| Shadow database local | Objetos extras podem gerar warning | Média | Baixo | `prisma migrate status` e `db:check` | Não usar shadow local como prova de produção | Recriar shadow separado a partir de template limpo | Engenharia | Warning local conhecido |
| Storage | Local em dev; R2 esperado em deploy | Média | Alto | `app:check`, upload smoke autorizado e health | Bucket/prefixo e credenciais separados por ambiente | Voltar ao bucket/config anterior, sem apagar objetos | Operação | Bloqueador se preview usar filesystem mutável |
| Backfill preparado | Script pode escrever banco e R2 com `--apply` | Baixa | Alto | Guard de produção, dry-run e testes | Default dry-run; apply de produção exige duas confirmações | Interromper lote; referências concorrentes protegidas | Operação/Engenharia | Desabilitado; não executado |
| Melhor Envio preparado | Provider sandbox/produção ainda não homologado | Baixa com flags off | Alto | Gate de API, env guard e homologação futura | `SHIPPING_ENABLED=false`, checkout off, token vazio | Remover envs e manter provider manual | Operação | Não bloqueia catálogo; bloqueia frete real |
| Stripe preparado | Checkout/webhook ainda sem homologação deste RC | Baixa com flag off | Bloqueador se ativo | Flag guard, webhook assinado e smoke futuro test-mode | Chaves vazias no preview; checkout off | Remover envs e manter flag off | Operação/Financeiro | Não bloqueia catálogo; bloqueia vendas |
| E-mail preparado | Templates sem provider | Baixa | Médio | Unitários e `EMAIL_DRIVER` | Driver `disabled`; nenhum envio no smoke | Manter driver desabilitado | Operação | Não bloqueia catálogo |
| Web Push | Cadastro Admin e SW disponíveis | Baixa | Médio | Unitários; dispositivo real futuro | Sem VAPID/subscription real no preview do RC | Remover chaves e subscriptions do ambiente | Operação | Desabilitado; iPhone pendente |
| CSP ausente | Sem enforcement nesta etapa | Média | Médio | Revisão de headers e plano técnico | Headers atuais mantidos; futuro Report-Only com endpoint | Remover policy problemática | Segurança/Engenharia | Warning documentado; não bloqueia catálogo pausado |
| Observabilidade frontend | Erro sanitizado sem payload/PII | Baixa | Médio | Unitários e teste de console | Somente tipo/contexto permitido | Reimplantar código anterior | Engenharia | Aprovado local |
| Vercel cron legado | `vercel.json` ainda lista cron histórico | Média | Médio | `release:guard` emite warning | Confirmar projeto Vercel inativo antes do preview/push | Desativar integração externa ou remover config em ciclo autorizado | Operação | Warning externo não verificado |

## Bloqueadores objetivos do preview

- Banco, Redis, storage, URL e secrets não isolados de produção.
- `CHECKOUT_ENABLED` diferente de `false`, Stripe live presente ou frete real acessível.
- Preview indexável, build/suíte/smoke falhando ou health com erro.
- Cron ou webhook compartilhado com produção.

As integrações Stripe, Melhor Envio, e-mail e Push não bloqueiam o preview de catálogo
quando permanecem comprovadamente desabilitadas; elas bloqueiam somente a ativação da
funcionalidade correspondente.
