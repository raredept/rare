# 13 — Plano de produção

Nada foi publicado em produção neste ciclo.

## Fase 0 — antes do merge

- Staging completo (12_STAGING) com todos os passos PASS.
- Decidir a ordem com a linha `codex/backend-evolution-20261007` (redesign) e resolver o conflito na home/product card.
- Revisão humana do PR.

## Fase 1 — deploy do código com tudo desligado

| Variável | Valor |
|---|---|
| `ADMIN_MFA_ENCRYPTION_KEY` | **nova, exclusiva de produção, configurada ANTES do deploy** |
| `PAYMENT_PROVIDER` | não definir (= `stripe`, comportamento atual) |
| `PROMOTIONS_ENABLED` | padrão (ligado; sem promoção ativa nada muda) |
| `BLACK_FRIDAY_HOME_ENABLED` | `false` até a campanha ser aprovada |

Efeito inevitável: **produção sempre exige MFA**. No primeiro acesso após o deploy todas as sessões Admin caem e cada administrador passa pelo cadastro. Fazer num horário combinado, com o responsável técnico disponível e o runbook `docs/runbooks/admin-mfa-recovery.md` aberto. Sem a chave, nenhum Admin entra (o login avisa; health/readiness acusam).

Backup do banco antes; migrations aditivas no preDeploy.

## Fase 2 — MFA confirmado

Um Admin cadastrado, TOTP testado, códigos de recuperação guardados fora do celular, `/admin/security` mostrando "Ativa". De preferência um segundo administrador também.

## Fase 3 — Black Friday

Seed DRAFT → Admin define produtos, preços, % real, datas (horário de Brasília), banner + alt, CTA → preview desktop/mobile → conferir estoque → ativar → `BLACK_FRIDAY_HOME_ENABLED` padrão (ligado). Checklist §77 assinado pelo responsável comercial.

## Fase 4 — Asaas piloto (só após Sandbox PASS)

1. Gerar chave `$aact_prod_` (não imprimir; usar em ≤ 3 meses ou ela é desativada por inatividade).
2. Webhook de produção com token novo; eventos de 12_STAGING passo 4.
3. `ASAAS_ENV=production`, chave e token no web **e** worker; `PAYMENT_PROVIDER=asaas`.
4. Uma compra real controlada (valor baixo, Pix) → cobrança, webhook, pedido pago, estoque, Admin, e-mail; reembolso dessa compra pelo Admin.
5. Se qualquer item falhar: `PAYMENT_PROVIDER=stripe` (14_ROLLBACK).

## Fase 5 — remoção do Stripe

Só com todos os gates de 06_PAYMENT_MIGRATION em PASS, em ciclo próprio.
