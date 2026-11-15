# Admin MFA — operação, rollout e recuperação

## Como funciona

- Login do Admin = senha **e** código TOTP (RFC 6238, 6 dígitos, 30 s) de qualquer app autenticador
  (Google/Microsoft Authenticator, 1Password, Authy…).
- A senha correta gera apenas uma credencial "pendente" (cookie `rare_admin_mfa_pending`, 10 min,
  `path=/admin`, `SameSite=Strict`) que só serve para `/admin/mfa` ou `/admin/mfa/setup`.
  A sessão Admin (`rare_admin_session`) só é emitida após o segundo fator e carrega `mfa=true`.
- `getCurrentAdmin()` (páginas, server actions, `/api/admin/*`) e o `proxy.ts` recusam sessão sem MFA.
- O segredo TOTP é cifrado (AES-256-GCM) com `ADMIN_MFA_ENCRYPTION_KEY`; os códigos de recuperação
  são guardados apenas como HMAC. Nada disso aparece em logs ou no audit log.

## Variáveis

| Variável | Valor |
|---|---|
| `ADMIN_MFA_ENCRYPTION_KEY` | 32 bytes aleatórios em base64. **Diferente** de `ADMIN_SESSION_SECRET`. Gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ADMIN_MFA_REQUIRED` | Produção: ignorado (MFA sempre obrigatório). Staging: padrão `true`. Dev: padrão `false`. |

> **Trocar `ADMIN_MFA_ENCRYPTION_KEY` invalida todos os fatores cadastrados** (o segredo não abre
> mais). Se for necessário, faça antes o reset de cada Admin (abaixo) e peça novo cadastro.

## Rollout (primeiro deploy com MFA)

1. Configure `ADMIN_MFA_ENCRYPTION_KEY` no serviço web (staging e produção, valores distintos).
   Sem ela o health/readiness reportam erro de configuração e o login informa que o segundo fator
   está indisponível — nenhum login Admin funciona.
2. Faça o deploy (a migration `20261106120000_admin_mfa_audit` é aditiva).
3. Todas as sessões Admin existentes deixam de valer (não têm MFA). Cada administrador entra com a
   senha e é levado ao cadastro obrigatório: escaneia o QR, confirma um código e **guarda os 10 códigos
   de recuperação** (exibidos uma única vez).
4. Confirme em `/admin/security`: status "Ativa" e 10 códigos restantes.

## Perdi o celular

1. Use um código de recuperação no lugar do código de 6 dígitos (cada um vale uma vez).
2. Já dentro do Admin, cadastre o novo celular: hoje isso é feito com o **reset** abaixo seguido de
   novo login (o reset é intencionalmente uma operação técnica). Gere novos códigos de recuperação em
   `/admin/security` se tiver usado vários.

## Perdi o celular **e** os códigos de recuperação (reset)

Operação de alto risco. Só o responsável técnico, com acesso ao banco/serviço de produção, e **após
confirmar a identidade da pessoa por outro canal** (ligação/vídeo, não só e-mail).

```bash
ADMIN_MFA_RESET_EMAIL=pessoa@exemplo.com \
ADMIN_MFA_RESET_CONFIRM=RESET-MFA:pessoa@exemplo.com \
ADMIN_MFA_RESET_REASON="perdeu celular e códigos; identidade confirmada por vídeo" \
CONFIRM_PRODUCTION_MFA_RESET=true \
npm run admin:mfa-reset
```

O reset: apaga o segredo ativo e o pendente, apaga todos os códigos de recuperação, incrementa
`sessionVersion` (derruba todas as sessões da conta) e grava `mfa.reset` em `AdminAuditLog`.
No próximo login a pessoa refaz o cadastro.

**Único administrador:** o reset exige acesso ao ambiente (Railway shell/variáveis + banco). Guarde
os códigos de recuperação do único Admin em cofre separado e garanta que pelo menos uma segunda
pessoa de confiança tenha acesso ao Railway. Não existe reset por e-mail — por decisão de segurança.

## Auditoria

```sql
SELECT "createdAt", "action", "actorLabel", "entityId", "after"
FROM "AdminAuditLog" WHERE "action" LIKE 'mfa.%' ORDER BY "createdAt" DESC LIMIT 50;
```
