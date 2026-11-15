# 13 — Plano de produção (2026-11-13)

## Gates antes de merge

- M-21 fechado: identidade do banco staging, backup, história atual limpa, drift explicado e executor único.
- Staging real, MFA real, Asaas Sandbox real, webhook real, E2E/security e revisão final PASS; CI PASS no SHA final.
- Sessão e cron de staging e produção contidos; credenciais Stripe retiradas dos consumidores ativos.
- `RELEASE_FREEZE.json` só pode ser CLEARED com evidência sanitizada e todas as condições da política 2 comprovadas.
- A revogação externa Stripe pode permanecer MANUAL_PENDING, sem declarar o incidente encerrado ou a chave revogada. Não basta desativar o checkout.

## Primeiro deploy em modo seguro

1. Backup de produção com tamanho, horário e procedimento de restauração conhecido.
2. Auditoria de migrations e drift específica de produção (não presumir igual staging); um executor. `db:history-audit` atualmente recusa produção: não remover a proteção para contornar essa restrição; usar uma auditoria somente leitura apropriada ao alvo.
3. Chaves de MFA, sessão, cron e webhook próprias de produção; não reutilizar staging nem restaurar valores expostos.
4. Revisar staged changes, pre-deploy, source SHA e consumers antes de aplicar:

```env
CHECKOUT_ENABLED=false
PAYMENT_PROVIDER=disabled
BLACK_FRIDAY_HOME_ENABLED=false
```

5. Deploy após os gates; provar SHA web/worker e migrations aplicadas, health, DB/Redis, Admin/MFA, conta, catálogo, pedidos, analytics, R2 e cotação (sem comprar etiqueta).
6. Cadastrar MFA dos responsáveis; códigos de recuperação ficam com eles e nunca em relatório.

## Asaas produção e piloto

- Só após Sandbox real PASS: conta aprovada, chave Production e webhook `https://raredept.com.br/api/asaas/webhook` com token exclusivo e apenas eventos tratados.
- Checkout ainda OFF: selecionar `PAYMENT_PROVIDER=asaas`, confirmar autenticação API, webhook, worker, estoque e frete.
- Só com readiness PASS: abrir `CHECKOUT_ENABLED=true` como piloto controlado.
- **O proprietário conclui a compra real. O agente não finaliza cobrança.** Conferir valor/frete, pagamento único, webhook idempotente, reserva/baixa única, Admin e e-mail. Pix cautelar não autoriza envio.
- Inconsistência ou segurança incerta: aplicar o rollback de [14_ROLLBACK](14_ROLLBACK.md), preservar dados e investigar.

## Black Friday

Campanha comercial fica DRAFT até haver produtos, desconto, início, fim, banner e CTA aprovados. Ela não é requisito para o site ou para Asaas funcionar.

## Estado desta execução

Nenhum merge, deploy de produção ou compra real executado. Evidência corrente em [CYCLE-FINAL-RELEASE-01](cycles/CYCLE-FINAL-RELEASE-01.md).
