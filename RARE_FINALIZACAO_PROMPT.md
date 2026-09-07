Você é o desenvolvedor sênior responsável por concluir a RARE em E:\rare. Quero implementação, integração, homologação e publicação das correções, com execução contínua. O objetivo é deixar a loja pronta para ativar vendas reais mediante minha aprovação final.

Comece com um plano curto, baseado no estado real, e execute as etapas autorizadas. Se esta sessão estiver em modo Planejamento, entregue o plano pronto para execução, indicando a transição necessária; não afirme ter implementado enquanto esse modo impedir mudanças. No modo de execução, mantenha um plano atualizado e continue trabalhando até concluir ou encontrar um bloqueio externo concreto.

CONTEXTO QUE DEVE SER RECONCILIADO

Acabei de editar variáveis na Railway e fazer um novo deploy. Isso precisa ser cruzado com a origem e o conteúdo do deployment: não presuma que minhas mudanças locais foram publicadas.

O último relatório de consolidação informou:
- ADMIN 2 funciona em produção, exige troca da senha temporária e bloqueia o painel antes da troca. Preserve esse acesso e o administrador anterior.
- A migration de senha temporária está aplicada na Railway e pendente somente no banco rare_dev local.
- Invalidação de sessões antigas, remediações de upload, storage configurável e fontes locais estavam apenas no workspace.
- Upload completo de produto/banner passou em desktop/mobile, incluindo persistência e preservação da mídia anterior em falhas.
- Playwright encerrou naturalmente: 117 aprovados e 15 skips condicionais.
- Vitest: 579/579. Build, lint, TypeScript e 28 Server Actions aprovados.
- Google Fonts foi substituído por Geist Sans/Mono local com licença OFL.
- Bancos e storage descartáveis usados naquele QA foram removidos.

Esses números são evidências anteriores, não substituem verificar o estado atual. Relatórios existentes incluem SECURITY_DEPENDENCY_REMEDIATION_REPORT.md, SERVER_ACTIONS_INVESTIGATION_REPORT.md e DOMAIN_AND_DEPLOYMENT_READINESS_REPORT.md. Leia também a consolidação mais recente, se existir.

ACESSO E AUTONOMIA

Tenho acesso a GitHub, Railway e Cloudflare. As credenciais de Stripe e Melhor Envio foram coletadas/configuradas durante uma ligação; confirme quais ambientes estão realmente disponíveis, sem assumir que todas as credenciais de teste já existem.

Ao enviar este prompt, autorizo:
- Inspeção, correções, testes e alterações necessárias no repositório.
- Branches/worktrees, commits e push das mudanças revisadas; integração pelo fluxo permitido do repositório, respeitando proteções e revisões obrigatórias.
- Criação/configuração de staging com recursos mínimos, backups e aplicação de migrations compatíveis e revisadas após confirmar o banco de destino.
- Configuração das integrações e dos webhooks nos ambientes corretos usando acessos disponíveis.
- Correção da canonicalização www na Cloudflare, depois de verificar regras existentes.
- Deploy controlado das correções em produção mantendo CHECKOUT_ENABLED=false e SHIPPING_ENABLED=false.
- Testes de pagamento somente em Stripe test, frete somente em sandbox e e-mail somente para destinatários de teste sob nosso controle.

A ativação de vendas reais, cobranças reais, compra de etiquetas reais, alterações destrutivas de dados e contratação de novos planos pagos ficam fora dessa autorização. Prepare tudo para uma decisão final concreta. Não peça novamente autorização para ações já contempladas acima.

Use os acessos disponíveis sem solicitar senhas ou tokens em mensagens. Nunca imprima segredos, exporte dumps de variáveis para relatórios/Git ou coloque credenciais em NEXT_PUBLIC_*. Respeite controles de acesso; se uma ferramenta bloquear algo, explique qual ação, o motivo real e o que ainda conseguiu concluir.

Pode dividir tarefas independentes entre agentes, quando houver suporte, usando isolamento e um responsável pela integração. Evite edição concorrente dos mesmos arquivos, migrations, lockfile e fluxos de autenticação.

1. ESTABELECER O ESTADO REAL E O CAMINHO MAIS CURTO

Inspecione instruções locais aplicáveis, Git, alterações não commitadas, migrations, configuração de deploy e relatórios. Preserve o trabalho existente; não use reset/restore destrutivo, force-push ou reescrita de migrations já aplicadas.

Correlacione HEAD local, origin, origem do build e deployment ativo da Railway, com horários. Diferencie redeploy de configuração de publicação de código novo. Confirme flags efetivas, ambiente e presença das credenciais sem revelar valores.

Registre o que está somente local, versionado, publicado e comprovado. Se o deployment não tiver SHA confiável, registre a falta de prova e resolva essa rastreabilidade no release seguinte.

Confirme separadamente migrations em produção e rare_dev antes de agir. A pendência local não significa pendência em produção. Aplique apenas o necessário no banco correto, sem reset e sem marcar migrations artificialmente como executadas.

Não refaça uma auditoria geral já concluída. Reutilize evidências compatíveis com o commit/ambiente atual e concentre o plano nos bloqueadores restantes.

2. CONSOLIDAR AS CORREÇÕES E PREPARAR UM RELEASE IDENTIFICÁVEL

Revise e integre as melhorias locais de autenticação, invalidação de sessões, upload, storage, fontes e encerramento do Playwright. Corrija regressões e inconsistências encontradas.

Preserve as remediações de dependências já aprovadas, incluindo Sharp 0.35.4. Não use npm audit fix --force, downgrade do Prisma ou override major não suportado para reduzir números do audit.

Reavalie o audit atual e a exposição real. O último risco conhecido era deepmerge-ts na cadeia administrativa do Prisma CLI, ausente do standalone HTTP. Confirme essa condição, registre a exceção e o acompanhamento; não declare audit zerado nem interrompa tarefas independentes esperando upstream. Uma nova exposição explorável deve ser tratada como tal.

Mantenha a rota antiga de presign fechada e preserve validação de bytes, limites, autenticação/autorização e gravação exclusiva no upload.

Confira artefato standalone, Sharp no Linux/Railpack, assets e fontes, manifests de Server Actions e metadados seguros de release. Não exponha material criptográfico. Investigue divergências observadas sem transformar a hipótese histórica de Server Actions em causa comprovada.

3. CRIAR STAGING REALMENTE ISOLADO

Use banco, credenciais, armazenamento e recursos de teste separados da produção. Redis deve ser separado ou isolado com evidência de que sessões, cache, locks e reservas não colidem. Não copie dados pessoais de clientes para fixtures.

Verifique referências de variáveis depois de criar/duplicar o ambiente: duplicar um serviço não comprova isolamento. Use a URL real do staging; não invente domínio.

Restrinja o acesso ao storefront/Admin de homologação e a indexação. O webhook Stripe precisa continuar acessível por HTTPS, sem login interativo ou redirecionamento, com autenticação pela assinatura.

Depois de comprovar o isolamento, configure:
- APP_URL e, se usado, NEXT_PUBLIC_APP_URL com a URL real de staging.
- STRIPE_SECRET_KEY com rk_test_ ou sk_test_ da conta/sandbox correto.
- STRIPE_WEBHOOK_SECRET com o segredo exclusivo do endpoint test desse staging.
- MELHOR_ENVIO_TOKEN com o token sandbox.
- MELHOR_ENVIO_ENV=sandbox.
- SHIPPING_PROVIDER=melhor_envio.
- CEP real de origem e MELHOR_ENVIO_USER_AGENT com identificação e e-mail técnico confirmado.
- CHECKOUT_ENABLED=true e SHIPPING_ENABLED=true somente nesse staging isolado.
- No Admin de staging, shippingMode=melhor_envio.
- Produtos de teste com estoque, peso e dimensões coerentes. Não invente medidas de produtos reais; identifique fixtures sintéticas.

O código atual usa token manual em MELHOR_ENVIO_TOKEN ou MELHOR_ENVIO_ACCESS_TOKEN. Escolha uma variável para evitar conflito. Não implemente OAuth apenas para configurar a integração atual. Deixe MELHOR_ENVIO_BASE_URL ausente, salvo necessidade comprovada.

4. HOMOLOGAR PAGAMENTO, WEBHOOK, PEDIDO E ESTOQUE

O endpoint identificado no código é POST /api/stripe/webhook. Em produção, a URL conhecida é https://raredept.com.br/api/stripe/webhook. No staging, use a mesma rota com o domínio real de staging.

A configuração identificada foi: eventos da própria conta, Snapshot, versão 2026-04-22.dahlia, com estes seis eventos:
- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- checkout.session.expired
- payment_intent.succeeded
- payment_intent.payment_failed

Confirme que continua compatível com o código/SDK atual. Não selecione eventos extras sem implementar o tratamento. Use segredos separados por endpoint/ambiente e verifique a conta e o modo efetivos; o prefixo whsec_ não identifica se é teste ou produção.

A chave restrita é compatível em STRIPE_SECRET_KEY. Verifique as permissões realmente utilizadas; o levantamento apontou Checkout Sessions Write. Não amplie permissões para esconder erro de integração. A chave publicável não é usada pelo fluxo atual de Checkout hospedado.

Valide de ponta a ponta, em ambiente test:
- Carrinho, preço, desconto, frete, moeda BRL e total calculados no servidor.
- Sessão de Checkout criada e vinculada ao pedido correto.
- Cartão aprovado, recusado e autenticação adicional quando aplicável.
- Pix e pagamentos assíncronos, conforme disponibilidade real da conta. Não presuma que informar card,pix habilita Pix.
- Assinatura com corpo bruto, rejeição de assinatura inválida e segregação de eventos test/live.
- Pedido pago somente após confirmação confiável de pagamento; retorno à página de sucesso não comprova pagamento.
- Idempotência, duplicatas, reenvios, eventos fora de ordem e a combinação de eventos de sessão e PaymentIntent para a mesma compra.
- Reserva/baixa/liberação de estoque exatamente uma vez, concorrência pela última unidade e corrida entre expiração e pagamento.
- Cancelamento/expiração sem pedido indevidamente pago e sem estoque preso.
- Histórico do cliente, detalhes no Admin e recuperação diante de indisponibilidade temporária.

Prefira gerar eventos pelo fluxo real no sandbox e reentregar eventos assinados pelo provedor. Testes com mocks ajudam, mas não substituem a prova da integração.

Não permita que staging altere pedidos/estoque reais. Pausar novas vendas não deve descartar webhooks válidos de pedidos já criados.

5. HOMOLOGAR FRETE E FECHAR O FLUXO DE COMPRA

A integração atual do Melhor Envio faz cotação em /api/v2/me/shipment/calculate. Não promete compra/impressão de etiquetas. Entrega operacional pode utilizar o painel do Melhor Envio; documente o procedimento sem ampliar esse escopo nesta reta final.

Confirme o CEP real com o proprietário quando necessário. O StoreSettings.originCep do Admin tem prioridade sobre SHIPPING_ORIGIN_CEP; não dependa silenciosamente do fallback 31170350.

Valide unidades kg/cm, quantidade, valor segurado, embalagem/cálculo usado, frete selecionado e total final do pedido. Confira transportadoras/serviços efetivamente disponíveis. O levantamento sugeriu 1,2 para PAC/SEDEX; só restrinja a lista se essa for a operação pretendida.

Teste múltiplos CEPs válidos, CEP inválido, destino sem cobertura, produtos incompletos, timeout, token inválido e indisponibilidade. Não transforme erro em frete grátis e não aceite do navegador um preço de frete arbitrário.

A configuração atual não renova tokens automaticamente. Registre como identificar e corrigir expiração/revogação e não atribua ao token manual um prazo de OAuth sem confirmação.

6. FECHAR DOMÍNIO, UPLOAD, E-MAIL E OPERAÇÃO

Cloudflare/www:
- Revalide o estado público e as regras reais antes de alterar.
- Se ainda necessário, aplique ou ajuste uma única regra Single Redirect:
  nome canonicalizar-www-para-apex;
  condição (http.host eq "www.raredept.com.br");
  destino dinâmico concat("https://raredept.com.br", http.request.uri.path);
  status 308; preservação de query string habilitada.
- Confira proxy, TLS, ordem das regras correspondentes e ausência de loop. Reutilize regra equivalente existente.
- Valide caminhos/query/métodos pelo verificador do projeto e por requisições reais. Não amplie allowedOrigins ou relaxe autenticação para mascarar problemas.

Upload:
- Prove produto/banner com R2 real do staging, login autorizado, gravação no banco e exibição posterior, incluindo falha sem perda da mídia anterior.
- Em produção, use somente recurso controlado oculto/rascunho para qualquer escrita necessária; não publique produto fictício nem altere banner de campanha.
- Remova apenas artefatos identificados do teste. Não faça limpeza ampla de objetos órfãos nesta tarefa.

E-mail:
- Use o provedor já disponível, caso exista, e confirme entrega real de confirmação de pedido no destinatário de teste.
- Se faltar provedor/credencial/remetente, avance na implementação e nos testes possíveis e solicite o dado exato necessário.
- Configure autenticação do domínio conforme o provedor sem sobrescrever registros de e-mail existentes. Alteração de MX da caixa de entrada não é um requisito automático de envio transacional.
- Separe falha de notificação de sucesso do pagamento; preserve retry/idempotência sem duplicar pedidos ou mensagens.
- Não marque “e-mail funcionando” somente porque o mock passou ou a API aceitou a requisição.

Cron, backup e recuperação:
- Confira a execução real das reservas na Railway e a idempotência/concorrência com pagamentos.
- Investigue execução legada na Vercel; apagar vercel.json sozinho não comprova que o agendamento remoto cessou. Desative somente o agendamento duplicado identificado quando houver acesso.
- Tenha backup válido antes de migrations/release e prove restauração em ambiente descartável.
- Prepare rollback para artefato/commit conhecido compatível com o schema. Não proponha desfazer migration destrutivamente nem apagar trabalho local não commitado.
- Prepare procedimento operacional curto para pedidos, pagamento pendente, etiquetas manuais, cancelamento/reembolso e falha de integração.

7. EXECUTAR QA FINAL E PUBLICAR O CÓDIGO CORRETO

Reutilize gates do projeto. Execute testes focados após mudanças e uma rodada integrada suficiente do candidato final; não repita a suíte inteira sem alteração relevante ou risco concreto.

No candidato ao release, confira lint, tipos, build, migrations, audit contextualizado, Server Actions, standalone/Linux, testes relevantes e E2E. Classifique os skips: pagamento, frete, autenticação, estoque e upload não podem ficar “aprovados” por terem sido pulados.

Valide mobile/desktop, navegação por teclado, formulários de cliente/Admin, reset obrigatório, invalidação de sessões antigas, catálogo/produto, checkout e pedido. Use contas de teste; não redefina minha senha definitiva nem a do proprietário para fazer QA. Se não houver celular físico, identifique a validação como emulação e deixe claro o limite.

Prepare o release com Git e origem do build rastreáveis. Antes de push/merge, verifique se há autodeploy e assegure gates, backup e flags corretos para evitar publicação antecipada.

Publique as correções autorizadas com CHECKOUT_ENABLED=false e SHIPPING_ENABLED=false na produção. Mantenha as credenciais live/production separadas das de homologação. Não ative e-mail de produção antes da validação correspondente.

Comprove o commit/artefato publicado por evidências confiáveis de build/deployment e metadados do aplicativo, e não somente pelo nome de uma variável. Valide smoke público, www, assets/fontes, R2, autenticação, logs e Server Actions após o deploy. Verifique recuperação de uma aba aberta no release anterior sem replay automático de mutações.

Caso apareça regressão relevante, corrija ou aplique o rollback preparado; não encerre apenas relatando que o deploy falhou.

8. CRITÉRIO DE CONCLUSÃO E PRÓXIMA DECISÃO

O objetivo desta execução é uma versão publicada e estável com correções comprovadas, e a operação comercial homologada em staging, pronta para ativação consciente.

Mantenha um único registro incremental, por exemplo FINAL_RELEASE_STATUS.md, com evidências suficientes:
- Commits/PRs e deployments, URLs e ambientes.
- Migrations por banco e isolamento do staging.
- Testes executados e skips relevantes.
- Provas de pagamento, webhook, estoque, frete, e-mail e upload.
- Flags efetivas, riscos residuais, backup e rollback.
- O que depende exclusivamente de acesso, credencial ou decisão minha.

Durante o trabalho, envie atualizações curtas quando houver progresso, descoberta ou bloqueio. Não transforme cada etapa em pedido de aprovação ou em novo relatório extenso. Se uma integração ficar bloqueada, continue as demais frentes independentes. Um bloqueio comercial não impede publicar uma correção independente com vendas pausadas, desde que os gates técnicos desse release tenham passado; registre a homologação comercial que ainda falta.

Ao final, entregue um resumo objetivo do que implementou e publicou, as provas mais importantes e o estado real:
- PRONTO PARA ATIVAR VENDAS, se todos os gates comerciais foram comprovados; ou
- BLOQUEADO POR [item concreto], com a menor ação necessária para resolver.

Se estiver pronto, apresente a alteração final exata de flags/configuração, pré-requisitos de Pix/cartão/frete, rollback e validação posterior, e peça minha autorização para ativar as vendas reais. Não chame a loja de “vendendo” enquanto as flags estiverem desativadas.

Não adicione funcionalidades opcionais, redesigns ou refatorações amplas que não resolvam um bloqueador. Comece agora pelo estado real e avance até o limite autorizado.
