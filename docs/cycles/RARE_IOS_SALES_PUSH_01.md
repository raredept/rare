# RARE-IOS-SALES-PUSH-01 — Push de venda aprovada no iPhone

- Branch: `cycle/rare-ios-sales-push-01`
- Base: `main@35c741623fe706843661c83693667658b46e497e`
- Escopo: auditar, endurecer e completar a UX iOS do Web Push de venda aprovada que já existia. Sem migração, sem mudança financeira, sem deploy.

## 1. Arquitetura existente (auditada)

| Peça | Arquivo | Estado na base |
| --- | --- | --- |
| Modelos | `prisma/schema.prisma` (`AdminNotification`, `AdminPushSubscription`) | OK. `dedupeKey @unique`, `endpoint @unique`, `@@index([userId, active])`. Nenhuma mudança necessária. |
| Gancho de venda | `src/lib/checkout.ts` → `notifyPaidOrderIfNeeded` → `notifyAdminsOfPaidOrder(orderId)` | OK. Só chama quando a transição resulta em `paid`; erro é capturado e logado sem URL. **Não alterado.** |
| Notificação + envio | `src/lib/admin-notifications.ts` | OK no essencial (dedupe, 404/410). Achados abaixo. |
| Allowlist SSRF | `src/lib/push-endpoint.ts` | OK. FCM, Mozilla, WNS, `web.push.apple.com`, `*.push.apple.com`; só `https`, porta 443, sem credenciais. **Não alterado.** |
| API de inscrição | `src/app/api/admin/push-subscriptions/route.ts` | OK (auth, `commerce.notifications`, troca de senha, same-origin, rate limit, corpo limitado, allowlist). Achado no DELETE. |
| Service worker | `public/admin-push-sw.js` (scope `/admin/`) | Funcional. Achados de robustez. |
| Controle Admin | `src/components/admin/admin-push-subscription-control.tsx` em `/admin/notifications` | Funcional. Faltavam instrução iOS completa, estados, teste e acentos. |
| Manifest | `src/app/manifest.ts` | `display: standalone`, `scope: /`, ícones 192/512. Sem `id`. |
| VAPID | `src/lib/env.ts` (`getWebPushConfig`) | OK. Privada só no servidor; pública via prop server-side. |

### Achados e correções

| # | Severidade | Achado | Correção |
| --- | --- | --- | --- |
| F1 | Média | `DELETE` desativava o endpoint de qualquer Admin com a permissão (sem escopo de usuário). | `updateMany` agora filtra `endpoint + userId` do Admin atual. Outros dispositivos e outros Admins não são afetados. |
| F2 | Média | `setVapidDetails` com chave inválida lançava exceção depois de a `AdminNotification` existir; uma falha no `update` de bookkeeping rejeitava o `Promise.all`. | `setVapidDetails` protegido (status `config_error`, log sanitizado); bookkeeping isolado por assinatura e nunca lança. |
| F3 | Baixa | `attempted` contava endpoints fora da allowlist. | Conta só os entregáveis. |
| F4 | Média (iOS) | SW confiava no tipo dos campos do payload; JSON inválido gerava fallback, mas `title`/`body` não-string ou `icon` externo passavam. | Saneamento de texto (tipo + tamanho), ícones só same-origin, URL validada no `push` e de novo no `click` (com `try/catch`). Notificação sempre visível. |
| F5 | Média (iOS) | Instrução de instalação de uma linha; iPadOS (UA de Mac) não detectado; sem estados claros; textos sem acento. | Passo a passo de 6 itens, detecção iPad por `maxTouchPoints`, 10 estados com rótulo, copy revisada. |
| F6 | Baixa | Subscription criada com chave VAPID antiga era reaproveitada para sempre. | Compara `options.applicationServerKey`; recria no clique quando difere. |
| F7 | Baixa | UI dizia "ativo" só pelo navegador, mesmo se o servidor tivesse desativado (404/410). | Ao abrir a página, re-sincroniza a subscription existente (upsert idempotente, sem prompt). |
| F8 | — | Sem forma de homologar sem venda real. | `POST /api/admin/push-subscriptions/test` + botão "Enviar notificação de teste". |

## 2. Mudanças

- `src/lib/admin-notifications.ts`: `buildAdminPushPayload` (exportado), `sendAdminTestPushNotification(adminId)`, filtro opcional por `userId`, `config_error`, bookkeeping resiliente. Payload e regra de dedupe da venda inalterados.
- `src/app/api/admin/push-subscriptions/route.ts`: DELETE escopado ao Admin atual.
- `src/app/api/admin/push-subscriptions/test/route.ts` (novo): teste de push.
- `src/lib/admin-push-client.ts` (novo): detecção iOS/standalone, decodificação e comparação da chave VAPID (funções puras, testáveis).
- `src/components/admin/admin-push-subscription-control.tsx`: estados, instrução iOS, botão de teste, permissão só no clique.
- `public/admin-push-sw.js`: saneamento, revalidação no clique, `skipWaiting`/`clients.claim`.
- `src/app/manifest.ts`: `id: "/"` e `lang: "pt-BR"`.
- Testes: `admin-notifications.test.ts`, `push-subscriptions/route.test.ts`, `push-subscriptions/test/route.test.ts`, `admin-push-sw.test.ts`, `admin-push-client.test.ts`, `push-endpoint.test.ts`, `manifest.test.ts`.

## 3. Manifest

`id: "/"` é igual à identidade implícita anterior (`start_url` resolvido), então instalações existentes continuam sendo o mesmo app. Não foi criado manifest separado para o Admin: no iOS o push pertence ao web app da Tela de Início e o Admin (`/admin/*`) já está dentro do `scope: "/"` da PWA da loja. Um segundo manifest com `scope: /admin/` exigiria trocar o `<link rel="manifest">` no layout do Admin e criaria outro ícone; não há ganho para o objetivo. A PWA pública não mudou de comportamento.

## 4. Fluxo no iPhone

1. Safari → `https://<domínio>/admin/notifications` → o painel mostra **"Instale na Tela de Início"** e o passo a passo.
2. Compartilhar → **Adicionar à Tela de Início** → abrir a RARE pelo ícone.
3. Dentro do app instalado, entrar no Admin. A sessão do app da Tela de Início é separada da do Safari, então login e MFA são pedidos de novo (esperado).
4. `/admin/notifications` → **Ativar neste celular** (gesto do usuário):
   1. `Notification.requestPermission()` é o primeiro `await` do handler (WebKit exige gesto);
   2. registra `/admin-push-sw.js` (scope `/admin/`) e espera `serviceWorker.ready`;
   3. `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`;
   4. `POST /api/admin/push-subscriptions` (autenticado, same-origin);
   5. estado **"Ativo neste dispositivo"**.
5. **Enviar notificação de teste** → push "Teste — RARE Admin" só para os dispositivos do Admin atual.
6. Venda aprovada → "Venda aprovada · Pedido RARE-… confirmado: R$ …" → toque abre `/admin/orders/<id>`. Se a sessão expirou, o proxy/`requireAdmin` leva ao login/MFA normal; o SW não toca em sessão.

Nada pede permissão no carregamento: o `useEffect` só lê o estado (e registra o SW, que não gera prompt).

### Estados do painel

`Verificando...`, `Não configurado`, `Instale na Tela de Início`, `Sem suporte neste navegador`, `Permissão bloqueada`, `Desativado`, `Ativando...`, `Desativando...`, `Ativo neste dispositivo`, `Erro`.

## 5. VAPID

| Variável | Onde | Produção (`rare`) | Staging (`rare`) |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Railway | configurada | não configurada |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Railway (secret) | configurada | não configurada |
| `WEB_PUSH_CONTACT` | Railway | configurada (`mailto:`) | não configurada |

Verificado em 2026-11-17 sem imprimir valores: a chave privada de produção tem 32 bytes e o par confere (a pública derivada da privada é igual à configurada). Nenhuma chave foi gerada, alterada ou registrada neste repositório.

Para configurar outro ambiente (ex.: staging), o operador gera o par localmente (`npm run webpush:keys`) e cola **diretamente** na Railway; a privada nunca vai para Git, docs, chat ou log. Trocar o par invalida todas as subscriptions existentes: cada dispositivo precisa tocar "Ativar neste celular" de novo (a UI detecta a chave diferente e recria).

## 6. Segurança

- **RBAC**: inscrição, remoção e teste exigem Admin autenticado, senha definitiva e `commerce.notifications` (SYSTEM_ADMIN não recebe vendas).
- **CSRF**: `isSameOriginRequest` em POST/DELETE/teste.
- **Rate limit**: `admin-push:<id>` 120/min (inscrição); `admin-push-test:<id>` 5 a cada 10 min (teste).
- **SSRF**: allowlist validada ao gravar e de novo antes de cada envio; Apple aceita só `web.push.apple.com` e `*.push.apple.com` em `https:443`.
- **PII**: o pedido é lido só com `id, orderNumber, status, totalInCents`; o payload tem exatamente `title, body, icon, badge, url, tag`. Sem nome, e-mail, CPF, telefone, endereço ou cartão (teste dedicado).
- **Logs**: só `statusCode`, mensagem com URLs e tokens ≥ 32 caracteres redigidos, e `disabled`. Nunca endpoint, `p256dh`, `auth` ou chave privada (teste dedicado).
- **Deep link**: só same-origin `/admin` ou `/admin/*`; qualquer outra coisa cai em `/admin/notifications`. Validado no `push` e no `notificationclick`.
- **Badge**: não implementado (opcional). Uma contagem correta exigiria estado de leitura sincronizado com o SW; preferimos não exibir número errado.

## 7. Dedupe e falhas de entrega

- Uma venda → no máximo uma `AdminNotification` (`dedupeKey = order_paid:<orderId>`): checagem prévia + `P2002` na corrida. Replay de webhook retorna `already_notified` e **não envia push** (testado com 3 chamadas e com corrida).
- `404`/`410` → `active = false`. `400/401/403/413/429/5xx`/rede → só `failedAt`, a subscription continua ativa.
- Push não configurado ou chave inválida: a notificação interna é criada mesmo assim; o checkout nunca recebe exceção.

## 8. Testes

- Unit/API/SW: `npx vitest run src/lib/admin-notifications.test.ts src/lib/admin-push-sw.test.ts src/lib/admin-push-client.test.ts src/lib/push-endpoint.test.ts src/app/api/admin/push-subscriptions src/app/manifest.test.ts`.
- O SW é executado de verdade (`public/admin-push-sw.js` carregado num escopo simulado): push visível, fallback, URL externa/maliciosa → fallback, clique, foco.

### Checklist manual — iPhone real (iOS 16.4+)

- [ ] Safari → `/admin/notifications` mostra "Instale na Tela de Início" e os 6 passos.
- [ ] Compartilhar → Adicionar à Tela de Início → ícone RARE criado.
- [ ] Abrir pelo ícone (sem barra do Safari).
- [ ] Login Admin + MFA dentro do app.
- [ ] `/admin/notifications` mostra "Desativado".
- [ ] Tocar "Ativar neste celular" → prompt do iOS aparece só agora → Permitir.
- [ ] Estado "Ativo neste dispositivo".
- [ ] Tocar "Enviar notificação de teste" → mensagem de envio.
- [ ] Bloquear a tela → notificação "Teste — RARE Admin" chega.
- [ ] Tocar a notificação → abre o app em `/admin/notifications`.
- [ ] (Opcional, quando ocorrer venda real) push "Venda aprovada" → abre `/admin/orders/<id>`.
- [ ] Sessão expirada → tocar push leva ao login/MFA, não ao pedido.
- [ ] "Desativar neste celular" → estado "Desativado"; desktop do mesmo Admin continua recebendo teste.
- [ ] Ajustes › Notificações › RARE desligado → painel mostra "Permissão bloqueada".

Não criar pedido nem cobrança Asaas para homologar: usar o botão de teste.

## 9. Rollout

1. Revisão do PR; CI verde.
2. Merge e deploy pelo processo normal (fora deste cycle).
3. Produção já tem VAPID válido: nenhum env novo.
4. Executar o checklist manual num iPhone real com um Admin `SELLER_ADMIN` (ou `ADMIN` legado).

## 10. Rollback

- Código: reverter o merge deste PR. Sem migração, sem dado novo; as subscriptions existentes continuam válidas no código anterior.
- Desligar push sem deploy: remover `WEB_PUSH_VAPID_PRIVATE_KEY` na Railway → `not_configured` (as notificações internas continuam sendo criadas; o checkout não é afetado).
- O manifest só ganhou `id` igual ao implícito e `lang`; reverter não afeta instalações.

## 11. Fora de escopo / garantias

`PRISMA_CHANGED=NO`, `NEW_MIGRATIONS=0`, Asaas, webhook auth, cálculo de pagamento, parcelamento, estoque, reservas, cupom, frete, reembolso, SEO e cookies **inalterados**. `src/lib/checkout.ts` não foi tocado.
