# Production Clean Slate — runbook do operador

Zera o histórico comercial de **pré-lançamento** da produção (pedidos e tudo o que deriva deles,
analytics do site) e troca os Admins legados pelos dois papéis escopados, **preservando** clientes,
endereços, catálogo, estoque base, suporte e trilhas de segurança. Checkout continua **desligado** do
começo ao fim.

Ensaio completo sobre um backup real de produção restaurado em banco descartável:
[`PRODUCTION_CLEAN_SLATE_REHEARSAL.md`](../cycles/rare-pre-launch/PRODUCTION_CLEAN_SLATE_REHEARSAL.md).
O SQL abaixo é exatamente o que o ensaio executou: ele foi extraído deste arquivo pelos rótulos dos
blocos (`sql clean-slate-*`).

> Nada aqui roda sozinho. Cada fase tem uma pessoa responsável e um ponto de parada. Em qualquer
> divergência: **PARE** e vá para a seção 9 (rollback). Nunca "consertar em produção" depois de uma
> falha parcial.

## 0. O que este runbook NÃO faz

- Não apaga clientes, endereços, credenciais de cliente, catálogo, imagens, promoções, banners,
  configurações da loja, `SupportRequest`, `AdminAuditLog`, códigos MFA, `OperationalEvidence`.
- Não apaga contas Admin: as legadas são **desativadas** (com sessões revogadas e auditoria).
- Não toca no histórico dos provedores (Asaas/Stripe). O banco local e o provedor são superfícies
  diferentes; cobranças antigas continuam no painel do provedor.
- Não liga checkout, provedor de pagamento, frete automático ou e-mail.
- Não "reseta" peça única para 1. O estoque é reconciliado pelo ledger (`InventoryMovement`).
- Não é uma ferramenta genérica de "apagar tudo": o SQL só remove pedidos e o que depende deles, e
  aborta se as contagens não forem as que o operador conferiu na prévia.

## 1. Pré-condições (todas obrigatórias, registradas na evidência)

| # | Condição | Como verificar |
|---|---|---|
| P1 | Auditoria independente = **GO** para o SHA exato | relatório da auditoria cita o SHA |
| P2 | SHA aprovado = HEAD do PR | `git rev-parse` do PR = SHA do relatório |
| P3 | CI = PASS nesse SHA | GitHub Actions do PR |
| P4 | `docs/security/RELEASE_FREEZE.json` = `CLEARED` e `node scripts/release-freeze.mjs --target=production` com exit 0 | saída do comando |
| P5 | Produção com `CHECKOUT_ENABLED=false` e `PAYMENT_PROVIDER=disabled` (e sem `STRIPE_*`, `CRON_SECRET_PREVIOUS`) | Railway → `rare` e `rare-cron` → Variables (só nomes/flags; nunca copiar valores) |
| P6 | Backup **novo** de produção feito nesta janela (seção 3) | arquivo + sha256 |
| P7 | Esse backup **restaurado** em banco descartável e conferido (seção 3) | contagens do restore = contagens da prévia |
| P8 | Janela combinada; ninguém mais operando o Admin; `rare-cron` saudável | logs do worker |

Se qualquer linha falhar: não comece.

## 2. Papéis

- **Operador:** executa os comandos, nunca cola valores de segredo em chat, ticket ou documento.
- **Revisor:** confere cada ponto de parada (prévia, contagens, Admins) antes do passo seguinte.
- Credenciais dos novos Admins: geradas e guardadas no cofre do responsável; nunca em `.env`
  versionado, chat ou evidência.

## 3. Backup antes (B1) e prova de restauração

1. `pg_dump --format=custom` do Postgres de produção, pelo acesso já aprovado ao serviço
   `Postgres` do ambiente `production` (o mesmo procedimento de `output/final-release`, fora do Git).
2. `sha256sum <arquivo>`; anotar bytes, sha256, horário UTC.
3. `pg_restore --list <arquivo>` sem erro (use um `pg_restore` ≥ versão do servidor; o servidor é
   PostgreSQL 18).
4. Restaurar em PostgreSQL **local/descartável** (`pg_restore --no-owner --no-acl --exit-on-error`),
   rodar `prisma migrate deploy` e o bloco `clean-slate-preview` (seção 6). As contagens do restore
   têm de bater com a prévia feita em produção no passo 6.
5. Guardar B1 fora do Git, com retenção definida pelo dono. **B1 é o arquivo de auditoria** dos
   pedidos de pré-lançamento: depois do reset, a única cópia deles é este backup (e o painel do
   provedor).

## 4. Ordem de execução (não alterar)

| Passo | Ação | Ponto de parada |
|---|---|---|
| 1 | Deploy do candidato aprovado em produção com checkout OFF | web e `rare-cron` no SHA aprovado; `/api/health` 200; `POST /api/checkout` 503 |
| 2 | Migrations aprovadas (o pre-deploy do web já roda `release-freeze` + `prisma migrate deploy`) | `prisma migrate status` = up to date; `migrate diff` vazio |
| 3 | Criar o SYSTEM_ADMIN (seção 5.1) | conta criada, `mustChangePassword=true` |
| 4 | Primeiro login do SYSTEM_ADMIN: senha → cadastro MFA → troca da senha | entra em `/admin/users` |
| 5 | Validar SYSTEM_ADMIN | vê Usuários/Segurança/Prontidão/Configurações; `/admin/orders` → "Sem acesso" |
| 6 | Criar o SELLER_ADMIN **pelo SYSTEM_ADMIN** em `/admin/users` | senha temporária exibida uma vez |
| 7 | Primeiro login do SELLER_ADMIN: senha temporária → MFA → troca da senha | entra em `/admin` |
| 8 | Validar SELLER_ADMIN | vê Pedidos/Produtos/Clientes/Suporte; `/admin/users` → "Sem acesso" |
| 9 | **Só então** desativar cada conta `ADMIN` legada (seção 5.2) | 0 `ADMIN` ativa |
| 10 | Sessões legadas revogadas (a desativação já incrementa `sessionVersion`) | sessão aberta de Admin legado volta ao login |
| 11 | Prévia do reset (seção 6, bloco `clean-slate-preview`) | revisor confere contagens e lista de variantes |
| 12 | Reset em modo ensaio (`-v commit=false`) e depois real (`-v commit=true`) | guards passam; `COMMIT` |
| 13 | Verificação (bloco `clean-slate-verify`) | todas as checagens = 0 / iguais |
| 14 | Backup B2 **PRE-LAUNCH CLEAN BASELINE** (seção 8) | sha256 + restore conferido |
| 15 | Checkout continua OFF. Abrir comércio é outra decisão, outro runbook | — |

Nunca desativar os Admins antigos antes de os dois novos estarem funcionais (passos 4–8).

## 5. Admins

### 5.1 SYSTEM_ADMIN de bootstrap

```bash
railway run --service rare --environment production -- sh -c 'ADMIN_ROLE=SYSTEM_ADMIN CONFIRM_PRODUCTION_ADMIN=true ADMIN_EMAIL="$NEW_SYSTEM_ADMIN_EMAIL" ADMIN_PASSWORD="$NEW_SYSTEM_ADMIN_BOOTSTRAP_PASSWORD" npm run admin:create'
```

- `NEW_SYSTEM_ADMIN_EMAIL` e `NEW_SYSTEM_ADMIN_BOOTSTRAP_PASSWORD` vêm do cofre do operador, exportados
  só na sessão do terminal; em produção a senha precisa de ≥ 12 caracteres com maiúscula, minúscula e
  número.
- A conta nasce com `mustChangePassword=true`: o primeiro login exige MFA e depois a troca da senha de
  bootstrap (`/admin/change-password`). A senha de bootstrap deixa de valer.

### 5.2 SELLER_ADMIN e desativação dos legados — pela UI (caminho auditado)

- SELLER_ADMIN: o SYSTEM_ADMIN cria em `/admin/users` → "Criar conta" → papel "Administrador
  Vendedor". A senha temporária aparece uma vez; entregar por canal seguro.
- Legados: em `/admin/users`, para cada conta `ADMIN` ("Admin legado (acesso total)") → **Desativar**.
  A ação incrementa `sessionVersion` (sessões revogadas na hora) e grava `admin_user.deactivated` em
  `AdminAuditLog`. Contas não são apagadas: o histórico de auditoria aponta para elas.
- Fallback SQL (só se a UI estiver indisponível), com as mesmas garantias e auditoria:

```sql clean-slate-legacy-admins
-- psql -v commit=false|true -f <este bloco>. Recusa se não houver um SYSTEM_ADMIN e um SELLER_ADMIN
-- ativos, com MFA cadastrado e senha de bootstrap já trocada.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF (SELECT count(*) FROM "User" WHERE role = 'SYSTEM_ADMIN' AND active AND "mfaEnabledAt" IS NOT NULL AND NOT "mustChangePassword") < 1
     OR (SELECT count(*) FROM "User" WHERE role = 'SELLER_ADMIN' AND active AND "mfaEnabledAt" IS NOT NULL AND NOT "mustChangePassword") < 1 THEN
    RAISE EXCEPTION 'STOP: new SYSTEM_ADMIN and SELLER_ADMIN must be active, MFA-enrolled and past the first password change';
  END IF;
END $$;
WITH deactivated AS (
  UPDATE "User" SET active = false, "sessionVersion" = "sessionVersion" + 1, "updatedAt" = timezone('UTC', now())
  WHERE role = 'ADMIN' AND active
  RETURNING id
)
INSERT INTO "AdminAuditLog" (id, "actorUserId", "actorLabel", action, "entityType", "entityId", before, after, "createdAt")
SELECT 'cs_' || md5(id || clock_timestamp()::text), NULL, 'clean-slate operator', 'admin_user.deactivated', 'User', id,
       '{"active": true}'::jsonb, '{"active": false, "sessionsRevoked": true}'::jsonb, timezone('UTC', now())
FROM deactivated;
SELECT 'legacy_admin_active_after', count(*) FROM "User" WHERE role = 'ADMIN' AND active;
\if :commit
COMMIT;
\else
ROLLBACK;
\endif
```

## 6. Reset comercial

### 6.1 Grafo mapeado (schema real, `prisma/schema.prisma`)

| Tabela | Ligação com `Order` | Tratamento |
|---|---|---|
| `OrderItem` | FK `orderId` CASCADE | removida com o pedido |
| `EmailOutbox` | FK `orderId` CASCADE | removida com o pedido |
| `CheckoutExpiryJob` | FK `orderId` CASCADE | removida com o pedido |
| `PixCharge` | FK `orderId` CASCADE | removida com o pedido |
| `InventoryMovement` | FK `orderId`/`orderItemId` SET NULL | efeito revertido no `ProductVariant` e linhas removidas (ver 6.2) |
| `AdminNotification` | FK `orderId` SET NULL | notificações dos pedidos removidas; as demais ficam |
| `SupportRequest` | FK `orderId` SET NULL | **preservada**; perde só o vínculo, mantém `orderNumberSnapshot` |
| `StripeEvent` | `orderId` sem FK | linhas dos pedidos removidos apagadas (dedupe de webhook; Stripe desconectada) |
| `AsaasWebhookEvent` | `paymentId` = `Order.asaasPaymentId`, sem FK | linhas dos pedidos removidos apagadas |
| `Customer.asaasCustomerId` | mapeamento do provedor | **preservado** (não é pedido) |
| RARE10 | derivado de pedidos (`paidAt`/status pago) | volta a elegível sozinho: sem pedidos, ninguém consumiu |
| Analytics de vendas (pedidos, receita, reembolsos, mais vendidos, conversão de compra) | lidos de `Order`/`OrderItem` | zeram sozinhos |
| `SiteAnalyticsEvent` | sem ligação | **apagada inteira** (visitantes, sessões, páginas, produtos vistos, cliques, carrinho) |
| `AdminAuditLog`, `AdminMfaRecoveryCode`, `OperationalEvidence`, `User` | — | preservadas |

Exceção de pré-lançamento: o RARE10 volta a ficar disponível porque os pedidos deixam de existir.
Depois do go-live a regra continua: reembolso **não** devolve o RARE10.

### 6.2 Estoque

O checkout grava no ledger `reserve` (+reservado), `sale` (−estoque, −reservado) e `release`
(−reservado), sempre com `orderId`. Edições de estoque no Admin não passam pelo ledger. Então:

- estoque final = estoque atual − Σ `stockDelta` dos movimentos dos pedidos removidos;
- reservado final = reservado atual − Σ `reservedDelta` desses movimentos, que tem de dar **0**
  (não há pedido aberto: checkout está OFF);
- ajustes manuais e o estoque inicial ficam intactos, porque não estão nesses movimentos.

A prévia lista cada variante que muda. O revisor confere **fisicamente** se a peça devolvida ao
estoque ainda está na loja (pedido de teste não enviado). Se não estiver, não altere o SQL: depois do
reset, ajuste no Admin (produto → estoque), que é a fonte normal.

### 6.3 Prévia (somente leitura)

```sql clean-slate-preview
-- psql -f <este bloco>. Não altera nada (transação READ ONLY + ROLLBACK).
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 'database', current_database();
SELECT 'orders', count(*) FROM "Order";
SELECT 'order_items', count(*) FROM "OrderItem";
SELECT 'open_orders', count(*) FROM "Order" WHERE status IN ('pending', 'awaiting_payment');
SELECT 'customers', count(*) FROM "Customer";
SELECT 'support_requests', count(*) FROM "SupportRequest";
SELECT 'admin_audit_log', count(*) FROM "AdminAuditLog";
SELECT 'order_movements', count(*) FROM "InventoryMovement" m
  WHERE m."orderId" IS NOT NULL OR m."orderItemId" IS NOT NULL;
SELECT 'order_movements_without_variant', count(*) FROM "InventoryMovement" m
  WHERE (m."orderId" IS NOT NULL OR m."orderItemId" IS NOT NULL) AND m."variantId" IS NULL;
SELECT 'paid_without_sale_movement', count(*) FROM "Order" o
  WHERE (o."paidAt" IS NOT NULL OR o.status IN ('paid', 'processing', 'shipped', 'delivered', 'refunded'))
    AND NOT EXISTS (SELECT 1 FROM "InventoryMovement" m WHERE m."orderId" = o.id AND m.type = 'sale');
SELECT 'site_analytics_events', count(*) FROM "SiteAnalyticsEvent";
-- Variantes cujo estoque muda (sem PII: produto, tamanho, política, antes → depois).
SELECT 'variant_change', p.slug, v.size, p."stockPolicy", v.stock, v."reservedStock",
       v.stock - sum(m."stockDelta") AS stock_after, v."reservedStock" - sum(m."reservedDelta") AS reserved_after
FROM "InventoryMovement" m
JOIN "ProductVariant" v ON v.id = m."variantId"
JOIN "Product" p ON p.id = v."productId"
WHERE m."orderId" IS NOT NULL OR m."orderItemId" IS NOT NULL
GROUP BY p.slug, v.size, p."stockPolicy", v.stock, v."reservedStock"
HAVING sum(m."stockDelta") <> 0 OR sum(m."reservedDelta") <> 0
ORDER BY p.slug, v.size;
ROLLBACK;
```

STOP se `open_orders`, `order_movements_without_variant` ou `paid_without_sale_movement` ≠ 0: o
ledger não explica o estoque e a reversão automática não é segura. Escale ao revisor.

### 6.4 Reset (uma transação, com guards)

Variáveis do psql, copiadas da prévia **conferida pelo revisor**:
`expected_db`, `expected_orders`, `expected_order_items`, `expected_customers`,
`expected_order_movements`, e `commit` (`false` primeiro; `true` só depois do ensaio passar).

```sql clean-slate-reset
-- psql -v expected_db=... -v expected_orders=N -v expected_order_items=N -v expected_customers=N
--      -v expected_order_movements=N -v commit=false|true -f <este bloco>
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT set_config('cs.expected_db', :'expected_db', true),
       set_config('cs.expected_orders', :'expected_orders', true),
       set_config('cs.expected_order_items', :'expected_order_items', true),
       set_config('cs.expected_customers', :'expected_customers', true),
       set_config('cs.expected_order_movements', :'expected_order_movements', true);
LOCK TABLE "Order", "OrderItem", "ProductVariant", "InventoryMovement", "Customer" IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE cs_before ON COMMIT DROP AS
SELECT (SELECT count(*) FROM "Customer") AS customers,
       (SELECT count(*) FROM "CustomerAddress") AS addresses,
       (SELECT count(*) FROM "SupportRequest") AS support,
       (SELECT count(*) FROM "AdminAuditLog") AS audit,
       (SELECT count(*) FROM "User") AS users,
       (SELECT count(*) FROM "Product") AS products,
       (SELECT count(*) FROM "ProductVariant") AS variants;

DO $$
BEGIN
  IF current_database() <> current_setting('cs.expected_db') THEN
    RAISE EXCEPTION 'STOP: connected to %, expected %', current_database(), current_setting('cs.expected_db');
  END IF;
  IF (SELECT count(*) FROM "Order") <> current_setting('cs.expected_orders')::int
     OR (SELECT count(*) FROM "OrderItem") <> current_setting('cs.expected_order_items')::int
     OR (SELECT count(*) FROM "Customer") <> current_setting('cs.expected_customers')::int
     OR (SELECT count(*) FROM "InventoryMovement" WHERE "orderId" IS NOT NULL OR "orderItemId" IS NOT NULL) <> current_setting('cs.expected_order_movements')::int THEN
    RAISE EXCEPTION 'STOP: counts differ from the reviewed preview';
  END IF;
  IF EXISTS (SELECT 1 FROM "Order" WHERE status IN ('pending', 'awaiting_payment')) THEN
    RAISE EXCEPTION 'STOP: an order is still open (checkout must be OFF)';
  END IF;
  IF EXISTS (SELECT 1 FROM "InventoryMovement" WHERE ("orderId" IS NOT NULL OR "orderItemId" IS NOT NULL) AND "variantId" IS NULL) THEN
    RAISE EXCEPTION 'STOP: an order movement has no variant';
  END IF;
END $$;

CREATE TEMP TABLE cs_orders ON COMMIT DROP AS SELECT id, "asaasPaymentId" FROM "Order";
CREATE TEMP TABLE cs_items ON COMMIT DROP AS SELECT id FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM cs_orders);
CREATE TEMP TABLE cs_movements ON COMMIT DROP AS
SELECT id, "variantId", "stockDelta", "reservedDelta" FROM "InventoryMovement"
WHERE "orderId" IN (SELECT id FROM cs_orders) OR "orderItemId" IN (SELECT id FROM cs_items);

-- 1. Estoque: desfaz só o efeito dos movimentos dos pedidos removidos.
UPDATE "ProductVariant" v
SET stock = v.stock - r.stock_delta, "reservedStock" = v."reservedStock" - r.reserved_delta, "updatedAt" = timezone('UTC', now())
FROM (SELECT "variantId", sum("stockDelta") AS stock_delta, sum("reservedDelta") AS reserved_delta FROM cs_movements GROUP BY "variantId") r
WHERE v.id = r."variantId" AND (r.stock_delta <> 0 OR r.reserved_delta <> 0);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProductVariant" WHERE stock < 0 OR "reservedStock" <> 0) THEN
    RAISE EXCEPTION 'STOP: reversal would leave negative stock or a reservation without an order';
  END IF;
  IF EXISTS (SELECT 1 FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE p."stockPolicy" = 'UNIQUE' AND v.stock > 1) THEN
    RAISE EXCEPTION 'STOP: a one-of-a-kind piece would end with more than one unit';
  END IF;
END $$;

-- 2. Dependentes sem cascade.
DELETE FROM "InventoryMovement" WHERE id IN (SELECT id FROM cs_movements);
DELETE FROM "AdminNotification" WHERE "orderId" IN (SELECT id FROM cs_orders);
DELETE FROM "StripeEvent" WHERE "orderId" IN (SELECT id FROM cs_orders);
DELETE FROM "AsaasWebhookEvent" WHERE "paymentId" IN (SELECT "asaasPaymentId" FROM cs_orders WHERE "asaasPaymentId" IS NOT NULL);

-- 3. Pedidos (OrderItem, EmailOutbox, CheckoutExpiryJob e PixCharge em cascade;
--    SupportRequest.orderId vira NULL e a solicitação é preservada).
DELETE FROM "Order" WHERE id IN (SELECT id FROM cs_orders);

-- 4. Analytics comportamental do site.
DELETE FROM "SiteAnalyticsEvent";

-- 5. Guards finais: nada preservado mudou, nada órfão.
DO $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM cs_before;
  IF (SELECT count(*) FROM "Order") <> 0 OR (SELECT count(*) FROM "OrderItem") <> 0
     OR (SELECT count(*) FROM "EmailOutbox") <> 0 OR (SELECT count(*) FROM "CheckoutExpiryJob") <> 0
     OR (SELECT count(*) FROM "PixCharge") <> 0 OR (SELECT count(*) FROM "SiteAnalyticsEvent") <> 0 THEN
    RAISE EXCEPTION 'STOP: order-derived rows remain';
  END IF;
  IF (SELECT count(*) FROM "Customer") <> b.customers OR (SELECT count(*) FROM "CustomerAddress") <> b.addresses
     OR (SELECT count(*) FROM "SupportRequest") <> b.support OR (SELECT count(*) FROM "AdminAuditLog") <> b.audit
     OR (SELECT count(*) FROM "User") <> b.users OR (SELECT count(*) FROM "Product") <> b.products
     OR (SELECT count(*) FROM "ProductVariant") <> b.variants THEN
    RAISE EXCEPTION 'STOP: a preserved table changed';
  END IF;
  IF EXISTS (SELECT 1 FROM "InventoryMovement" WHERE "orderId" IS NOT NULL OR "orderItemId" IS NOT NULL) THEN
    RAISE EXCEPTION 'STOP: an order movement survived';
  END IF;
END $$;

-- 6. Rastro sem PII.
INSERT INTO "AdminAuditLog" (id, "actorUserId", "actorLabel", action, "entityType", "entityId", before, after, "createdAt")
SELECT 'cs_reset_' || md5(clock_timestamp()::text), NULL, 'clean-slate operator', 'production.clean_slate', 'Database', current_database(),
       jsonb_build_object('orders', current_setting('cs.expected_orders')::int, 'orderItems', current_setting('cs.expected_order_items')::int,
                          'orderMovements', current_setting('cs.expected_order_movements')::int),
       jsonb_build_object('orders', 0, 'siteAnalyticsEvents', 0, 'customersPreserved', current_setting('cs.expected_customers')::int),
       timezone('UTC', now());

SELECT 'reset_result', 'orders=0', 'customers=' || (SELECT count(*) FROM "Customer");
\if :commit
COMMIT;
\else
ROLLBACK;
\endif
```

### 6.5 Verificação (somente leitura)

```sql clean-slate-verify
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 'orders', count(*) FROM "Order";
SELECT 'order_items', count(*) FROM "OrderItem";
SELECT 'email_outbox', count(*) FROM "EmailOutbox";
SELECT 'checkout_expiry_jobs', count(*) FROM "CheckoutExpiryJob";
SELECT 'pix_charges', count(*) FROM "PixCharge";
SELECT 'site_analytics_events', count(*) FROM "SiteAnalyticsEvent";
SELECT 'customers', count(*) FROM "Customer";
SELECT 'customer_addresses', count(*) FROM "CustomerAddress";
SELECT 'support_requests', count(*) FROM "SupportRequest";
SELECT 'admin_audit_log', count(*) FROM "AdminAuditLog";
SELECT 'system_admin_active', count(*) FROM "User" WHERE role = 'SYSTEM_ADMIN' AND active;
SELECT 'seller_admin_active', count(*) FROM "User" WHERE role = 'SELLER_ADMIN' AND active;
SELECT 'legacy_admin_active', count(*) FROM "User" WHERE role = 'ADMIN' AND active;
SELECT 'customers_consuming_rare10', count(DISTINCT "customerId") FROM "Order"
  WHERE "customerId" IS NOT NULL AND ("paidAt" IS NOT NULL OR status IN ('paid', 'processing', 'shipped', 'delivered'));
SELECT 'orphan_order_items', count(*) FROM "OrderItem" i WHERE NOT EXISTS (SELECT 1 FROM "Order" o WHERE o.id = i."orderId");
SELECT 'orphan_payments', count(*) FROM "PixCharge" c WHERE NOT EXISTS (SELECT 1 FROM "Order" o WHERE o.id = c."orderId");
SELECT 'orphan_reservations', count(*) FROM "CheckoutExpiryJob" j WHERE NOT EXISTS (SELECT 1 FROM "Order" o WHERE o.id = j."orderId");
SELECT 'order_movements_left', count(*) FROM "InventoryMovement" WHERE "orderId" IS NOT NULL OR "orderItemId" IS NOT NULL;
SELECT 'negative_stock', count(*) FROM "ProductVariant" WHERE stock < 0;
SELECT 'negative_reserved', count(*) FROM "ProductVariant" WHERE "reservedStock" < 0;
SELECT 'reserved_gt_stock', count(*) FROM "ProductVariant" WHERE "reservedStock" > stock;
SELECT 'reserved_without_order', count(*) FROM "ProductVariant" WHERE "reservedStock" <> 0;
SELECT 'unique_above_one', count(*) FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE p."stockPolicy" = 'UNIQUE' AND v.stock > 1;
ROLLBACK;
```

Esperado: pedidos e derivados = 0; clientes, endereços, suporte = valores da prévia; auditoria =
prévia + 1 (`production.clean_slate`) + 1 por Admin desativado; 1 SYSTEM_ADMIN e 1 SELLER_ADMIN
ativos; 0 legado ativo; todas as checagens de integridade = 0. No Admin: Analytics do site e
dashboard comercial zerados; produtos com o estoque esperado na prévia.

## 7. Depois do reset

- Prontidão (`/admin/readiness`): "Estoque íntegro".
- Cliente sem compra legítima vê o RARE10 de novo (exceção de pré-lançamento, seção 6.1).
- Checkout continua OFF; `POST /api/checkout` → 503.

## 8. Backup depois (B2 — PRE-LAUNCH CLEAN BASELINE)

Repetir a seção 3 (dump, sha256, `--list`, restore descartável, bloco `clean-slate-verify` no
restore). B2 é o ponto de retorno antes de ligar o comércio. Sem B2 conferido, não abrir vendas.

## 9. Rollback

Falha em qualquer guard: o `RAISE EXCEPTION` aborta a transação e nada muda — rode a prévia de novo
e investigue antes de qualquer nova tentativa.

Falha depois de um `COMMIT` (verificação divergente, dado errado):

1. **PARE.** Não tente reparar em produção.
2. Checkout continua OFF e `PAYMENT_PROVIDER=disabled` (não mudar nada em variáveis).
3. Restaurar B1 sobre o banco de produção, pelo procedimento aprovado de restore do Postgres de
   produção (janela, `pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error` no
   database correto, conferido por `current_database()` e pela identidade do serviço no Railway).
4. Rodar `prisma migrate status` e o bloco `clean-slate-preview`: as contagens têm de voltar às de B1.
5. Registrar o incidente; uma nova tentativa exige nova prévia, novo B1 e nova revisão.

Admins: um Admin legado desativado por engano é reativado em `/admin/users` (auditado), sem restore.

## 10. Evidência (sem PII, sem segredos)

Registrar em `docs/security/evidence/` ou no ciclo: SHA aprovado, horário UTC de cada passo, sha256 e
bytes de B1/B2, contagens da prévia e da verificação, lista de variantes alteradas (slug/tamanho),
resultado das validações dos Admins (papel, MFA cadastrado, "Sem acesso" esperado), operador e
revisor. Nunca: e-mails, nomes, CPF, endereços, senhas, TOTP, códigos de recuperação, URLs de banco.
