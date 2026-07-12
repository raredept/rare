# Auditoria conservadora de dependências — 2026-07-12

## Resultado final

`npm audit`: 0 vulnerabilidades conhecidas após atualizações compatíveis e overrides
de patch. Não foi usado `npm audit fix --force`, não houve downgrade e nenhuma versão
principal foi alterada.

## Avisos encontrados e decisão

| Pacote | Severidade | Caminho | Produção | Correção aplicada | Risco da atualização |
| --- | --- | --- | --- | --- | --- |
| `esbuild` | baixa | `tsx -> esbuild` e `vitest -> vite -> esbuild` | Ferramenta local/teste, não runtime do storefront | `tsx` 4.23.0 e `vitest` 4.1.10 levaram `esbuild` a 0.28.1 | Baixo; minor/patch e suíte obrigatória |
| `postcss` | moderada | `next -> postcss` | Build de produção; não recebe input CSS de usuário no runtime atual | Next 16.2.10 e override compatível `postcss ^8.5.10` | Baixo a moderado; override transitivo validado por build |
| `@hono/node-server` | moderada | `prisma -> @prisma/dev -> @hono/node-server` | CLI de desenvolvimento/migrations, não servidor Next publicado | Override patch 1.19.13 | Baixo; patch transitivo, Prisma mantido em 7.8.0 |
| `@prisma/dev` / `prisma` | moderada por efeito do Hono | `prisma -> @prisma/dev` | Ferramenta operacional, Prisma Client continua separado | Resolvido ao corrigir o transitivo, sem downgrade para Prisma 6 | Downgrade sugerido pelo audit foi rejeitado por ser destrutivo |
| `next` | moderada por efeito do PostCSS | `next -> postcss` | Build/runtime principal | Next 16.2.10 mais override do PostCSS | Patch do Next; override mantido somente com validação completa |

## Atualizações diretas aplicadas

- `next`: 16.2.6 para 16.2.10
- `eslint-config-next`: 16.2.6 para 16.2.10
- `tsx`: 4.21.0 para 4.23.0
- `vitest`: 4.1.6 para 4.1.10

Outras versões desatualizadas sem advisory não foram atualizadas em lote. A recomendação
é tratá-las em commits próprios, com motivação funcional e a mesma suíte completa.
