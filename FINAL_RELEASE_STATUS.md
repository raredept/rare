# RARE — execução final autorizada

Início: 2026-09-07. Retomada: 2026-09-09. Registro incremental; números históricos não são homologação do release atual.

## Retomada de 09/09 — candidato final

- Produção e staging ainda confirmados no commit `46b95b9`; outbox, SMTP, diagnóstico de upload e atualizações abaixo ainda locais neste ponto do registro.
- Next e eslint-config-next atualizados para `16.3.4`, Vitest para `4.1.11`; Sharp `0.35.4` e Prisma `7.9.1` preservados. `npm ci` aprovado. Auditoria atual: zero críticos/moderados, 3 altos na cadeia Prisma CLI e mais 4 nas ferramentas Lighthouse. Não foi aplicado `audit fix --force`.
- Validação do lote: **649 testes em 104 arquivos**, lint, TypeScript e build aprovados; 28 Server Actions presentes. SMTP passou também por teste TCP real de cancelamento da conexão em timeout. Onze provas SQL de outbox e sete de concorrência de checkout passaram em bancos descartáveis removidos; nenhum e-mail externo foi enviado.
- E2E integrado do Next `16.3.4`: **120 aprovados, 15 skips condicionais**, Chromium desktop/mobile e WebKit, encerramento normal em 2,9 minutos. A classificação dos skips e o QA Admin isolado estão descritos abaixo. Guard de release: 6 OK, zero falhas; cron Vercel permanece aviso externo. Prisma CLI, `@prisma/config` e `deepmerge-ts` ausentes do standalone HTTP; Sharp e AWS S3 presentes. Arquivos de instruções de agentes gerados pelo novo Next foram preservados.
- Backup de produção renovado em 09/09: dump de 78.513 bytes, SHA-256 `1850f999b84f100e8239efcf7fb1e51e57a1b7996693cfdf9d9a83da7790387c`. Restauração isolada confirmou contagens e fingerprints de todas as tabelas; banco temporário removido. Evidência `output/final-release/backup-restoration-20260909.json`.
- Porta Railway do `www` corrigida para 8080. Diagnóstico confirmou posse não verificada, certificado em emissão e TXT exigido ausente nos dois resolvedores consultados; `www` permanece 404. Os registros exatos estão preparados em arquivo privado protegido, sem expor o valor de verificação. Controle autenticado do Cloudflare ainda indisponível.
- Domínio de e-mail: MX ausente, SPF `v=spf1 -all` e DMARC `reject`. O endereço Zoho confirmado pelo proprietário não comprova configuração nem entrega. É necessário obter os registros específicos da conta e a configuração SMTP; driver permanece desativado.

## Plano e limites

1. Reconciliar código publicado, flags e bancos; assegurar backup e rollback.
2. Consolidar correções locais, resolver bloqueadores e validar candidato identificável.
3. Preparar staging isolado e homologar integrações acessíveis; avançar frentes independentes.
4. Publicar correções técnicas com `CHECKOUT_ENABLED=false`, `SHIPPING_ENABLED=false` e e-mail de produção desativado.

Vendas reais, cobranças, etiquetas reais e novos planos pagos não estão autorizados. A aprovação comercial permanece reservada ao proprietário.

## Baseline confirmado

- HEAD local `1f193db1b9f4dea37027024339df1861df2a1ce6`, seis commits à frente do GitHub, mais mudanças não commitadas preservadas.
- `origin/main`, após fetch: `bd1adadeb5afc394eb8a2bce181b827e799866b4`.
- Deploy de produção `668b345e-4791-4a3f-ae25-ddc44fedf7c6`, criado `2026-09-07T22:00:34.271Z`, `SUCCESS`, origem GitHub `raredept/rare`, SHA `bd1adad…`, imagem `sha256:d47562bf50c232082aa42402308a2d8351fc3f127a312a8e317dd3458f2d9981`.
- Esse deploy substituiu o deployment CLI especial do Admin 2; as alterações locais posteriores não foram publicadas. O health antigo não contém identidade de release.
- Encontrado checkout **ativo** com chave Stripe live. Corrigido imediatamente para `CHECKOUT_ENABLED=false`, mantendo `SHIPPING_ENABLED=false`. Nova publicação de configuração `424f032d-6f60-4727-82b5-297c9ef93ce4`; health público confirmou ambas as flags falsas às `2026-09-07T23:22:41Z`.
- Ambiente antigo `AAAA` não é staging isolado: compartilha secrets de autenticação e bucket/credencial R2 com produção; URL pública incorporada aponta ao apex. Não usado para testes.
- Stripe test local confirmado por API somente leitura; dados de conta e escopos serão registrados com a homologação. Melhor Envio sandbox e e-mail ainda dependem de confirmação.
- Cron Railway tem execução real bem-sucedida em `2026-09-07T03:04:56Z`, zero reservas expiradas liberadas; próxima execução `2026-09-08T03:00:00Z`.
- www ainda falha: 2/7 cenários GET e 0/6 métodos adicionais. Cloudflare e Vercel exigem login; credenciais Vercel locais expiradas não foram utilizadas. Evidência em `output/final-release/domain-operations.md`.

## Implementação e gates do candidato

- Upload valida decodificação integral, incluindo imagens pequenas; presign permanece encerrado e gravações exclusivas preservadas. Sharp 0.35.4 único, fontes locais e assets empacotados.
- Primeiro acesso e invalidação de sessões Admin consolidados. Novas senhas Admin/cliente rejeitam truncamento bcrypt acima de 72 bytes; senhas existentes não foram alteradas.
- Recuperação de Server Actions também no boundary da loja, com atualização manual sem replay de mutação (E2E desktop/mobile, um único POST).
- Webhook segrega test/live, valida valor/moeda/IDs e serializa por pedido. Retry de cartão e pagamentos assíncronos preservam reserva; expiração é transacional e pagamento tardio não rouba reserva de outro pedido.
- Concorrência em PostgreSQL descartável: última unidade, sessão/PaymentIntent simultâneos, duplicatas, cinco corridas pagamento/expiração e pagamento tardio aprovados. Dois bancos descartáveis removidos; nenhum provedor chamado nesses testes.
- Primeira integrada: 612 testes; E2E geral: 120 aprovados, 15 skips condicionais. Após outbox/observabilidade: **648/648**, 103 arquivos; lint, TypeScript e build aprovados, 28 Server Actions presentes. Dois testes de metadata foram corrigidos para declarar explicitamente o ambiente de produção que esperavam; a proteção noindex do staging foi preservada.
- Os 15 skips gerais são 9 casos Admin que exigem fixture isolada, 4 controles específicos de mobile em projetos desktop e 2 cenários de contraste restritos ao Chromium desktop. Admin foi executado separadamente: primeiro acesso, senha/sessão anterior inválida e upload desktop, mais layout mobile, aprovados; os três skips dessa rodada são apenas a separação desktop/mobile. Navegadores são emulados; não há prova em celular físico.
- Corrigido o runner isolado: variável `PLAYWRIGHT_BASE_URL` vazia agora usa corretamente localhost. QA de provisionamento em dois bancos descartáveis confirmou preservação do administrador existente e da senha definitiva após reprovisionamento; cleanup concluído.
- Guard de release: 6 OK, zero falhas; permanece aviso cron Vercel não verificado. Audit atual: 3 high do Prisma/config/deepmerge-ts (CLI), 11 high no conjunto com ferramentas de desenvolvimento. Não é audit zerado.
- Manifest no standalone contém SHA do commit de build, Next BUILD_ID e SHA-256 determinístico do código/assets normalizado entre Windows/Linux. Uploads locais, segredos e arquivos de backup são excluídos do empacotamento.

## Bancos, backup e staging

- Produção PostgreSQL 18.6: 10 migrations, 2 Admins, 3 clientes, 9 pedidos no baseline. Admin 2 ativo, senha temporária já trocada (`mustChangePassword=false`); não redefinido.
- Local `rare_dev`: backup antes das migrations; agora 11 migrations aplicadas, sem reset, incluindo a outbox aditiva. Produção e staging ainda com 10 até o próximo release da outbox.
- Backup lógico `pg_dump` 18.6 de produção criado em snapshot consistente. Restaurado em banco separado, não ligado ao app, no PostgreSQL novo; contagem e fingerprint de todas as tabelas iguais. Banco temporário removido antes de criar fixtures. Backup local protegido por ACL em `output/final-release/private/`; não versionado nem enviado ao deploy.
- Snapshot nativo Railway não criado: API retornou `Not Authorized`. Isso não foi apresentado como backup concluído; a prova de recuperação é do backup lógico acima.
- Staging novo: ambiente `d8399691-dacf-41e9-a9d5-060c97672e39`, serviço `3f4b79f6-2819-45a6-986d-584dc7ac803a`, URL `https://rare-staging-staging.up.railway.app`.
- PostgreSQL e Redis próprios; URLs, auth e cron secrets diferentes de produção, confirmados por comparação sem revelar valores. Dez migrations e apenas fixtures sintéticas de catálogo/cliente/endereço/Admin.
- Storefront/Admin/assets de staging exigem Basic Auth próprio; sem secrets válidos falham fechados. POST Stripe webhook permanece público para assinatura, health/robots permitem leitura. Robots/noindex e acesso são gates do smoke remoto.
- Storage provisório: volume exclusivo persistente `/data/uploads`, sem credenciais R2 de produção. Isso permite QA isolado, **não comprova R2 real**. Bucket/credencial R2 separados ainda dependem do acesso Cloudflare.
- Stripe test: endpoint exclusivo `we_1UDC7sJe5iz4GDMJMXGRuULj`, seis eventos previstos, API `2026-04-22.dahlia`, assinatura exclusiva instalada via stdin. Chave test validada; método `card`. Pix `available=false` na configuração test consultada; não habilitado por suposição.
- Checkout habilitado somente no staging durante a homologação Stripe test e pausado ao terminar; frete automático permaneceu falso. Frete de fixture fixo de R$15,00 não constitui homologação Melhor Envio. O proprietário confirmou depois o CEP real `31170-350` e `contato@raredept.com.br`; origem salva no Admin/env de staging e contato técnico/remetente preparado, sem inventar credencial sandbox ou SMTP.

## Publicação e homologação já comprovadas

- Commits `f72b110` e `46b95b9` integrados por fast-forward e publicados em `origin/main`, sem force-push. Proteções/regras do GitHub consultadas: nenhuma revisão obrigatória. `AAAA` foi fixado na branch preservada `codex/legacy-aaaa-preserved-20260907` para não receber autodeploy do release novo.
- Produção: deployment `30c4b95d-c5e9-42b2-8a07-9049e7c70e12`, criado `2026-09-08T00:00:40.570Z` (21h00 BRT de 07/09), `SUCCESS`, commit completo `46b95b9cb4feb84aaa8292d1b8d764cdf6f5e7a5`. Health público confirmou SHA e digest de fonte `2e6edff29e15129df0fba74e8fdf3357117a0022d5564137ba80d373306096dd`, iguais ao staging; checkout/frete falsos e banco/Redis saudáveis.
- Produção: smoke HTTP **17 OK, zero falhas**; navegador desktop/mobile **8/8**, fontes/assets reais, catálogo, produto, noindex privado, autenticação obrigatória e compras pausadas. O smoke remoto foi corrigido porque a antiga interceptação bloqueava os próprios recursos R2/Cloudflare; os erros não foram ignorados, os recursos passaram a carregar realmente.
- Staging: smoke de isolamento **11/11**. Upload de produto/banner via Admin no Linux passou: original íntegro por SHA-256, WebP 640/1200, DB/reload/galeria, PNG truncado rejeitado sem perda; 12 rotas desktop/mobile sem overflow e navegação real. Armazenamento dessa prova é volume local isolado, não R2.
- Stripe test no `46b95b9`: três pagamentos reais no sandbox — aprovado com cupom/frete (R$37,50), recusa seguida de retry na mesma sessão/PaymentIntent (R$40), 3DS (R$40). Cada pedido tem uma reserva e uma baixa; estoque 100→97. Pedido expirado liberou sua reserva uma vez; estoque reservado final zero.
- Treze entregas Stripe assinadas, incluindo reenvios Session/PaymentIntent/expiração, retornaram HTTP200. Com novas compras pausadas, `/api/checkout` retorna503 e webhooks existentes continuam200. Assinatura ausente retorna400. Admin e histórico do cliente conferidos. Pix indisponível na conta test; eventos assíncronos reais ainda não homologados.
- O redeploy de pausa do staging falhou por configuração de binding ausente. Corrigido serviço explicitamente para `HOSTNAME=0.0.0.0`, `PORT=8080`, porta do domínio8080, build/start/migrations/healthcheck persistidos. Recovery `7b99f8b8-18c2-47d5-87c1-12333f7e69ae` `SUCCESS` e health200 com flags falsas.
- Upload R2 de produção encontrou falha no runtime. Teste direto e pipeline real/bundle local com as mesmas credenciais gravam e removem objetos próprios com sucesso; diagnóstico sanitizado foi implementado para identificar a causa no próximo release. Nenhum produto fictício/campanha foi publicado, nenhum objeto pré-existente foi removido, contas QA removidas e os dois Admins reais mantiveram hashes/flags iguais. Não registrar R2 como aprovado enquanto esse gate falhar.
- Admin 2 permanece ativo, username `ADMIN 2`, troca temporária já concluída; senha definitiva não foi redefinida. Sem credencial disponível, seu login específico não foi simulado. Login/redirect e invalidação de conta removida comprovados com Admin sintético.

## Lote final em validação/publicação

Outbox aditiva `EmailOutbox` com unicidade pedido/tipo, enqueue atômico no pagamento, worker separado, concorrência por lock e backoff limitado. SMTP exige TLS, ambiente/modo explícito e allowlist em teste; confirmação ambígua fica `uncertain` para revisão, sem reenvio automático. `accepted` significa aceitação SMTP, não entrega comprovada. Driver desativado não envia nem consome a fila; corte explícito evita disparar histórico ao ativar. Nenhum envio real executado. Contraste da aba Admin corrigido de ~1,10:1 para21:1. O novo lote ainda precisa de deploy rastreável e reteste R2; não confundir build local com publicação.

## Operação e próximos gates

1. Pedido pendente: conferir Session/PaymentIntent e entregas no Stripe antes de mudar status; retorno à página de sucesso não prova pagamento. Reentregar evento no endpoint do ambiente correto. Pagamento assíncrono em processamento não deve perder reserva por liberação manual.
2. Pedido pago: conferir uma baixa e endereço/frete contratado no Admin. Etiqueta é operada manualmente no painel Melhor Envio; a integração do site somente cota. Não comprar etiqueta durante homologação.
3. Cancelamento/expiração: confirmar estado do provedor e usar fluxo que libera reserva uma vez. Reembolso real exige autorização própria e conciliação com Stripe; não basta trocar o status local.
4. Falha de integração: pausar novas compras; preservar webhooks assinados. Erro de e-mail não desfaz pagamento. Revisar fila `failed/uncertain`; nunca reenviar SMTP de resultado ambíguo sem confirmar o envio anterior.
5. Rollback técnico: artefato `46b95b9`/deployment `30c4b95d…` é fallback compatível com schema aditivo e mantém compras pausadas, mas carrega a limitação R2 descrita. Restaurar aplicação/configuração conhecida, sem desfazer migrations nem restaurar banco sobre dados novos. Revalidar flags, health e smoke. O backup lógico restaurado está protegido em `output/final-release/private/`.

Bloqueios externos: login Cloudflare para conferir/reusar regra308 www e criar R2 de staging separado; token Melhor Envio sandbox para origem confirmada; host/porta/credencial SMTP Zoho e confirmação de caixa teste controlada; acesso Vercel para esclarecer cron legado. Pix depende da disponibilidade da conta. Vendas reais continuam bloqueadas até homologação e aprovação explícita do proprietário.
