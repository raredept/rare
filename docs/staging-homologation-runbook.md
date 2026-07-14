# Runbook de preview e staging do release candidate

Este runbook prepara um ambiente de catálogo para revisão. Ele não autoriza mudança
na Railway, DNS, checkout, pagamento, cotação, e-mail, Push, cron ou backfill. O modo
obrigatório deste RC é `CHECKOUT_ENABLED=false` e `SHIPPING_ENABLED=false`.

## 1. Modos que não devem ser confundidos

| Modo | Objetivo | Escritas permitidas | Integrações |
| --- | --- | --- | --- |
| Preview por pull request | Revisar código, UI, SEO e acessibilidade | Nenhuma jornada intencional de escrita | Todas desabilitadas |
| Staging do RC | QA persistente e smoke pós-deploy | Somente setup técnico previamente aprovado | Todas desabilitadas |
| Laboratório futuro | Homologar Stripe/Melhor Envio/e-mail/Push | Somente dados sintéticos, sob autorização própria | Exclusivamente test/sandbox |

Habilitar checkout no laboratório futuro não aprova o RC atual e não deve ocorrer no
mesmo ambiente usado para o preview seguro.

## 2. Isolamento obrigatório

- Criar ambiente/serviço separado, sem alterar Production.
- Provisionar PostgreSQL e Redis próprios; não usar referências de Production.
- Usar bucket R2 próprio ou prefixo tecnicamente isolado, credenciais distintas e
  política que impeça acesso ao prefixo de produção.
- Usar URL, session secret, cron secret e demais secrets próprios.
- Não reutilizar endpoint nem signing secret de webhook.
- Manter `EMAIL_DRIVER=disabled`; não configurar SMTP/provider real.
- Não configurar VAPID privada nem subscriptions reais.
- Manter `CHECKOUT_ENABLED=false`, `SHIPPING_ENABLED=false` e provider manual.
- Não iniciar serviço cron. Se for indispensável validar a configuração, usar alvo,
  secret, banco e agenda exclusivos do staging.
- Manter `MEDIA_BACKFILL_ALLOW_PRODUCTION=false`; não executar `--apply`.
- Confirmar `noindex,nofollow` no HTML e `Disallow: /` em `robots.txt`.
- Sitemap, se servido, deve conter somente URLs canônicas públicas e nunca Admin/API.

O preview não está isolado se qualquer recurso mutável aponta para o mesmo serviço,
database, schema, namespace, bucket/prefixo ou credencial de Production.

## 3. Dados

Não copiar para preview/staging:

- senhas ou hashes de senha;
- tokens, secrets, sessões e cookies;
- endereços completos, CPF, telefone e e-mail reais;
- pedidos ou movimentos de estoque identificáveis;
- payloads de pagamento/webhook;
- subscriptions Push reais;
- logs, traces, dumps ou evidências com dados pessoais;
- objetos de storage privados ou URLs assinadas.

Preferir catálogo sintético ou um subconjunto público recriado. Se uma cópia parcial
for indispensável, executar o processo fora do app e registrar:

1. origem e responsável autorizador;
2. allowlist de tabelas/campos;
3. transformação irreversível de identificadores;
4. remoção de PII, tokens, sessões e relações com pedidos reais;
5. validação de contagens e amostra sanitizada;
6. prazo de retenção e descarte do ambiente.

Não usar seed, import, copy script ou backfill contra Production para preparar staging.

## 4. Riscos de preview por pull request

| Risco | Efeito | Gate |
| --- | --- | --- |
| Banco de produção compartilhado | Cadastro, sessão, migration ou teste pode alterar dados reais | Bloqueador |
| Redis de produção compartilhado | Colisão de rate limit, sessão ou namespace | Bloqueador |
| Storage compartilhado | Upload/remoção pode afetar mídia pública | Bloqueador sem prefixo/credencial isolados |
| Migration automática por PR | Schema muda antes de aprovação | Bloquear pre-deploy ou usar banco efêmero exclusivo |
| Cron ativa | Libera reservas no ambiente errado | Bloqueador; serviço desligado |
| Webhook real | Eventos de fornecedor chegam ao preview | Bloqueador; endpoint/secret ausentes |
| Indexação | Conteúdo duplicado ou ambiente interno no Google | Bloqueador; `noindex` + robots |
| Notificações | E-mail/Push chega a pessoas reais | Bloqueador; drivers/keys ausentes |
| Cadastro público | Usuários reais entram no ambiente de teste | Restringir acesso e não divulgar URL |

Preview automatizado por PR não deve aplicar migration a um banco persistente
compartilhado. Para schema compatível, use um banco efêmero por preview ou um staging
controlado com promoção manual.

## 5. Configuração mínima do RC

Usar a matriz em `docs/storefront-environment-matrix.md`. Antes do deploy, conferir
somente presença/classificação, nunca imprimir valores:

- URL própria e `APP_ENV=staging`/`preview`;
- PostgreSQL, Redis e R2 isolados;
- sessão Admin e cron secret distintos;
- `CHECKOUT_ENABLED=false`;
- `SHIPPING_ENABLED=false` e provider manual;
- Stripe e Melhor Envio vazios;
- `EMAIL_DRIVER=disabled`;
- VAPID e subscriptions ausentes;
- backfill/seed/bootstrap de produção bloqueados.

## 6. Deploy e smoke

1. Registrar `git rev-parse HEAD` e a divergência com o remoto.
2. Executar `npm run release:check` localmente.
3. Confirmar backup do ambiente de destino e rollback de aplicação.
4. Publicar somente após autorização específica, sem alterar Production/DNS.
5. Executar:

   ```bash
   npm run smoke:release -- --base-url=https://preview.example.com
   ```

6. Validar health, logs sanitizados e ausência de chamadas externas.
7. Executar QA visual desktop/mobile, teclado e leitor de tela quando disponível.
8. Registrar hash, URL, horário, responsável e resultados.

O comando bloqueia `raredept.com.br` por padrão. Smoke de produção requer autorização
separada e a opção consciente `--allow-production`.

## 7. Peso, dimensões e mídia

- Executar `npm run shipping:audit-products -- --format=json` somente leitura.
- Os cinco produtos conhecidos sem medidas não bloqueiam o catálogo, mas bloqueiam a
  futura ativação do frete automático.
- Executar backfill apenas em dry-run se houver necessidade de auditoria:

  ```bash
  npm run media:variants:backfill -- --limit=10 --dry-run
  ```

- Não usar `--apply` neste RC.

## 8. Homologações futuras, fora deste RC

### Melhor Envio

Usar token sandbox, origem válida, provider explicitamente selecionado e produtos sem
fallback. Testar PAC/SEDEX, cenários negativos e timeout em ambiente isolado. Nunca
usar token production no preview do RC.

### Stripe

Usar apenas `sk_test_...`, webhook test e banco isolado. Rodar o smoke guard antes de
qualquer ativação temporária. Validar assinatura, idempotência, aprovado, recusado,
cancelado e expirado sem dados reais. Nunca reutilizar endpoint/secret live.

### E-mail e Push

E-mail exige provider sandbox e destinatários de teste. Push exige VAPID e subscription
exclusivos do laboratório. iPhone requer instalação na Tela de Início e validação manual.

## 9. Aprovação e interrupção

Preview recebe GO somente com suíte, build, audit, release guard e smoke aprovados,
isolamento comprovado, health sem erro, noindex e todas as integrações desligadas.

Interromper diante de recurso de produção compartilhado, secret/PII exposto, chamada
externa inesperada, migration não revisada, indexação, erro 500/hydration, checkout ou
frete ativo, cron/webhook real ou qualquer escrita fora do ambiente isolado.
