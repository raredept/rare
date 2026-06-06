# Otimização de mídia

## Estratégia atual

A RARE usa uma estratégia incremental sem migration. Novos uploads server-routed de imagens estáticas elegíveis preservam o original e podem gerar duas variantes WEBP:

| Uso | Largura | Formato |
| --- | ---: | --- |
| Card/thumbnail | 640 px | WEBP, qualidade 80 |
| Detalhe/banner/OG | 1200 px | WEBP, qualidade 84 |
| Zoom/lightbox | largura original | Formato original preservado |

O processamento ocorre apenas em `POST /api/admin/uploads`, no runtime Node. A dependência `sharp` lê o buffer já recebido pelo backend, aplica orientação, redimensiona sem ampliar e remove o conjunto de variantes quando ele não reduz bytes.

## Elegibilidade e fallback

- JPG/JPEG, PNG, WEBP e AVIF estáticos podem ser processados.
- A imagem precisa ter pelo menos 1200 px de largura orientada.
- Imagens animadas detectadas, arquivos pequenos, resultados sem ganho e falhas de processamento preservam somente o original.
- GIF não é processado e continua animado.
- MP4 não é processado e continua disponível como vídeo.
- Nenhum arquivo original é removido.
- Produtos e banners antigos continuam usando a URL original.

## Persistência sem migration

As variantes são objetos reais no mesmo storage. A convenção versionada de keys só é aplicada quando as duas variantes foram geradas:

```text
<uuid>-<nome>-rare-v1-original.<extensão-original>
<uuid>-<nome>-rare-v1-thumbnail.webp
<uuid>-<nome>-rare-v1-medium.webp
```

O banco continua armazenando apenas a URL original em `ProductImage.url`, `HomeBannerSlide.imageUrl` ou `HomeBannerSlide.mobileImageUrl`. O render plan reconhece exclusivamente o marcador `rare-v1-original` e deriva as duas URLs irmãs. URLs antigas ou manuais sem esse marcador não recebem `srcSet`.

Todos os objetos enviados pelo backend usam o `Content-Type` correspondente e `Cache-Control: public, max-age=31536000, immutable`.

## Uso no storefront

- Cards escolhem `thumbnail`.
- Página de produto escolhe `medium`.
- Thumbnails da galeria escolhem a menor variante adequada.
- Zoom/lightbox sempre usa o original.
- Banner da home escolhe a variante adequada e emite `srcSet` real.
- Open Graph escolhe `medium` quando a URL é pública, estática e sem query/token.
- GIF e MP4 mantêm os comportamentos anteriores; MP4 não entra em card, zoom ou OG.

## Upload direto por presign

O presign R2 permanece disponível até 100 MB e não foi alterado. Como o arquivo vai direto do navegador para o R2, esse fluxo não passa pelo buffer do backend e não gera variantes.

Use o upload server-routed de até 4 MB para imagens estáticas que precisam de variantes. Preserve o presign para arquivos grandes e MP4. Um processamento assíncrono posterior pode ser avaliado no futuro, mas não faz parte do fluxo atual.

## Mídia antiga

Não existe reprocessamento automático do R2. Para mídia antiga pesada, as opções são:

1. Reenviar manualmente a imagem pelo Admin.
2. Criar futuramente um job explícito, auditável e executado primeiro em staging.

Até isso ocorrer, o fallback continua sendo a URL original.

## Homologação de variantes em staging

Use este checklist em um ambiente de staging isolado. Não execute upload destrutivo em produção sem autorização explícita.

Pré-requisitos:

- Staging com R2 configurado.
- Usuário Admin ativo.
- Produto de teste ou rascunho.
- Imagem JPG/PNG pequena e elegível para variantes.
- GIF pequeno opcional.
- MP4 pequeno opcional.
- Banco e bucket separados de produção para testes destrutivos.

Passos:

1. Entrar no Admin de staging.
2. Criar ou editar um produto rascunho.
3. Fazer upload de imagem estática pelo fluxo server-routed do Admin.
4. Confirmar que a URL persistida contém `rare-v1-original` e que as URLs irmãs `rare-v1-thumbnail.webp` e `rare-v1-medium.webp` existem.
5. Confirmar que card usa thumbnail.
6. Confirmar que detalhe/banner/OG usam medium quando aplicável.
7. Confirmar que zoom/lightbox usa o original.
8. Confirmar que `srcSet` aparece apenas quando há variantes reais distintas.
9. Confirmar que GIF continua animado e não recebe variantes.
10. Confirmar que MP4 continua vídeo e não entra em card, zoom ou OG.
11. Confirmar `Content-Type` correto e `Cache-Control: public, max-age=31536000, immutable`.
12. Confirmar que URL pública não contém token, assinatura ou querystring sensível.
13. Remover ou manter o produto de teste conforme a decisão operacional do staging.

Critérios de aceite:

- Upload autenticado concluído.
- Original, thumbnail e medium funcionando para imagem estática elegível.
- Fallback legado funcionando sem imagem quebrada.
- GIF e MP4 preservados.
- Sem erro de console relevante.
- Sem secret, token ou URL assinada exposta no HTML público.

## Auditoria dry-run de mídia legada

O comando abaixo lista produtos, banners e mídias sem alterar banco, storage ou arquivos:

```bash
npm run media:variants:audit
```

O modo padrão é somente leitura: consulta o banco configurado, não chama R2, não faz HEAD remoto, não apaga mídia, não substitui URL e não gera variantes. URLs com querystring ou aparência de assinatura são mascaradas no console.

Resumo emitido:

- total de mídias;
- total com variantes pela convenção versionada;
- total sem variantes;
- candidatas a reupload manual;
- GIF/MP4 preservados;
- mídias com tamanho desconhecido;
- originais grandes quando houver tamanho conhecido.

Quando for necessário estimar tamanho por rede, use explicitamente:

```bash
npm run media:variants:audit -- --check-remote-size
```

Essa flag faz apenas `HEAD` em URLs HTTP(S) sem sinal de assinatura. O padrão continua sem rede externa.

## Validação

```bash
npm run media:variants:audit
npm test -- image-variants
npm test -- media-variant
npm test -- storage
npm test -- product-media
npm test -- upload
npm test -- product-card
npm test -- product-detail
npm run lint
npm run typecheck
npm test
npm run build
```

Os testes usam storage local temporário ou mocks do SDK S3. Nenhum teste chama R2 real.
