# RARE — execução final autorizada

Início: 2026-09-07. Registro incremental; números históricos não são homologação do release atual.

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
- 608 testes integrados aprovados antes dos ajustes finais de empacotamento; testes focados adicionais de manifest/config/proxy/health aprovados. Lint e TypeScript aprovados. Build produção aprovado, 28 Server Actions presentes.
- Guard de release: 6 OK, zero falhas; permanece aviso cron Vercel não verificado. Audit atual: 3 high do Prisma/config/deepmerge-ts (CLI), 11 high no conjunto com ferramentas de desenvolvimento. Não é audit zerado.
- Manifest no standalone contém SHA do commit de build, Next BUILD_ID e SHA-256 determinístico do código/assets normalizado entre Windows/Linux. Uploads locais, segredos e arquivos de backup são excluídos do empacotamento.

## Bancos, backup e staging

- Produção PostgreSQL 18.6: 10 migrations, 2 Admins, 3 clientes, 9 pedidos no baseline. Admin 2 ativo, senha temporária já trocada (`mustChangePassword=false`); não redefinido.
- Local `rare_dev`: backup antes da migration; agora 10 migrations aplicadas, sem reset.
- Backup lógico `pg_dump` 18.6 de produção criado em snapshot consistente. Restaurado em banco separado, não ligado ao app, no PostgreSQL novo; contagem e fingerprint de todas as tabelas iguais. Banco temporário removido antes de criar fixtures. Backup local protegido por ACL em `output/final-release/private/`; não versionado nem enviado ao deploy.
- Snapshot nativo Railway não criado: API retornou `Not Authorized`. Isso não foi apresentado como backup concluído; a prova de recuperação é do backup lógico acima.
- Staging novo: ambiente `d8399691-dacf-41e9-a9d5-060c97672e39`, serviço `3f4b79f6-2819-45a6-986d-584dc7ac803a`, URL `https://rare-staging-staging.up.railway.app`.
- PostgreSQL e Redis próprios; URLs, auth e cron secrets diferentes de produção, confirmados por comparação sem revelar valores. Dez migrations e apenas fixtures sintéticas de catálogo/cliente/endereço/Admin.
- Storefront/Admin/assets de staging exigem Basic Auth próprio; sem secrets válidos falham fechados. POST Stripe webhook permanece público para assinatura, health/robots permitem leitura. Robots/noindex e acesso são gates do smoke remoto.
- Storage provisório: volume exclusivo persistente `/data/uploads`, sem credenciais R2 de produção. Isso permite QA isolado, **não comprova R2 real**. Bucket/credencial R2 separados ainda dependem do acesso Cloudflare.
- Stripe test: endpoint exclusivo `we_1UDC7sJe5iz4GDMJMXGRuULj`, seis eventos previstos, API `2026-04-22.dahlia`, assinatura exclusiva instalada via stdin. Chave test validada; método `card`. Pix `available=false` na configuração test consultada; não habilitado por suposição.
- Staging ainda com checkout/frete falsos. Frete de fixture é fixo de R$15,00, CEP sintético; não constitui homologação Melhor Envio.

## Ainda pendente nesta execução

Publicação rastreável do candidato, smoke remoto e pagamento real no sandbox. Cloudflare/Vercel aguardam login; R2 isolado, Melhor Envio sandbox e provedor/remetente/destinatário de e-mail ainda dependem de acesso/configuração. Essas pendências comerciais não autorizam ativação de vendas.
