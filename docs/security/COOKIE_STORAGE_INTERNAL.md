# Cookies e armazenamento do navegador — inventário interno

> **Documento interno de engenharia.** Não é renderizado na loja. A política pública
> (`/politica-de-cookies`) e o painel "Preferências de Cookies" descrevem os mesmos itens em
> linguagem simples, **sem** nomes técnicos e **sem** nada do Admin/MFA
> (RARE-COOKIE-PUBLIC-HARDENING-01).
>
> Este arquivo lista **nomes** e comportamento. Nunca registrar aqui valor de cookie, JWT, token de
> sessão, segredo de MFA, chave de criptografia ou código de recuperação.

Fontes da verdade no código:

| Arquivo | Papel |
| --- | --- |
| `src/lib/cookie-storage-inventory.ts` | Inventário técnico (nome → tipo, categoria, entrada pública, público, Max-Age, módulo). **Nunca importar em página/componente.** |
| `src/lib/cookie-consent.ts` → `COOKIE_CATALOG` | Texto público (rótulo, finalidade, tipo, duração, origem). Sem nomes técnicos. |
| `src/lib/cookie-consent.test.ts` | Falha se o código grava uma chave `rare_*`/`rare:*` fora do inventário, se uma chave de cliente não tiver entrada pública, se uma chave de equipe tiver, se o catálogo público contiver nome técnico/Admin/MFA, se as durações divergirem do código, ou se o inventário for importado por código renderizado. |
| `src/app/(store)/politica-de-cookies/cookie-public-hardening.test.ts` | HTML da política e do painel: sem nomes técnicos, sem "Ver detalhes técnicos", com o conteúdo humano. |

## Inventário

| Identificador técnico | Armazenamento | Finalidade | Duração | Escopo | Essencial/Opcional | Público | Dono (módulo) | Entrada pública |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `rare_cookie_consent` | Cookie (`Path=/`, `SameSite=Lax`, `Secure` em https; gravado pelo cliente) | Decisão de consentimento: `v<versão>.a<0/1>.<unix>` — sem id de pessoa | 180 dias (`COOKIE_CONSENT_MAX_AGE_DAYS`) | Loja inteira | Essencial | Cliente | `src/lib/cookie-consent-client.ts` | Preferências de privacidade |
| `rare_customer_session` | Cookie de sessão do cliente (servidor) | Mantém o cliente autenticado após o login | `maxAge` 30 dias; apagado no logout | Loja inteira | Essencial | Cliente | `src/lib/customer-auth.ts` | Sessão da conta |
| `rare_admin_session` | Cookie de sessão do Admin (servidor) | Sessão do painel administrativo | `maxAge` 8 horas | Admin | Essencial | **Equipe** | `src/lib/auth.ts` | — (nunca público) |
| `rare_admin_mfa_pending` | Cookie (servidor) | Prova curta de senha correta; só libera a etapa de MFA | `ADMIN_MFA_PENDING_TTL_SECONDS` = 10 min | Admin (`/admin/mfa*`) | Essencial | **Equipe** | `src/lib/auth.ts` | — (nunca público) |
| `rare_store_cart` | `localStorage` | Itens do carrinho | Até esvaziar o carrinho (inclui `clearCart` após compra) ou limpar o navegador | Origem da loja | Essencial | Cliente | `src/components/store/cart-context.tsx` | Carrinho |
| `rare_store_shipping_selection` | `localStorage` | Opção de frete escolhida | Removida quando o carrinho/CEP muda, a cotação fica inválida ou expira, ou o navegador é limpo (ver finding F-01) | Origem da loja | Essencial | Cliente | `src/components/store/cart-page-client.tsx` | Entrega |
| `rare:home-motion-paused:v2` | `localStorage` | Usuário pausou as animações da home | Até limpar o navegador | Origem da loja | Essencial | Cliente | `src/components/store/home-motion.tsx` | Preferências visuais |
| `rare_analytics_visitor` | Cookie (cliente) | Id aleatório (UUID) do navegador; o servidor guarda só um hash dele | 180 dias (`ANALYTICS_VISITOR_MAX_AGE_DAYS`); apagado ao recusar | Loja inteira | **Opcional** (só com consentimento) | Cliente | `src/lib/site-analytics-client.ts` | Identificador do navegador |
| `rare_analytics_session` | `sessionStorage` | Id aleatório da visita (aba) | Até fechar a aba; apagado ao recusar | Aba | **Opcional** (só com consentimento) | Cliente | `src/lib/site-analytics-client.ts` | Identificador da visita |

Eventos de análise (`SiteAnalyticsEvent`, servidor): `type`, `visitorHash`, `sessionHash`, `path`,
`productId`, `device` (classe grosseira), `createdAt`. Sem nome, e-mail, CPF, telefone, IP ou
user agent. Retenção `SITE_ANALYTICS_RETENTION_DAYS` = 400 dias, purgada por
`purgeExpiredSiteAnalyticsEvents` (disparada pela rota de ingestão, no máximo uma vez por intervalo
por instância). O IP é usado só como chave de rate limit (com hash no limitador) e não é gravado.

Literais `rare:*` que **não** são armazenamento (eventos DOM / rótulos de servidor):
`rare:cookie-consent-change`, `rare:cookie-preferences-open`, `rare:home-motion-change`,
`rare:rate-limit`, `rare:site-analytics:v1`.

## Regras

1. Chave nova de cookie/storage → adicionar em `INTERNAL_STORAGE_INVENTORY` **e** descrevê-la em
   linguagem simples numa entrada de `COOKIE_CATALOG` (ou reaproveitar uma existente). O teste falha
   até as duas pontas existirem.
2. Chave só da equipe (Admin) → `audience: "staff"`, `publicEntry: null`. Não aparece em nenhuma
   superfície pública.
3. Mudança de categoria ou finalidade do consentimento → subir `COOKIE_CONSENT_VERSION` (o banner
   pergunta de novo). Mudança só de texto/apresentação **não** exige subir a versão.
4. Mudar duração no código → atualizar inventário, catálogo e este arquivo no mesmo PR.

## Findings em aberto

- **F-01 (LOW, copy × código):** a política diz que a "Entrega" dura "até concluir a compra ou
  limpar o navegador". No código, `rare_store_shipping_selection` é removida quando o carrinho ou o CEP
  muda, quando a cotação deixa de ser válida/fresca ou quando é lida inválida. Após a compra, o
  carrinho é esvaziado e a seleção deixa de valer (é descartada na próxima leitura), não no instante
  da conclusão. Mantido o texto atual neste ciclo (sem escolher silenciosamente); decisão do operador.
