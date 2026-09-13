# Enquadramento de imagens de produto

No Admin, abra **Produtos → editar produto → Mídia do produto**. Imagens estáticas novas abrem o editor durante o upload; uma imagem cadastrada oferece **Enquadrar imagem**. A moldura é **4:5**, a mesma do catálogo. Não há proporções livres no card.

- **Preencher com recorte:** zoom de 100% a 300%; arraste ou ajuste posição horizontal/vertical.
- **Encaixar o produto inteiro:** zoom de 25% a 100%, preservando todo o produto e a proporção da foto. As áreas vazias são transparentes; a prévia mostra o fundo claro do catálogo.
- **Redefinir:** volta ao preenchimento centralizado em 100%.
- **Cancelar/Escape:** mantém a referência anterior, inclusive ao cancelar um upload novo.
- **Aplicar enquadramento:** gera e prepara a nova referência. **Salvar produto** a persiste e invalida os caminhos públicos existentes. Reabrir após reload recupera modo, zoom e posição.

O dialog usa controles nativos de teclado, ranges e pointer events para mouse/touch. O editor é carregado dinamicamente somente no Admin; nenhuma dependência nova foi adicionada ao storefront.

## Original e persistência

`ProductMediaAsset` é um registro imutável por upload/edição. `url` aponta ao resultado; `originalUrl` permanece no original enviado, inclusive após várias edições. `width`/`height` são as dimensões **orientadas do original**, e `framing` contém `{version:1, mode, zoom, x, y}`. O resultado tem 1600×2000 e usa o fluxo existente de variantes WebP elegíveis, armazenamento exclusivo e cache imutável.

A original é preservada byte a byte. Não se renderiza a edição anterior e não se sobrescrevem objetos. Falha de processamento/storage não cria a referência de sucesso; falha do banco não substitui a imagem do produto. A troca pública acontece apenas na transação existente de Salvar produto. Cancelamentos e falhas podem deixar assets/objetos não vinculados: não há coleta automática destrutiva. Qualquer futura coleta deve preservar tanto `ProductImage.url` quanto `ProductMediaAsset.originalUrl` e levar em conta uploads em edição.

Imagens antigas continuam visíveis sem processamento em massa. O editor resolve imagens antigas pelo ID do `ProductImage`; referências que não pertencem ao storage configurado são recusadas com orientação para enviar o original. SVGs/URLs externas não são buscados pelo servidor. GIFs, vídeos e WebP animado preservam o formato e não são convertidos em fotos. APNG é identificado para impedir recorte do primeiro frame; upload pelo editor é recusado explicitamente, com orientação para GIF/WebP animado.

## Contrato e proteção

`/api/admin/product-images/editor` exige `requireAdmin()` completo, incluindo as proteções existentes de primeiro acesso/sessão. POST exige mesma origem, rate limit por Admin e limite do stream real (4 MB por arquivo, JSON até4096bytes). O cliente envia **um** `assetId` próprio ou `productImageId` cadastrado; campos URL/path e propriedades extras são recusados.

- POST multipart `file`: upload estático seguro e criação de referência própria.
- POST JSON `{action:"prepare", reference}`: original autorizado e parâmetros atuais.
- POST JSON `{action:"apply", reference, framing}`: nova versão imutável.
- GET `?assetId=...` ou `?productImageId=...`: prévia WebP orientada, autenticada, `private, no-store`.

O storage é lido por chave estrita de objeto no bucket/local configurado; não há fetch de URLs. A leitura local verifica o caminho real sob o diretório de storage. Tamanho do corpo e limite de40milhões de pixels são validados no servidor. Sharp decodifica a imagem, aplica EXIF antes do recorte e valida novamente os parâmetros; dimensões/retângulos enviados pelo cliente não são aceitos.

Referências técnicas verificadas: [Sharp autoOrient e ordem das operações](https://sharp.pixelplumbing.com/api-operation/), [resize/extract/fit](https://sharp.pixelplumbing.com/api-resize/) e o guia instalado `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` do Next16.3.4.

## Evidência de13/09/2026

Local isolado:62testes em7arquivos (crop real, animação WebP com frames diferentes, autorização, falhas, storage e regressão do formulário), ESLint e TypeScript passaram. O QA do Next dev/PostgreSQL descartável registrou12provas nos arquivos `output/nine-changes-20260913/crop-browser.json` e `crop-upload-touch.json`: original/hash, EXIF, transparência, cancelamento, falha SQL real/retry, aplicação, Server Action, reload, segunda edição, teclado, touch emulado e URL arbitrária rejeitada.

Capturas antes: `crop-before-desktop.png`/`crop-before-mobile.png` no staging anterior, sem mutação. Capturas depois: `crop-editor-*`, `crop-after-*`, `crop-product-mobile.png` no ambiente local sintético. A prova de touch é emulação Chromium/CDP; não é um celular físico. Esta evidência local não equivale ao deploy ou à homologação R2 do editor novo; publicação/staging são gates da integração coordenada.
