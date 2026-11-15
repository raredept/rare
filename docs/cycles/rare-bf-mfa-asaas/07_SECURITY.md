# 07 — Segurança

Auth/AuthZ tratado como P0 (houve acesso indevido ao Admin no passado).

## Superfícies revisadas

| Área | Controles | Evidência |
|---|---|---|
| Sessão Admin | JWT HS256 fixo (`algorithms`), `typ`, `role`, `credentialVersion`, `sessionVersion`, `mfa`; gate único `getCurrentAdmin()` | `auth.test.ts`, `auth-mfa.test.ts`, `proxy.test.ts` |
| MFA | ver 04_MFA (bypass, replay, rate limit, reset) | `admin-mfa*.test.ts`, `totp.test.ts`, `mfa/actions.test.ts`, QA PostgreSQL |
| Open redirect | `getSafeAdminNext` resolve a URL como o browser e valida o resultado; CTA de campanha usa o mesmo resolvedor | `safe-redirect` tests, `validation.test.ts` |
| Server Actions | varredura de todos os `"use server"`: ações Admin chamam `requireAdmin()`; MFA chama `getPendingMfaAdmin()` | revisão manual + `page-guards.test.ts` |
| Mass assignment | `promotionData()` allowlist; status/ids/auditoria nunca do formulário; ids validados por regex e existência | `actions.test.ts` |
| XSS | textos comerciais sem `<>`/controle, renderizados como texto; único `dangerouslySetInnerHTML` novo = SVG do QR gerado pela biblioteca a partir da nossa URI | revisão |
| Preço/pagamento | servidor recalcula tudo; browser só manda itens/endereço/método; Asaas recebe o total do pedido | `checkout-asaas.test.ts` ("R$ 170 ignorando R$ 1"), QA PostgreSQL |
| Webhook Asaas | token em tempo constante, corpo ≤ 64 KB, só id/evento/payment.id lidos, estado relido na API, idempotente | `route.test.ts`, `asaas-webhook.test.ts`, QA |
| Ambientes | sandbox em produção ou produção fora de produção → configuração inválida (checkout recusa antes de reservar; health/readiness acusam) | `asaas-config.test.ts`, `config-drift` |
| Segredos | API key só no header para host fixo, sem redirect; erros só com códigos fixos; TOTP/recovery nunca em log/audit; chave MFA ≠ segredo de sessão | `admin-mfa-crypto.test.ts`, `asaas.test.ts` |
| Logs/PII | Asaas recebe nome, CPF, e-mail (sem endereço/telefone); nenhum payload bruto logado | revisão |
| Dependências | `npm audit` = 0 vulnerabilidades após `6195e76` | `_ops/audit-after.txt` |
| Release guard | `npm run release:guard`: segredos no repo/diff, flags, env públicas, bundle | ver abaixo |

## Achados deste ciclo (CYCLE-02)

| # | Severidade | Achado | Status |
|---|---|---|---|
| S-01 | Medium | Pix `CONFIRMED` em bloqueio cautelar tratado como liquidado sem aviso (risco de enviar mercadoria de um Pix que será estornado) | **Corrigido** `612cfa4` |
| S-02 | Low | `.env.example` com linha partida: `CHECKOUT_ENABLED=false.` antes do valor real | **Corrigido** `47ac4de` + guard contra variável duplicada |
| S-03 | Low | Audit log do MFA perdia contagens de códigos (sanitizador) | **Corrigido** `912f6e5` |
| S-04 | Low (pré-existente) | `hasValidCustomerSession` no proxy não fixa `algorithms` no `jwtVerify` | ACCEPTED RISK — jose rejeita `none`, segredo HMAC; checagem é só grossa e a página revalida |
| S-05 | Info | `release:guard` falha porque `output/` está rastreado (relatórios deste ciclo) | **Corrigido**: relatórios versionados em `docs/cycles/rare-bf-mfa-asaas/`, `output/` volta a ser só local |

## Testes adversariais em staging (§28)

Open redirect, path traversal, cookie velho/copiado, fixation, Origin/Host/X-Forwarded/Cloudflare headers **contra staging**: **NÃO EXECUTADOS** — staging deste ciclo não foi publicado (sem acesso Railway ao projeto RARE). Cobertos em unit/integração local; a execução em staging é **MANUAL** e bloqueia produção.
