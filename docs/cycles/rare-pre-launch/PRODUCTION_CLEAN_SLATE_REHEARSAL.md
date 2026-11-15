# Production Clean Slate — ensaio sobre backup real de produção (2026-11-14)

Ensaio integral de [`docs/runbooks/PRODUCTION_CLEAN_SLATE.md`](../../runbooks/PRODUCTION_CLEAN_SLATE.md)
em PostgreSQL **local e descartável** (lab, `localhost:54329`). Nenhum comando tocou o banco de
produção. Sem PII: só contagens, slugs de produto e hashes de arquivo. Credenciais das contas
sintéticas geradas em memória e descartadas; nunca impressas.

## 1. Backup usado

| Item | Valor |
|---|---|
| Origem | produção (`Postgres` do ambiente `production`, database `railway`) — `pg_dump` lógico de 2026-09-19 13:09 (BRT), registrado em `output/final-release/backup-restoration-20260919.json` (fora do Git) |
| Arquivo | `production-1789834157940.dump`, 82682 bytes, fora do Git |
| SHA-256 | `40e181045c623c96a139ef4c295a43f6e219d63cb391c8a54a6bc90e14e943da` (igual ao registrado em 2026-09-19) |
| `pg_restore --list` | OK: formato custom, 123 entradas TOC, 18 tabelas com dados, dump de PostgreSQL 18.6 |
| Migrations no backup | 11 aplicadas, a última `20260907230000_payment_email_outbox` |

Ressalva: o registro do ciclo final (2026-11-13) cita um backup de produção mais novo (107490 bytes,
sha256 `7e69a26f…`), guardado "fora do Git" em outro lugar; ele **não está nesta máquina**. Por
isso o ensaio usa o mais recente verificável aqui. O runbook exige, de qualquer forma, um backup
**novo** no dia da execução (P6/P7).

## 2. Restore e migrations (passo 2 do runbook)

- `pg_restore --no-owner --no-acl --exit-on-error` em `rare_cs_rehearsal`: exit 0 (cliente 17.11).
- `prisma migrate deploy`: 11 migrations do candidato aplicadas (22 no total);
  `migrate status` = up to date; `migrate diff --from-config-datasource --to-schema` = **vazio**
  (sem drift).

## 3. Contagens antes (sanitizadas)

| Item | Antes |
|---|---|
| Clientes / ativos / endereços | 3 / 3 / 4 |
| Admins | `ADMIN` ativo 2; SYSTEM_ADMIN 0; SELLER_ADMIN 0 |
| Pedidos | 9 (todos `canceled`; 1 com `paidAt`) |
| Itens de pedido | 10 |
| Pagamentos (PixCharge) / jobs de expiração / outbox | 0 / 0 / 0 |
| Reembolsos solicitados | 0 |
| Eventos Stripe / Asaas | 1 / 0 |
| Movimentos de estoque | 20 (10 reserve, 9 release, 1 sale), todos ligados a pedidos |
| Estoque total / reservado total | 63 / 0 |
| Produtos / variantes / UNIQUE | 61 / 175 / 0 |
| Analytics do site | 0 (tabela criada pela migration) |
| Suporte | 0 |
| Auditoria Admin | 0 |
| Clientes que consumiram o RARE10 | 1 |
| Anomalias do ledger (pago sem venda, pedido aberto, item sem variante, estoque negativo, reservado ≠ ledger) | 0 |

## 4. Admins pela UI real (passos 3–10)

Build de produção (`.next/standalone`) apontado para o banco restaurado, `APP_ENV=staging`, MFA
obrigatório, checkout OFF, `PAYMENT_PROVIDER=disabled`, e-mail desligado; Chromium via Playwright.

| Passo | Resultado |
|---|---|
| 3 `npm run admin:create` (SYSTEM_ADMIN) | exit 0; papel SYSTEM_ADMIN; `mustChangePassword=true` |
| 4 primeiro login SYSTEM | senha → cadastro MFA (TOTP) → códigos de recuperação → troca de senha → `/admin/users` |
| 5 validação SYSTEM | "Usuários" visível; `/admin/orders` e `/admin/products` → "Sem acesso"; `/admin/security` abre |
| 6 SELLER criado pelo SYSTEM em `/admin/users` | papel SELLER_ADMIN, `mustChangePassword=true`, senha temporária exibida uma vez |
| 7 primeiro login SELLER | temporária → MFA → troca de senha → `/admin` |
| 8 validação SELLER | `/admin/orders` abre; `/admin/users` e `/admin/security` → "Sem acesso" |
| 9 legados desativados **só agora**, pela ação "Desativar" | `ADMIN` inativo 2; SYSTEM_ADMIN ativo 1; SELLER_ADMIN ativo 1 |
| 10 sessões legadas | `sessionVersion` incrementado em 2/2 |
| Auditoria | `admin_user.created` 1, `admin_user.deactivated` 2, `mfa.enrolled` 2 |

A primeira execução do roteiro de ensaio falhou por seletores do próprio roteiro: um `select` ambíguo
e a leitura da URL antes do redirect transmitido. O banco foi **restaurado de novo do backup** e o
ensaio refeito do zero. Nenhuma mudança de produto foi necessária. A única mudança de código ligada
a este passo: `scripts/create-admin.ts` cria a conta de bootstrap com `mustChangePassword=true`, para
que o passo 4 ("primeiro login + troca de senha") exista de fato.

## 5. Reset (passos 11–13)

SQL executado = blocos `sql clean-slate-*` extraídos do runbook (sha256 parciais dos blocos:
preview `28fe434f…`, reset `116f63fb…`, verify `438ca322…`, legacy-admins `7e1f070c…`).

**Guards (fail-closed), todos antes de qualquer reset real:**
- `expected_db` errado → `STOP: connected to rare_cs_rehearsal, expected …`; nada alterado.
- contagem divergente (8 pedidos esperados, 9 reais) → `STOP: counts differ from the reviewed preview`.
- `commit` ausente → o psql recusa `\if :commit` e encerra sem `COMMIT`; pedidos continuam 9.
- `commit=false` com contagens corretas → todos os guards passam e a transação faz ROLLBACK
  (pedidos 9, estoque 63 depois).

**Prévia conferida:** 9 pedidos, 10 itens, 0 abertos, 3 clientes, 20 movimentos de pedido, 0 sem
variante, 0 pago sem venda. Uma variante muda: `supreme-bag` / Único (STANDARD), estoque 1 → 2 (a
venda do único pedido pago e depois cancelado é desfeita), reservado 0 → 0.

**Reset `commit=true`:** COMMIT.

## 6. Contagens depois e integridade

| Item | Esperado | Depois |
|---|---|---|
| Clientes / endereços | preservados | 3 / 4 |
| SYSTEM_ADMIN / SELLER_ADMIN ativos | 1 / 1 | 1 / 1 |
| `ADMIN` legado ativo | 0 | 0 (2 inativos, preservados) |
| Pedidos / itens / outbox / jobs / PixCharge | 0 | 0 / 0 / 0 / 0 / 0 |
| Reservas derivadas de pedidos | 0 | 0 (reservado total 0) |
| Eventos Stripe ligados a pedidos | 0 | 0 |
| Analytics do site | 0 | 0 |
| Analytics de vendas (lidos de pedidos) | 0 | 0 |
| Clientes consumindo RARE10 | 0 (exceção de pré-lançamento) | 0 |
| Suporte | preservado | 0 → 0 (ver §7 para o caso com dados) |
| Auditoria de segurança | preservada (+1 do reset) | 5 → 6 |
| Códigos MFA de recuperação | preservados | 20 |
| Estoque total | 63 + 1 devolvido | 64 |
| Item órfão / pagamento órfão / reserva órfã | 0 | 0 / 0 / 0 |
| Movimento de pedido restante | 0 | 0 |
| Estoque negativo / reservado negativo / reservado > estoque / reservado sem pedido | 0 | 0 / 0 / 0 / 0 |
| UNIQUE com mais de 1 unidade | 0 | 0 |

## 7. Segundo ensaio — caminhos sem dados no backup de setembro

O backup de 19/09 é anterior a suporte, analytics e notificações. Em `rare_cs_rehearsal_b`
(restaurado do mesmo arquivo e migrado), foram inseridas linhas **sintéticas** ligadas a um pedido
restaurado: 1 solicitação de suporte, 1 notificação do pedido e 1 notificação geral, 7 eventos de
analytics, 1 e-mail de outbox e 1 linha de auditoria de segurança. Resultado do mesmo bloco de reset:

- suporte **preservado**: vínculo com o pedido limpo (`orderId` NULL), `orderNumberSnapshot` mantido,
  status intacto;
- a notificação do pedido foi removida; a notificação geral ficou;
- analytics 7 → 0; outbox 1 → 0; auditoria 1 → 2 (a linha de segurança mais a do reset).

## 8. Rollback (restore proof)

Em `rare_cs_rollback` (restaurado + migrado):
1. B1 do lab: `pg_dump --format=custom`, 117327 bytes, sha256 `790bbc7b…`, `pg_restore --list` OK.
2. Reset `commit=true` → pedidos 0.
3. Rollback do runbook (§9.3): `pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error`
   de B1 sobre o mesmo banco → exit 0.
4. Contagens completas **idênticas** às de antes do reset (diff vazio); `migrate status` up to date;
   `migrate diff` vazio.

O mesmo procedimento (dump → sha256 → `--list` → restore conferido) é o do backup B2 "PRE-LAUNCH
CLEAN BASELINE".

## 9. Limites

- Os bancos do ensaio são locais e descartáveis (`rare_cs_rehearsal`, `rare_cs_rehearsal_b`,
  `rare_cs_rollback`); nenhum dump foi versionado.
- A produção real pode ter mais dados que o backup de setembro. Por isso o runbook exige backup novo,
  prévia conferida e contagens esperadas passadas ao reset, que aborta se divergirem.
- O caminho de rollback de **produção** (restore sobre o Postgres do Railway) não foi exercido; só o
  procedimento equivalente no lab.
