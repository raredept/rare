# 04 — MFA do Admin

Runbook operacional: `docs/runbooks/admin-mfa-recovery.md`.

## Fluxo

```
email/senha ok ─► (MFA exigido OU conta já cadastrada?)
                    ├─ sim: cookie rare_admin_mfa_pending (10 min, path=/admin, SameSite=Strict, sem role)
                    │        ├─ cadastrado     → /admin/mfa        (TOTP ou código de recuperação)
                    │        └─ não cadastrado → /admin/mfa/setup  (QR + chave manual, confirma código)
                    │        → sessão rare_admin_session com mfa=true, mfaAt
                    └─ não (só dev/test sem flag): sessão por senha, como antes
```

- TOTP RFC 6238 próprio (`totp.ts`): SHA1, 6 dígitos, 30 s, ±1 passo, comparação em tempo constante. Funciona com Google/Microsoft Authenticator, 1Password, Authy etc.; sem integração proprietária.
- Cadastro: segredo pendente cifrado expira em 15 min; só vira ACTIVE após um código válido, com `updateMany` condicionado ao exato segredo pendente. Gera 10 códigos de recuperação (50 bits cada), exibidos uma vez.
- Replay: `mfaLastUsedStep` avança atomicamente; o mesmo código (ou mais antigo) é recusado, inclusive em requisições simultâneas (provado em PostgreSQL real).
- Códigos de recuperação: HMAC-SHA256 com chave derivada; uso único (`usedAt`); regeneração só com TOTP novo e invalida os anteriores.
- Rate limit próprio: 5/5 min por conta+IP, 20/5 min por IP, 30/h por conta. Janelas curtas, sem bloqueio permanente (não vira DoS duradouro).
- Política: produção **sempre** exige MFA (`ADMIN_MFA_REQUIRED=false` é ignorado e gera aviso); staging/preview padrão exigido; dev/test opcional. Conta cadastrada é sempre desafiada.
- Sessão: `getCurrentAdmin()` recusa sessão sem `mfa` quando exigido ou cadastrado; logout incrementa `sessionVersion` (revoga cópias do cookie); troca de senha mantém `mfaAt`.
- Reset: operação técnica (`npm run admin:mfa-reset` com confirmação literal do e-mail, motivo ≥ 8 caracteres e `CONFIRM_PRODUCTION_MFA_RESET=true` em produção). Apaga segredo, códigos, revoga sessões, grava audit log e notifica todos os Admins. Não existe reset por e-mail.

## Testes de bypass (unit + PostgreSQL real)

| Vetor | Resultado |
|---|---|
| Acesso direto / deep link / refresh / back sem MFA | redireciona ao login (proxy + `getCurrentAdmin`) |
| `/api/admin/*` sem MFA | 401 |
| Server Actions Admin | todas passam por `requireAdmin()`/`getCurrentAdmin()` (varredura: 14 arquivos `"use server"`, nenhuma ação sem guarda além de login/logout) |
| Cookie antigo (sem `mfa`) / token anterior ao MFA | recusado |
| Cookie pendente usado como sessão | recusado (tipo diferente, sem `role`) |
| Cookie copiado após logout | recusado (`sessionVersion`) |
| URL do desafio sem credencial pendente | volta ao login |
| `next=`/`callbackUrl` manipulados, `/admin/../..//evil` | `getSafeAdminNext` resolve e valida a URL final |
| Path codificado (`/admin/%6dfa`) | tratado como página protegida (fail closed) |
| Código repetido / corrida de dois envios | segundo é `replay` |

## Achado e correção deste ciclo

- **Low — audit log perdia contagens.** O sanitizador descarta chaves com "recovery"; os eventos `mfa.*` gravavam `recoveryCodesIssued` etc. e ficavam sem a contagem. Renomeado para `backupCodes*`; teste agora exige a contagem no registro (`912f6e5`).

## Pendências

| Item | Estado |
|---|---|
| Gerar `ADMIN_MFA_ENCRYPTION_KEY` distinta por ambiente | **MANUAL** (bloqueia deploy de produção: sem ela ninguém entra no Admin) |
| Primeiro Admin cadastra, testa código e guarda códigos de recuperação em staging | **MANUAL** |
| Segundo administrador com MFA (evita ponto único de recuperação) | **BUSINESS DECISION** — recomendado |
