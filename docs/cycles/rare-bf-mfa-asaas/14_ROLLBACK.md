# 14 — Rollback (política do proprietário, 2026-11-13)

## Pagamentos

O rollback oficial fecha pagamentos novos, no **web e worker**:

```env
CHECKOUT_ENABLED=false
PAYMENT_PROVIDER=disabled
```

**Não usar Stripe como fallback.** `PAYMENT_PROVIDER=stripe`, ausente ou desconhecido falha fechado no código candidato. Asaas é o único provedor de novos pagamentos. Pix Mercado Pago também não é reativado por `PIX_ENABLED`.

Pedidos anteriores conservam o provedor original. SDK, parsers e reconciliação históricos Stripe permanecem até um ciclo de cleanup após Sandbox e piloto Asaas. Sem credencial histórica, uma conciliação que precise da API deve permanecer pendente e investigável; nunca liberar estoque só por erro do provedor.

## Código e credenciais

Rollback de código exige artefato revisado com **secrets atuais**. O botão de rollback do Railway pode restaurar variáveis antigas: não usá-lo para restaurar sessão, cron ou Stripe comprometidos. Builds anteriores à aposentadoria Stripe não são rollback comercial seguro; manter checkout OFF e o acesso ao provedor desabilitado durante recuperação.

Nenhuma migration inversa destrutiva é prevista. Antes de qualquer mudança de banco: backup verificado, história e drift conhecidos, executor único.

## Outras operações

- Promoções: `PROMOTIONS_ENABLED=false` remove preços promocionais de catálogo, carrinho e checkout.
- Home: `BLACK_FRIDAY_HOME_ENABLED=false` esconde campanhas sem modificar preços.
- Uma campanha: Pausar/Encerrar pelo Admin, com auditoria.
- MFA: não desligar em produção. Usar recuperação ou reset técnico auditado, mantendo o responsável presente.
- Mudanças de variáveis precisam de ativação e prova de carregamento em todos os processos; restart isolado não comprova isso.
