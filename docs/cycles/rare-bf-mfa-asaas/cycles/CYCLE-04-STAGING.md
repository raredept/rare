# CYCLE-04 — Staging homologation (RARE-BF-MFA-ASAAS-02), 2026-11-06/07

Objetivo: provar de ponta a ponta, em staging real, Black Friday, Central de Promoções, MFA, Asaas, checkout, estoque, webhook, Admin, vitrine, migrations e segurança. Sem features novas, sem merge, sem produção.

## Resultado em uma linha

**Staging real: NÃO EXECUTADO — BLOCKED_EXTERNAL (sem acesso ao projeto RARE no Railway).** Tudo o que não depende do Railway nem de credencial Asaas foi executado num laboratório local que espelha o staging (build de produção, `APP_ENV=staging`, gate Basic, MFA obrigatório, `PAYMENT_PROVIDER=asaas`) e passou em Chromium e WebKit, depois de 5 correções de código. Laboratório PASS ≠ staging PASS: o critério do §69 continua aberto.

## Estado base

| Item | Valor |
|---|---|
| Branch remota | `cycle/rare-bf-mfa-asaas-01` (trabalho no worktree `claude/rare-bf-mfa-asaas-pr-5eec6a`, que rastreia essa branch) |
| Commit inicial | `d78bd8a` (= `origin/cycle/...` = `refs/pull/2/head`), árvore limpa |
| PR | raredept/rare#2, Draft, base `main` = `4ea73f5` (inalterada), GitHub gerou `refs/pull/2/merge` (sem conflito com `main`) |
| CI | não havia `.github/workflows`; criado `PR CI` (`0995a5c`), verde no PR em 1m56s |
| `codex/backend-evolution-20261007` | não tocada (M-14 segue separado) |

## Railway — discovery (somente leitura)

| Verificação | Resultado |
|---|---|
| Railway CLI | logado, mas `railway status` → `Unauthorized` para o projeto vinculado a `E:\rare` (`Rare` / ambiente `staging`); `railway list` não mostra o projeto RARE |
| Conector Railway da sessão | só enxerga o workspace `ptrlhpet's Projects` (DuraPets/DuraOps/DuraRH) — outro negócio, nada foi lido ou alterado lá |
| 4 Chromes conectados | o painel do projeto RARE responde 404/Login em todos (3 sem login no Railway, 1 logado em conta sem acesso) |
| Staging público | `GET /api/health` → 200 `ok_with_warnings`, `database.ok=true`; não expõe SHA, então a versão em staging **não pode ser provada** daqui |
| Incidente | o painel do Railway exibia "External network blocks affecting access to Railway" durante a verificação |

Consequência: source branch, variáveis (`ADMIN_MFA_ENCRYPTION_KEY`, `ASAAS_*`, `PAYMENT_PROVIDER`, `ADMIN_MFA_REQUIRED`), backup, migrations, deploy e SHA de web/worker do staging ficaram **MANUAL/EXTERNAL** (ver 15_MANUAL_ACTIONS M-01, M-16..M-18).

## Laboratório staging-like (`npm run qa:staging-lab`)

`scripts/qa-staging-lab.ts`: banco PostgreSQL 17 descartável (migrate deploy + status + seed + fixtures sintéticas), **build de produção** (`.next/standalone`) com `APP_ENV=staging`, `NODE_ENV=production`, gate Basic, `ADMIN_MFA_ENCRYPTION_KEY` aleatória, `PAYMENT_PROVIDER=asaas` com chave de formato Sandbox **falsa** (nenhuma chamada sai para o Asaas), e os specs `tests/e2e/bf-mfa-*.spec.ts` em três fases: `asaas`, provedor desconhecido (`qualquer-coisa`) e `stripe` (rollback). Todos os segredos são aleatórios por execução e nunca impressos; ao fim, o log do servidor é varrido por cada segredo, senha, segredo TOTP e código de recuperação usado. `--https` coloca um proxy TLS local (certificado descartável) para o WebKit.

### Resultados (última execução de cada navegador)

| Área | Chromium | WebKit | Observação |
|---|---|---|---|
| Admin sem cookie / cookie de cliente / cookie pendente / pendente como sessão | PASS | PASS | 7 páginas + 5 variantes codificadas (`/%61dmin`, `%2e%2e`, `//`, maiúsculas) + 5 APIs |
| MFA: senha → só cookie pendente (`HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=600`) | PASS | PASS | atributos conferidos no `Set-Cookie` |
| MFA: cadastro (QR/chave), código errado, código certo, 10 códigos de recuperação exibidos uma vez | PASS | PASS | segredo cifrado no banco; códigos só como hash; audit `mfa.enrolled` só com contagem |
| Sessão completa, logout, cookie copiado antes do logout | PASS | PASS | revogado |
| TOTP reutilizado, recovery code 1x, reuso recusado, limitador (6ª tentativa recusada mesmo com código válido) | PASS | PASS | conta não fica bloqueada (só janela de 5 min) |
| Segundo Admin + reset (CLI do runbook): audit, sino, sessões revogadas, segredo e códigos antigos inválidos, recadastro | PASS | PASS | |
| `next` hostil (`//evil`, `https://evil`, `/%2F%2Fevil`, `/\evil`, `/admin/../../evil`) | PASS | PASS | sempre aterrissa em `/admin` do próprio host |
| Promoções: 11 entradas inválidas recusadas, nada gravado; mass assignment ignorado; HTML neutralizado | PASS | PASS | HTML é **neutralizado** (`<`/`>` removidos), não rejeitado |
| Campanha QA "SALE BLACK FRIDAY — QA": rascunho/preview sem efeito; ativação → home e PDP na hora | PASS | PASS | R$ 200 → R$ 150 (−25%), contador visível |
| Preço no servidor: `/api/cart/pricing` ignora preço do cliente; carrinho adulterado (R$ 1,00) exibe R$ 150,00 | PASS | PASS | |
| Edição ao vivo, pausar/reativar sem deploy | PASS | PASS | |
| Replay de server action (pausar): sem cookie 307, cookie de cliente 307, Origin forjado 500, Host forjado 500 — nada muda | PASS | PASS | controle: o mesmo pedido com a sessão e origem certas pausa |
| Janela agendada (início/fim no minuto), contador recarrega sozinho no fim e a home volta para a campanha anterior | PASS | PASS | |
| Responsividade 320/360/375/390/430/768/1024/1280/1440/1920 em 12 telas (+ MFA setup/challenge) | PASS (após correções) | PASS | |
| axe (wcag2a/aa, 21a/aa) sem violação séria/crítica em 12 telas | PASS (após correções) | PASS | teclado: CTA da campanha focável |
| Encerrar (vitrine limpa, edição recusada, aviso legível), duplicar (rascunho limpo) | PASS | PASS | |
| Lista: busca, filtro de status, paginação (25+), estado vazio | PASS | PASS | |
| Audit log: created/updated/activated/paused/ended/duplicated, com ator, sem dado sensível | PASS | PASS | |
| Analytics de promoções = consulta independente; pedido estornado excluído | PASS | PASS | 1 pedido · R$ 150,00 · desconto R$ 50,00 · 1 item |
| Pedido Asaas no Admin: provider, promoção, desconto, frete, total, ação de estorno; sem payload bruto | PASS | PASS | |
| Checkout com Asaas: só "Asaas", "30 minutos", sem Stripe/Mercado Pago/débito | PASS | PASS | |
| Pix e "Meus pedidos" de pedido Asaas: só Asaas (inclusive com `PAYMENT_PROVIDER=stripe`) | PASS | PASS | rollback não troca o provedor de pedidos antigos |
| Webhook Asaas: token ausente/errado/igual à chave → 401; certo → 200; duplicado → `duplicate:true`; malformado → `ignored`; >64 KB → 413; id de pagamento com `../` nunca usado | PASS | PASS | só eventos sem pagamento (nenhuma chamada ao Asaas) |
| `PAYMENT_PROVIDER=qualquer-coisa`: checkout diz "indisponível", botão desabilitado, API 503, nenhum pedido criado, health com erro | PASS (após correção) | PASS | |
| `PAYMENT_PROVIDER=stripe`: checkout volta a falar Stripe | PASS | PASS | sem chave Stripe TEST aqui: checkout Stripe real não executado |
| Desempenho (mediana, build local aquecido) | `/` 192 ms · `/categoria/tudo` 153 · PDP 133 · `/admin` 117 · Promoções 109 · Analytics 133 | — | teto de regressão, não benchmark |
| Log do servidor | 0 de 67 valores sensíveis; 0 chaves `$aact_`, cookies, `Authorization`, `otpauth://`, CPF formatado, cartão | 0 de 67 | |
| Integridade do banco após o uso (somente leitura) | 0 anomalias em 9 checagens: estoque negativo/reservado > estoque, itens órfãos, pago sem `paidAt`, evento Asaas processado sem pedido, cliente Asaas duplicado, códigos de recuperação sem fator, promoção ativa/agendada sem alvo, fim ≤ início, snapshot de preço incoerente | — | nada corrigido em silêncio |

Nota WebKit: roda com `--https` (o WebKit de Windows descarta cookies `Secure` em `http://localhost`) e com a credencial do gate enviada de antemão (ele não reenvia o corpo de um POST após o desafio 401). É 4–5× mais lento: MFA/segurança e pagamentos passaram numa passada e Promoções 13/13 na seguinte. Corridas de navegação do WebKit após redirect de server action foram resolvidas no teste esperando a página de destino renderizar.

Concorrência em PostgreSQL real (mesmo ciclo): `qa:bf-asaas` 8/8 provas (5 compradores/1 unidade → 1 vencedor, total R$ 170 calculado no servidor; webhooks duplicados/fora de ordem; valor divergente; expiração com DELETE antes de liberar; pagamento durante a expiração; estorno sem reestoque; cliente Asaas reutilizado; TOTP de uso único sob concorrência) e `qa:checkout-concurrency` 12/12 (Stripe), 0 chamadas a provedores.

### Bugs encontrados e corrigidos (REPRODUCE → ROOT CAUSE → TEST → FIX → RETEST)

| # | Sev. | Achado (como foi reproduzido) | Causa raiz | Correção | Teste de regressão | Commit |
|---|---|---|---|---|---|---|
| 1 | Medium | Com `PAYMENT_PROVIDER` desconhecido/`disabled`, o checkout dizia "Pagamento seguro… na Stripe", mostrava prazo e um botão que só falhava (fase `disabled` do lab) | o cliente só distinguia `asaas` vs resto | aviso "Pagamentos temporariamente indisponíveis", botão desabilitado; erro de ambiente coberto em unit | `bf-mfa-payments` (fase disabled) + `env.test.ts` | `97dbbdc` |
| 2 | Medium | "Criar promoção" e botão do formulário 1,1:1 no Admin escuro (axe) | `.admin-dark` remapeia `.bg-white`, não `text-black` | `bg-black text-white` (o tema inverte) | `bf-mfa-promotions` (axe) | `e5446e5` |
| 3 | Medium | Preview da campanha com selo/CTA preto sobre quase-preto (axe) — o preview não mostrava a vitrine real | remapeamentos escuros alcançavam o componente da vitrine | escopo `.admin-light-scope` onde os remapeamentos param | axe no preview | `e5446e5` |
| 4 | Low | Alertas de promoção do dashboard 2,68:1 e `<ul role=status>` sem semântica de lista (axe); avisos âmbar das páginas de promoção 1,8:1 (calculado; axe deixa fundo translúcido como "incompleto") | `amber-800/900` não remapeados | par `amber-700/amber-400` remapeado; `role=status` num wrapper | axe em `/admin`, promoção incompleta e promoção encerrada | `e5446e5` |
| 5 | Low | `/admin/promotions/new` 330 px em 320; detalhe do pedido largo em todas as larguras (diagnóstico de overflow) | `fieldset` tem `min-inline-size: min-content`; e-mail longo sem ponto de quebra (pré-existente) | `min-w-0` nos fieldsets; `break-all` no e-mail | responsividade 10 larguras × 12 telas | `e5446e5` |
| — | (regressão do próprio fix) | ao escopar `.bg-white`, a regra ganhou especificidade e passou a vencer o item ativo da navegação (1,1:1 em todas as páginas) | especificidade | a regra do item ativo recebeu o mesmo escopo | axe em todas as telas do Admin | `e5446e5` |

### Informativo / risco aceito (sem correção neste ciclo)

- **Server action sem `Origin` + cookie de Admin válido executa.** Não explorável por CSRF: navegadores sempre enviam `Origin` em POST cross-site e o cookie de Admin é `SameSite=Lax`. Só quem já roubou o cookie consegue — e então já tem a sessão.
- **APIs com `requireAdmin()`** (`/api/admin/uploads`, `/uploads/presign`, `/product-images/editor`) respondem **307 → login** a sessão revogada em vez de 401. Recusa sem dados; comportamento pré-existente (rotas fora do diff do ciclo).
- **Origin/Host forjados** em server action: o Next recusa com 500 (não 403). Recusa efetiva.
- **HTML em textos de promoção** é neutralizado, não rejeitado (o prompt pedia rejeição). Não há execução de script; mudar para rejeição seria mudança de comportamento, fora do escopo.
- **Firefox**: navegador do Playwright não instalado nesta máquina (baixar exige autorização) → NÃO EXECUTADO.
- **WebKit de Windows**: não aceita cookie `Secure` em `http://localhost` e não reenvia corpo de POST após o desafio 401 do gate; o lab usa HTTPS local e credencial preemptiva para ele. Não é o Safari de macOS/iOS.

## O que continua sem prova (exige staging/credenciais)

MFA com a chave real de staging · Asaas Sandbox (conectividade, customer, Pix, CONFIRMED→RECEIVED, cartão hospedado, estorno, expiração com DELETE real) · webhook Sandbox real · idempotência/fora de ordem com eventos reais · Stripe TEST real (rollback) · migrations e SHA no staging · logs do Railway · dark theme/mobile com dados reais.

## Critério §69

| Item | Estado |
|---|---|
| MFA real | lab PASS; staging NÃO EXECUTADO |
| Promoções / Black Friday QA | lab PASS; staging NÃO EXECUTADO |
| Asaas Sandbox / webhook real | BLOCKED_EXTERNAL |
| Idempotência / fora de ordem / valor divergente | PG real + mock PASS; evento real BLOCKED_EXTERNAL |
| Concorrência de estoque | PG real PASS |
| Stripe rollback smoke | lab (texto/roteamento) PASS; checkout Stripe TEST BLOCKED_EXTERNAL |
| Playwright / mobile / a11y / segurança | lab PASS (Chromium + WebKit); staging NÃO EXECUTADO |
| Build / release guard | PASS |

**STAGING PASS: NÃO.**
