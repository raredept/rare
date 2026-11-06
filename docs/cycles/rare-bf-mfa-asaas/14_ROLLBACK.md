# 14 — Rollback

| Alvo | Ação | Efeito | Precisa deploy? |
|---|---|---|---|
| Promoções | `PROMOTIONS_ENABLED=false` | preços promocionais somem de catálogo, carrinho e checkout ao mesmo tempo | só restart com a variável |
| Campanha da home | `BLACK_FRIDAY_HOME_ENABLED=false` | some da home; preços continuam | restart |
| Uma promoção | Pausar/Encerrar no Admin | efeito imediato, auditado | não |
| Pagamento | `PAYMENT_PROVIDER=stripe` | novos pagamentos voltam ao Stripe (+ Pix Mercado Pago se `PIX_ENABLED`); pedidos Asaas abertos continuam sendo reconciliados pelo worker | restart (web e worker) |
| Pagamento (emergência) | `PAYMENT_PROVIDER=disabled` | nenhum pagamento novo começa | restart |
| MFA | **não desligar em produção** (a flag é ignorada lá). Admin sem acesso → código de recuperação → reset técnico (`npm run admin:mfa-reset`) | — | não |
| Código inteiro | redeploy do commit anterior | colunas/tabelas novas ficam ociosas; nada a desfazer no banco | sim |

Não existe rollback de banco previsto: as migrations são aditivas e o código anterior as ignora.
