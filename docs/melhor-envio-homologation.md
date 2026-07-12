# Homologação do Melhor Envio

## Estado seguro atual

A integração fica inativa até o Admin selecionar `melhor_envio` em Configurações.
Definir `SHIPPING_PROVIDER=melhor_envio` sozinho não substitui essa escolha. Sem token,
a API não faz chamada externa e retorna uma mensagem operacional segura.

## Variáveis

- `SHIPPING_PROVIDER=melhor_envio`
- `SHIPPING_ORIGIN_CEP` como fallback; o CEP salvo no Admin tem prioridade
- `MELHOR_ENVIO_TOKEN` ou `MELHOR_ENVIO_ACCESS_TOKEN`
- `MELHOR_ENVIO_ENV=sandbox` para homologação
- `MELHOR_ENVIO_SERVICES=1,2` para PAC e SEDEX
- `MELHOR_ENVIO_USER_AGENT` com identificação e contato válidos
- `MELHOR_ENVIO_TIMEOUT_MS=8000` (aceita 1000 a 30000)
- `MELHOR_ENVIO_BASE_URL` somente quando houver endpoint oficial alternativo

`MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET` e
`MELHOR_ENVIO_REDIRECT_URI` não substituem um access token. O projeto ainda não
persiste refresh token nem executa OAuth/renovação automática; enquanto isso, um
token expirado deve ser renovado fora da aplicação e atualizado na Railway.

## Roteiro

1. Criar ambiente Railway de staging com banco isolado e checkout global ainda desativado.
2. Obter token sandbox sem enviá-lo por chat, commit ou documentação.
3. Configurar as variáveis acima e fazer redeploy.
4. No Admin de staging, confirmar CEP de origem e selecionar Melhor Envio explicitamente.
5. Cotar CEPs válidos e inválidos com um item, múltiplos itens e quantidade maior que 1.
6. Confirmar PAC/SEDEX, preço, prazo, fallback de dimensões e mensagem de indisponibilidade.
7. Confirmar no checkout que a cotação é recalculada no servidor e não aceita preço do browser.
8. Rodar testes, readiness e smoke antes de qualquer decisão de produção.

As cotações não são armazenadas em cache nesta etapa. Um cache local seria incorreto
com múltiplas instâncias; um cache compartilhado exigiria política de chave, TTL e
invalidação específica para CEP, itens, preços e configuração. A resposta já expira
operacionalmente em 30 minutos e o checkout recalcula no backend.

Não faça chamadas reais sem token válido e não ative o frete automático em Production
antes da homologação manual e autorização do responsável.
