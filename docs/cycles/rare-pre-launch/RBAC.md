# RARE-PRE-LAUNCH-02 — RBAC do Admin

Fonte da verdade: `src/lib/admin-permissions.ts` (mapa puro, **default deny**). Toda page, Server
Action e rota `/api/admin/*` chama `requireAdmin(permission)` (`src/lib/auth.ts`) como primeira
instrução; o papel é lido do banco a cada requisição (nunca do token) e a falta de permissão termina
em `/admin/sem-acesso` antes de qualquer leitura. Garantido por `page-guards.test.ts`,
`admin-rbac-matrix.test.ts` (149 casos) e `npm run qa:admin-rbac` (PostgreSQL real).

## Matriz

| Permissão | SYSTEM_ADMIN | SELLER_ADMIN | ADMIN (legado) |
|---|:-:|:-:|:-:|
| `self.account` (Minha conta, `/admin/sem-acesso`) | ✔ | ✔ | ✔ |
| `system.users` (`/admin/users`) | ✔ | — | ✔ |
| `system.security` (`/admin/security`) | ✔ | — | ✔ |
| `system.readiness` (`/admin/readiness`, detalhe do `/api/health`) | ✔ | — | ✔ |
| `system.settings` (`/admin/settings`) | ✔ | — | ✔ |
| `analytics.site` (`/admin/analytics/site`) | ✔ | ✔ | ✔ |
| `analytics.sales` (`/admin/analytics`) | — | ✔ | ✔ |
| `commerce.*` (visão geral, pedidos, clientes, produtos, estoque, promoções, catálogo, mídia, notificações) | — | ✔ | ✔ |

Início após o login: `SELLER_ADMIN` → `/admin`; `SYSTEM_ADMIN` → `/admin/users`. MFA é obrigatório
para os três papéis. Mudança de papel ou desativação incrementa `sessionVersion` (encerra as sessões).
Sempre existe ao menos um gestor de usuários ativo (`SYSTEM_ADMIN` ou `ADMIN`): as alterações que
podem removê-lo travam os gestores ativos em ordem de id antes do alvo (sem deadlock).

## Papel legado `ADMIN`

- **O que é:** o papel único de antes do RBAC. A migration `20261113120000_admin_rbac_roles` é
  aditiva: as contas existentes continuam `ADMIN` e **mantêm acesso total** depois do deploy, para
  ninguém perder o Admin no dia da publicação.
- **Transitório:** `ADMIN` não pode mais ser atribuído (nem pela tela nem por `admin:create`), aparece
  em `/admin/users` como "Admin legado (acesso total)" e o seletor de papel dessas contas abre vazio,
  exigindo escolha explícita.
- **Risco enquanto existir:** uma conta `ADMIN` vê módulos de sistema e de vendedor ao mesmo tempo —
  exatamente a separação que o RBAC introduz. Por isso a migração das contas reais é pré-requisito
  de produção (abaixo), não um detalhe.

## MANUAL — migração das contas reais (operador, depois do deploy em produção)

Nada é migrado automaticamente: a identidade de cada conta precisa ser confirmada por uma pessoa.

1. Entrar em `/admin/users` com uma conta que tenha `system.users`.
2. Para cada conta "Admin legado":
   - conta técnica / de suporte → **Administrador de Sistema** (`SYSTEM_ADMIN`);
   - conta do proprietário / operação da loja → **Administrador Vendedor** (`SELLER_ADMIN`);
   - identidade não inequívoca → **não alterar**; confirmar com o proprietário por outro canal antes.
3. Antes de rebaixar a última conta de sistema, garantir outra `SYSTEM_ADMIN` ativa (a tela recusa
   deixar a loja sem gestor, mas a ordem evita bloqueio operacional).
4. Conferir no registro de auditoria (`admin_user.role_changed`) e pedir a cada pessoa um novo login.
5. Critério de saída: `SELECT role, COUNT(*) FROM "User" WHERE active GROUP BY role` sem `ADMIN`.

Status: **MANUAL / HUMAN_REQUIRED** — não executado nesta sessão (sem acesso a produção, e produção
está fora do escopo do ciclo).

## Contas de QA

- `scripts/qa-staging-lab.ts` cria quatro contas `ADMIN` (specs de MFA) e, desde este ciclo, uma
  `SYSTEM_ADMIN` (E) e uma `SELLER_ADMIN` (F) usadas por `tests/e2e/prelaunch-rbac-inventory.spec.ts`.
- `scripts/qa-bf-asaas-concurrency.ts` continua com `ADMIN`: testa pagamentos, não papéis, e o papel
  legado continua válido durante a transição.
