# Checklist Stripe Homologation (legado)

Este checklist foi substituido pelo guia canonico em
[docs/checkout-smoke-test.md](docs/checkout-smoke-test.md). Use o guia canonico
para executar a homologacao Stripe test-mode ponta a ponta.

Resumo minimo:

- use somente Stripe test mode e execute o guard antes do fluxo manual;
- nunca use chaves `sk_live_` ou `rk_live_`, cartao real, banco de producao ou o dominio publico de producao;
- mantenha a validacao de assinatura do webhook ativa;
- confirme o pedido pago no Admin somente depois do webhook;
- valide baixa de estoque, reserva e liberacao em falha, cancelamento ou expiracao;
- registre a aprovacao antes de habilitar venda aberta.
