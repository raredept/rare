# Rate limit em producao

O app suporta dois drivers:

- `memory`: padrao para desenvolvimento local e testes. Nao e compartilhado entre instancias.
- `redis`: driver compartilhado via Redis REST/Upstash, recomendado para producao.

## Variaveis

Para producao, configure no provedor de ambiente:

```env
RATE_LIMIT_DRIVER="redis"
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
RATE_LIMIT_REDIS_PREFIX="rare:rate-limit"
```

Tambem sao aceitas as alternativas `REDIS_REST_URL` e `REDIS_REST_TOKEN`.

## Comportamento

Sem configuracao, desenvolvimento local continua usando `memory`.

Em producao com `RATE_LIMIT_DRIVER=memory`, `/api/health` fica `ok_with_warnings` e mostra que o driver ativo nao e compartilhado.

Em producao com `RATE_LIMIT_DRIVER=redis`, mas sem URL/token REST, o app continua funcionando com fallback para `memory` e `/api/health` emite warning claro.

Em producao com Redis REST configurado, `/api/health` mostra `activeDriver: "redis"`, `shared: true` e nao emite warning de `RATE_LIMIT_DRIVER`.

As chaves de rate limit sao hash SHA-256 antes de serem gravadas no driver, evitando armazenar e-mails/IPs legiveis no Redis.
