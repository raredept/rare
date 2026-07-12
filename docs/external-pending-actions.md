# Pendências externas

Nenhum item deste documento foi aplicado automaticamente. Todos dependem de sessão,
token, contratação ou teste manual autorizado.

## Cloudflare / Railway

Criar no Cloudflare:

- Tipo: `CNAME`
- Nome: `www`
- Destino: `ddlhpz66.up.railway.app`

Se a Railway solicitar verificação:

- Tipo: `TXT`
- Nome: `_railway-verify.www`
- Valor: `railway-verify=e555eaf310d04e9a6291dab0682cb4dd80213566ad37635f2316941362d83a12`

O redirect permanente por host continua definido em `next.config.ts`, de `www` para
`https://raredept.com.br/:path*`. Depois da propagação, validar o CNAME com uma consulta
DNS, executar `curl.exe -I https://www.raredept.com.br/algum-caminho` e confirmar status
308/301 e `Location` no domínio sem `www`; depois rodar o smoke público no domínio canônico.

## Melhor Envio

Obter token sandbox ou concluir OAuth, configurar somente no ambiente, ativar
`melhor_envio` explicitamente no Admin e homologar PAC/SEDEX com carrinhos reais de
staging. Ver `docs/melhor-envio-homologation.md`.

## Stripe

Criar staging e banco isolados, configurar `sk_test_...` e webhook test, executar o
runbook assinado e validar pedido, estoque e expiração. Só depois considerar live e
reativação do checkout. Production deve continuar com `CHECKOUT_ENABLED=false`.

## E-mail

Selecionar provedor e obter os valores reais de MX, SPF e DKIM. Preservar e revisar o
DMARC existente após alinhamento. O driver da aplicação permanece desabilitado.

## Dispositivo móvel

No iPhone, instalar o site na Tela de Início, abrir o PWA, entrar no Admin e ativar o
dispositivo em `/admin/notifications`. Confirmar permissão, cadastro, remoção do aparelho
atual e recebimento somente em homologação autorizada.
