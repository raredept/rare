# Runbook de homologação em staging

## Preparação

1. Criar ambiente/serviço Railway separado, sem alterar Production.
2. Provisionar PostgreSQL e Redis separados; nunca referenciar os serviços de Production.
3. Usar bucket separado ou prefixo exclusivo e credenciais próprias de staging.
4. Configurar domínio/subdomínio separado e todas as variáveis isoladamente.
5. Usar somente credenciais sandbox/test. Manter `CHECKOUT_ENABLED=false` inicialmente.
6. Fazer backup antes de importar dados e registrar contagens para rollback.

## Dados

- Copiar somente catálogo/configurações necessários.
- Não copiar secrets, sessões, hashes de senha ou evidências operacionais sensíveis.
- Clientes/pedidos, se indispensáveis, devem ser anonimizados antes da carga.
- Validar contagens por tabela e uma amostra funcional após a importação.
- Rollback: descartar o banco/bucket de staging ou restaurar o backup; nunca apontar
  Production para recursos de staging.

## Peso, dimensões e frete

1. Rodar `npm run shipping:audit-products -- --format=json`.
2. Corrigir pelo Admin apenas a amostra de staging; não preencher automaticamente.
3. Confirmar gramas/centímetros e revisar produtos com múltiplas variações.
4. Exigir zero produtos ativos com `usesFallback=true` antes do frete automático.

## Backfill de mídias

1. Executar `npm run media:variants:backfill -- --limit=10 --dry-run`.
2. Revisar a amostra e confirmar banco/bucket corretos.
3. Executar `--limit=1 --apply`, conferir original, duas variantes e URL persistida.
4. Aumentar para 5, 10 e lotes maiores somente sem divergências.
5. Interromper com Ctrl+C em erro repetido, referência concorrente, contagem inesperada,
   objeto ausente ou diferença entre banco e storage.
6. Nunca iniciar diretamente em Production.

## Melhor Envio

- Configurar token sandbox, ambiente `sandbox`, origem válida e timeout.
- Ativar `melhor_envio` explicitamente no Admin.
- Testar CEP válido/inválido, PAC/SEDEX, item único, múltiplos itens e quantidade > 1.
- Confirmar bloqueio antes da rede para produto sem medidas, timeout, resposta parcial
  e indisponibilidade sem vazamento de token.

## Stripe

1. Usar exclusivamente `sk_test_...`, webhook test e banco isolado.
2. Rodar o smoke guard antes de habilitar checkout em staging.
3. Validar assinatura inválida, evento duplicado e evento fora de ordem.
4. Homologar aprovado, recusado, cancelado e expirado; conferir `reserve`, `sale` e `release`.
5. Nunca reutilizar endpoint, secret ou credencial live.

## E-mail

- Usar provider sandbox/conta de teste, remetentes e Reply-To de staging.
- Renderizar os cinco templates e simular falha do provider.
- Confirmar que falha de e-mail não reverte pedido confirmado.

## Push

- Testar desktop, Android e PWA instalado na Tela de Início do iPhone.
- Confirmar cadastro idempotente, remoção do dispositivo atual e desativação em 404/410.
- Usar subscriptions e VAPID exclusivos de staging quando possível.

## Aprovação para futura ativação

- suíte, lint, typecheck, build, audit e smoke sem falhas;
- zero produto ativo dependente de fallback de frete;
- Redis compartilhado, cron e storage persistente comprovados;
- Melhor Envio sandbox com PAC/SEDEX e cenários negativos aprovados;
- Stripe test com assinatura, idempotência, estoque e expiração aprovados;
- nenhum secret/live credential ou dado pessoal real em staging;
- evidência registrada, rollback ensaiado e autorização formal do responsável.

Interrompa e faça rollback diante de alteração no ambiente errado, segredo exposto,
contagem divergente, baixa duplicada de estoque, webhook sem assinatura, mídia original
ausente após operação ou qualquer chamada a credencial live.
