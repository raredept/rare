# RARE-COOKIE-PUBLIC-HARDENING-01 — Exposição técnica na política e no painel de cookies

| Campo | Valor |
| --- | --- |
| Data | 2026-11-17 |
| Branch | `cycle/rare-cookie-public-hardening-01` |
| BASE_SHA | `35c741623fe706843661c83693667658b46e497e` (`origin/main`, sem avanço) |
| Tipo | COPY + PRESENTATION + PRIVACY HARDENING |
| Produção | Não alterada (sem merge, sem deploy) |
| Migrations | 0 |

## 1. Exposição anterior (produção, `https://raredept.com.br/politica-de-cookies`, 2026-11-18T01:08Z)

A página pública trazia uma tabela por categoria com a coluna **Nome** mostrando o identificador
técnico de cada item, e o painel "Preferências de Cookies" (renderizado no HTML de toda página da
loja) tinha o expansor **"Ver detalhes técnicos"** com os nomes.

| Identificador | Política (tabela) | Painel (detalhes técnicos) |
| --- | --- | --- |
| `rare_cookie_consent` | sim | sim |
| `rare_customer_session` | sim | sim |
| `rare_admin_session` | sim (+ "Sessão do painel administrativo") | não |
| `rare_admin_mfa_pending` | sim (+ "Etapa do segundo fator no login do painel administrativo") | não |
| `rare_store_cart` | sim | sim |
| `rare_store_shipping_selection` | sim | sim |
| `rare:home-motion-paused:v2` | sim | sim |
| `rare_analytics_visitor` | sim | sim |
| `rare_analytics_session` | sim | sim |

- `PUBLIC_TECHNICAL_IDENTIFIERS_BEFORE = 9` (distintos, visíveis na política; 7 também no painel)
- `PUBLIC_ADMIN_IDENTIFIERS_BEFORE = 2` (`rare_admin_session`, `rare_admin_mfa_pending`), dos quais
  1 de MFA; além do texto "painel administrativo", "segundo fator" e "Só no painel da equipe da loja".
- Os nomes do Admin também iam no **bundle JS do cliente** (o `COOKIE_CATALOG` era importado pelo
  componente do banner).

## 2. Nova apresentação

**Política (`/politica-de-cookies`)** — por categoria, um cartão por item (sem tabela, sem rolagem
horizontal em nenhuma largura): **rótulo**, **finalidade**, e uma lista de definições com
**Tipo**, **Duração** e **Origem**. Coluna "Nome" removida.

**Painel "Preferências de Cookies"** — "Essenciais / Sempre ativos" com o resumo
"Necessários para manter recursos como sua sessão, carrinho, entrega escolhida e preferências de
privacidade." e a lista de finalidades; "Análise de uso" com o switch existente e o resumo "Ajuda a
RARE a entender quais páginas e produtos são mais acessados e como o site é utilizado. Só funciona
quando você autoriza." **"Ver detalhes técnicos" removido.** Botões "Salvar preferências",
"Aceitar todos" e "Recusar não essenciais" inalterados (mesma lógica, mesma hierarquia).

| Categoria | Item público | Tipo | Duração publicada | Chave(s) interna(s) |
| --- | --- | --- | --- | --- |
| Essenciais | Preferências de privacidade | Cookie | 180 dias | consentimento |
| Essenciais | Sessão da conta | Cookie | até 30 dias, ou até você sair da conta | sessão do cliente |
| Essenciais | Carrinho | Armazenamento local | até esvaziar o carrinho ou limpar o navegador | carrinho |
| Essenciais | Entrega | Armazenamento local | até concluir a compra ou limpar o navegador (F-01) | frete escolhido |
| Essenciais | Preferências visuais | Armazenamento local | até limpar o navegador | pausa das animações |
| Análise de uso | Identificador do navegador | Cookie | 180 dias (apagado ao recusar) | visitante (analytics) |
| Análise de uso | Identificador da visita | Armazenamento da aba | até fechar a aba (apagado ao recusar) | sessão (analytics) |

Cookies do Admin/MFA: **nenhuma** menção pública (nem seção "cookies internos"). Documentados só em
`docs/security/COOKIE_STORAGE_INTERNAL.md`.

Ajustes de copy (factuais, sem afirmações novas):
- "Não identifica você" (consentimento) → "Não contém dados pessoais" (o registro é `v1.a0.<unix>`).
- Identificador do navegador: "aleatório (pseudônimo) … Não usa seu nome, e-mail ou conta" (o
  `SiteAnalyticsEvent` não tem campo de cliente; o servidor guarda só hash do id).
- "Eventos de análise já registrados não identificam você" → "não contêm nome, e-mail, CPF,
  telefone nem endereço IP" (schema `SiteAnalyticsEvent`; IP só como chave de rate limit, não gravado).
- Sessão da conta: "30 dias" → "até 30 dias, ou até você sair da conta" (logout apaga o cookie;
  valor de 30 dias inalterado).
- Nenhuma afirmação de "100% anônimo", "LGPD compliant" ou similar (teste garante).

## 3. Arquitetura

- `src/lib/cookie-consent.ts` → `COOKIE_CATALOG` agora só tem texto humano (`id` estável não técnico,
  `label`, `kind`, `purpose`, `duration`, `party`; categoria com `purpose` longo e `summary` curto).
- `src/lib/cookie-storage-inventory.ts` (novo, **engenharia apenas**) → nome técnico, tipo, categoria,
  entrada pública, público (`shopper`/`staff`), Max-Age e módulo dono. Não é importado por nenhuma
  página/componente (teste garante), logo não entra no bundle do cliente.
- Build verificado: `.next/static` sem `rare_admin_session`, `rare_admin_mfa_pending`,
  `rare_customer_session` nem "Ver detalhes técnicos". Continuam no bundle, por implementação, as
  chaves que o próprio navegador grava/lê (consentimento, carrinho, analytics) — IMPLEMENTATION_INTERNAL.

## 4. Busca de exposição (item 21)

`grep` por `rare_admin_`, `rare_customer_session`, `rare_store_`, `rare_analytics_`, `rare:`:

| Classe | Onde |
| --- | --- |
| IMPLEMENTATION_INTERNAL | `src/lib/auth-constants.ts`, `src/lib/cookie-consent.ts` (constantes), `src/lib/cookie-consent-client.ts`, `src/lib/cookie-storage-inventory.ts`, `src/components/store/cart-context.tsx`, `src/components/store/cart-page-client.tsx`, `src/components/store/home-motion.tsx`, `src/lib/rate-limit-config.ts`, `src/lib/site-analytics.ts`, `scripts/qa-staging-lab.ts` |
| TEST | `src/**/*.test.ts` (auth, customer-auth, proxy, health, integrated-config, stripe-smoke-guard, cookie-consent, uiux-refine-p2, cookie-public-hardening), `tests/e2e/*.spec.ts`, `tests/e2e/lab-helpers.ts`, `tests/uiux-audit/*.mjs`, `tests/visual-storefront/states.spec.ts` |
| INTERNAL_DOC | `docs/security/COOKIE_STORAGE_INTERNAL.md`, `docs/runbooks/admin-mfa-recovery.md`, `docs/rate-limit.md`, `docs/checkout-smoke-test.md`, `docs/cycles/**`, `docs/uiux/**` |
| PUBLIC_COPY | **nenhuma** |
| PUBLIC_RENDER | **nenhuma** (política e painel; testes unitários + e2e) |

## 5. Comportamento preservado

Diff restrito a: `src/lib/cookie-consent.ts` (só o catálogo de texto e tipos), página da política,
componente do banner/painel (só a lista de itens), inventário novo, testes e docs.

| Item | Mudou? | Prova |
| --- | --- | --- |
| Nomes/valores/flags/durações de cookies | NÃO | constantes intocadas; `auth.ts`, `customer-auth.ts`, `cookie-consent-client.ts`, `site-analytics-client.ts` fora do diff; teste compara durações com o código |
| Consentimento (categorias, `COOKIE_CONSENT_VERSION=1`, persistência, opt-in, remoção ao recusar) | NÃO | funções `serialize/parse/read/hasAnalyticsConsent` e `cookie-consent-client.ts` intocados; e2e `prelaunch-consent-analytics` |
| Login cliente / Admin / MFA / sessões | NÃO | `src/lib/auth*.ts`, `customer-auth.ts`, `src/proxy.ts`, `src/app/admin/**` fora do diff |
| Carrinho / checkout / pagamento / Asaas | NÃO | `cart-*`, `checkout*`, `payments*` fora do diff |
| Analytics (coleta, retenção 400 d, schema de eventos) | NÃO | `site-analytics*.ts`, rota de ingestão e `prisma/schema.prisma` fora do diff |
| Migrations | 0 | `prisma/migrations` fora do diff |

## 6. Testes

| Suite | Resultado |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npx vitest run` | PASS — 204 arquivos, 2297 testes (3 skipped, pré-existentes) |
| `APP_ENV=staging npm run build` | PASS (44 server actions OK) |
| Focados: `cookie-consent.test.ts`, `politica-de-cookies/cookie-public-hardening.test.ts`, `uiux-refine-p2.test.ts` | PASS |
| Lab e2e (`qa-staging-lab --https`, build de produção `APP_ENV=staging`, Postgres local descartável, chromium-desktop): `prelaunch-consent-analytics` (5) + `cookie-public-hardening` (2) | PASS — 7/7; log scan 0 vazamentos; integridade 0 anomalias |

Testes novos:
- **HTML público** (`cookie-public-hardening.test.ts`): a política não contém nenhum dos 9 nomes,
  nenhum `rare_`/`rare:`, nada de Admin/MFA, nem coluna "Nome"/`<table>`; continua explicando sessão,
  carrinho, entrega, preferências de privacidade, análise de uso e durações; sem "100% anônimo"/"LGPD
  compliant".
- **Modal**: sem "Ver detalhes técnicos", sem `<details>`, sem `rare_`; mantém "Essenciais / Sempre
  ativos", switch de análise e os 3 botões.
- **Catálogo × inventário** (`cookie-consent.test.ts`): toda chave do código está no inventário; toda
  chave de cliente tem entrada pública do mesmo tipo/categoria; chaves de equipe não têm; toda entrada
  pública tem chave real; catálogo sem nome técnico/Admin/MFA; durações = código; inventário nunca
  importado por código renderizado.
- **E2E** (`tests/e2e/cookie-public-hardening.spec.ts`): política e painel em 320/360/375/390/430/768/
  1024/1440 sem overflow; axe WCAG 2.1 AA em política, banner e painel; teclado (foco visível,
  Enter abre, Esc fecha); mudar → salvar → recarregar → escolha persiste. Spec antigo
  `prelaunch-consent-analytics` atualizado para a nova apresentação.

## 7. Evidências de browser

Prints em `output/cookie-public-hardening-01/` (fora do Git, 16 arquivos): `policy-<largura>.png`
(página inteira) e `panel-<largura>.png` para 320/360/375/390/430/768/1024/1440. Conferidos
visualmente 320, 390 (painel) e 1440: cartões legíveis, sem rolagem horizontal, sem nomes técnicos.

Fluxo real provado no lab (build de produção):
- Novo visitante: banner aparece, análise começa desligada, nada é rastreado antes da decisão.
- Aceitar: eventos pseudônimos chegam ao banco, sem dado pessoal.
- Recusar: zero requisições de análise, zero identificadores, zero eventos; decisão sobrevive ao reload.
- Painel: abrir pelo banner (teclado) e pelo rodapé, mudar o switch, salvar, recarregar → escolha
  persiste; retirar pelo rodapé remove os identificadores opcionais; Esc fecha.
- axe (WCAG 2.0/2.1 A+AA) sem violações em política (`main`), banner e painel; anel de foco visível.

Nota: a primeira rodada do lab expôs dois defeitos **do teste novo** (seletor `getByText` ambíguo e
medição durante o esqueleto de streaming); corrigidos no spec, sem mudança de produto.

## 8. Findings

- **F-01 (LOW, copy × código, não corrigido de propósito):** "Entrega — até concluir a compra ou
  limpar o navegador". No código a seleção é removida quando carrinho/CEP mudam ou a cotação deixa de
  valer; após a compra o carrinho é esvaziado e a seleção é descartada na próxima leitura. Texto
  preservado; decisão do operador.
- **F-02 (INFO):** a retenção de 400 dias dos eventos é aplicada pela purga oportunista da rota de
  ingestão (no máximo uma vez por intervalo por instância), não por cron. Sem tráfego com
  consentimento, a purga não roda. Texto preservado.

## 9. Rollout / rollback

- Rollout: revisar o PR → merge → deploy normal do serviço `rare`. Sem migration, sem variável nova,
  sem ação em banco. **Não** subir `COOKIE_CONSENT_VERSION` (categorias e finalidades não mudaram; só
  a apresentação), então ninguém é perguntado de novo.
- Rollback: reverter o commit. Nenhuma ação em banco, nenhum cookie a invalidar.
