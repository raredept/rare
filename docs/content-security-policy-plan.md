# Plano técnico de Content Security Policy

Não será emitida CSP ampla neste release candidate. A policy Report-Only anterior não
tinha endpoint de reports e conflitava com o runtime inline do Next/React. Aplicar
enforcement agora poderia quebrar storefront, Admin, imagens, Stripe futuro ou PWA sem
produzir telemetria acionável.

## Superfícies a mapear

| Superfície | Estado atual | Necessidade futura |
| --- | --- | --- |
| Scripts próprios | Chunks Next servidos em `self` | `script-src 'self'` com nonce/hash para bootstrap inline |
| Scripts inline | Next/React podem emitir bootstrap/hidratação inline | Nonce por request preferencial; hashes somente para conteúdo estável |
| Styles próprios | CSS em `self` | `style-src 'self'`; mapear styles inline gerados |
| Styles inline | React/Next/componentes podem usar atributos style | Nonce quando aplicável ou redução/mapeamento antes de enforcement |
| Next.js | Dev requer eval/WebSocket; produção não deve herdar permissões dev | Policies separadas por ambiente |
| Imagens | `self`, R2, `data:` e possivelmente `blob:` | Allowlist de origens públicas sem path/query/token |
| Fontes | Geist em `self`, possível `data:` do runtime | `font-src 'self' data:` somente se comprovado necessário |
| Vídeos/mídia | `self`, R2, posters e blobs locais | `media-src` alinhado ao storage público |
| Data URLs | Placeholder/ícone/fonte podem usar `data:` | Liberar apenas em diretivas necessárias, nunca globalmente |
| Blob URLs | Preview local de mídia e browser APIs | Liberar em `img-src`/`media-src` apenas se testado |
| Service worker | `/admin-push-sw.js`, escopo `/admin/` | `worker-src 'self'`; não ampliar escopo |
| Web Push | Push service definido pelo browser, subscription server-side | Mapear connect endpoints reais; não expor VAPID privada |
| Stripe futuro | Checkout/JS/frames/connect | `js.stripe.com`, checkout, API/hooks apenas após test-mode |
| Melhor Envio | Chamado server-side | Não deve exigir origem no CSP do browser |
| Storage | R2/domínio de mídia público | Sanitizar para origin e separar staging/produção |
| Analytics | Nenhum fornecedor confirmado | Não adicionar wildcard; mapear somente após contratação |
| Reports | Endpoint inexistente | Criar endpoint autenticado/limitado e armazenamento sanitizado |

## Estratégia proposta

1. Inventariar em staging todos os scripts, styles, frames, connects, imagens, fontes,
   workers, manifests e mídias em build de produção.
2. Implementar nonce criptográfico por request e propagá-lo para scripts/styles que
   realmente precisem de inline; evitar `'unsafe-inline'` e `'unsafe-eval'` em produção.
3. Usar hashes apenas para blocos determinísticos que não mudem a cada build/request.
4. Publicar inicialmente `Content-Security-Policy-Report-Only` com diretivas mínimas e
   `report-to`/`report-uri` apontando para endpoint real.
5. Aplicar rate limit, limite de tamanho, validação de content type/schema, retenção
   curta e redaction antes de armazenar reports.
6. Nunca registrar URL completa com query, cookie, body, token, path privado ou PII.
7. Homologar Home, catálogo, produto, autenticação, Admin, uploads, manifest, SW,
   Push e, futuramente, Stripe test em staging.
8. Corrigir violações legítimas; não ampliar origens para silenciar ruído.
9. Promover diretivas por grupos para enforcement, começando por
   `object-src 'none'`, `base-uri 'self'` e `frame-ancestors 'none'`.
10. Manter rollback imediato para a policy anterior e medir erro/hydration após cada
    promoção.

## Esboço de diretivas futuras

O conteúdo abaixo é somente uma direção de trabalho, não um header pronto:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
script-src 'self' 'nonce-<por-request>' <Stripe test quando homologado>;
style-src 'self' 'nonce-<por-request>';
img-src 'self' data: blob: <origem R2 exata>;
media-src 'self' blob: <origem R2 exata>;
font-src 'self' data:;
connect-src 'self' <endpoints comprovados>;
frame-src <Stripe somente quando habilitado>;
worker-src 'self';
manifest-src 'self';
form-action 'self';
```

Não usar `*`, origens Railway genéricas, credenciais ou URLs assinadas na policy.

## Development versus production

- Development pode precisar de WebSocket/eval do tooling; nunca copiar essa policy para
  produção.
- Preview/staging deve usar build de produção e policy Report-Only própria.
- Produção recebe enforcement somente depois de período de observação, zero violação
  funcional conhecida, QA manual e rollback ensaiado.

## Gate futuro

CSP só sai de planejamento quando houver endpoint de reports sanitizado, inventário
completo, testes automatizados, homologação em staging, evidência de Stripe/PWA/Admin e
aprovação de Segurança/Engenharia. Até lá, manter os headers atuais e tratar CSP como
warning conhecido, não como policy improvisada.
