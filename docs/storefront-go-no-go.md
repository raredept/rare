# Go/no-go do storefront

Este documento separa revisão local, preview e produção. Nenhuma etapa autoriza push,
deploy, DNS, migration, pagamento ou serviço externo.

## Estados possíveis

### `READY FOR LOCAL RELEASE REVIEW`

Pode ser declarado quando o HEAD local passou por revisão consolidada, release guard,
suíte, build, Prisma, audit, Lighthouse e smoke local. Pendências de ambiente continuam
abertas e o estado não autoriza publicação.

### `READY FOR PREVIEW`

Exige, cumulativamente:

- worktree limpa e HEAD/commits identificados;
- divergência remota revisada após `git fetch origin` autorizado;
- `npm run release:check` aprovado sem FAIL;
- unitários e integrações aprovados;
- E2E críticos, Axe, teclado, console e links aprovados;
- Lighthouse dentro de `docs/frontend-quality-budget.md`;
- `npm audit` com zero vulnerabilidades e Prisma válido;
- checkout e frete falhando fechados; providers/e-mail/Push/backfill off;
- diff, arquivos rastreados e bundle sem secret/PII/URL proibida;
- banco, Redis, storage, URL e secrets isolados de Production;
- preview `noindex,nofollow`, robots bloqueado e sitemap seguro;
- health sem erro e `smoke:release` aprovado no alvo;
- rollback de aplicação e responsável registrados.

### Produção

Além de todos os gates de preview:

- preview aprovado e hash idêntico ao candidato;
- QA visual desktop/mobile e QA manual em dispositivo real aprovados;
- leitor de tela/teclado manual conforme plano de QA;
- variáveis revisadas sem exibir valores;
- backup recente confirmado e restauração/rollback conhecidos;
- DNS, domínio, TLS, health e logs aprovados;
- smoke pós-deploy autorizado e aprovado;
- checkout confirmado `false` antes e depois do deploy;
- autorização explícita do responsável.

Este ciclo não pode declarar `READY FOR PRODUCTION` porque preview real, QA manual,
backup, DNS e autorização ainda não foram comprovados.

## NO-GO

Bloquear publicação diante de qualquer item:

- build, typecheck, lint, teste crítico, Axe ou smoke falhando;
- secret, token, PII, dump, `.env` ou artefato gerado rastreado/exposto;
- `CHECKOUT_ENABLED=true`, valor ambíguo aceito como true ou fluxo sem gate;
- frete/provider acessível com checkout pausado;
- Stripe live, Melhor Envio production, e-mail ou Push real no preview;
- banco, Redis, storage, cron, webhook ou secret compartilhado com Production;
- preview indexável ou canonical Railway/local;
- Home, catálogo, produto, autenticação ou health em erro;
- erro de hydration, console inesperado ou overflow crítico;
- sitemap com Admin/API/rotas privadas ou JSON-LD com oferta comprável;
- migration destrutiva, alteração de banco inesperada ou backfill/seed com escrita;
- regressão severa de acessibilidade/performance;
- divergência remota não revisada;
- rollback/backup desconhecidos.

## Warnings que não bloqueiam o catálogo pausado

- Stripe, Melhor Envio, e-mail e Push ainda não homologados, desde que off;
- cinco produtos sem dimensões, enquanto frete automático estiver off;
- ausência de CSP, com plano técnico e headers atuais preservados;
- ausência de cache offline do storefront;
- teste manual em iPhone pendente antes de produção;
- warning do shadow database local, se schema/migrations de destino estiverem válidos.

Warnings viram bloqueadores quando a funcionalidade correspondente for ativada.

## Comandos seguros antes de futura publicação

Não executar push automaticamente. Após autorização específica:

```bash
git fetch origin
git status --short --branch
git log --oneline --left-right origin/main...HEAD
git diff --check origin/main..HEAD
npm run release:check
git log --oneline origin/main..HEAD
```

Se o remoto tiver commits novos, parar e revisar a divergência. Somente depois de
backup/rollback confirmados e aprovação do hash:

```bash
git push origin main
```

O comando acima é apenas o plano. Depois do deploy, aguardar estado saudável e executar:

```bash
npm run smoke:release -- --base-url=https://preview.example.com
```

Smoke em produção continua bloqueado por padrão e exige autorização separada:

```bash
npm run smoke:release -- --base-url=https://raredept.com.br --allow-production
```

## Sequência operacional

1. Verificar branch e worktree.
2. Buscar o remoto e revisar divergência.
3. Executar `release:check`.
4. Revisar commits e release notes.
5. Confirmar backup e rollback.
6. Fazer push normal, nunca force.
7. Aguardar preview/deploy do hash correto.
8. Executar smoke somente leitura.
9. Verificar health e logs sanitizados.
10. Confirmar checkout/frete/providers desligados.
11. Validar domínio, robots, canonical e sitemap.
12. Executar QA manual.
13. Aprovar ou iniciar rollback de aplicação.

## Registro da decisão

Registrar: hash, URL, ambiente, horários, resultados, warnings aceitos, responsável,
backup, deploy anterior e decisão final. Não anexar secrets, payloads financeiros,
cookies, endereços, CPF, e-mail real ou logs identificáveis.
