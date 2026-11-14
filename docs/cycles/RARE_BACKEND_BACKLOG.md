# RARE — Backend Backlog (não implementado)

Release e backend permanecem pausados. Estes itens são limitações observadas no código, não autorização para implementação.

| Limitação observada | Capacidade necessária | Evidência / consumidor | Sugestão para ciclo futuro | Prioridade |
| --- | --- | --- | --- | --- |
| Build e typecheck com contratos Next gerados falham em quatro exports com argumentos opcionais | Contratos de rotas compatíveis com o Next instalado | Admin banners/categories/readiness e `/api/health` GET; assinaturas idênticas a `cc72e3b` | Em escopo explicitamente autorizado, revisar somente os contratos dos exports, preservar lógica e rodar types/build completos | P1 — gate de build |
| Leitura de settings faz upsert | Navegação/QA de leitura sem escrita incidental | `src/lib/settings.ts` → StoreLayout/home/institucionais | Separar inicialização explícita da leitura com fallback validado; testes garantindo read-only | P1 |
| JSON-LD do PDP calcula estoque sem filtrar variant.active | Semântica de disponibilidade consistente com cards/PDP | `src/app/(store)/produto/[slug]/page.tsx` | Unificar disponibilidade em helper/testes; manter Offer omitida enquanto checkout pausado | P2 |
| Não há fluxo de recuperação de senha | Recuperação segura com token expirável e entrega homologada | `/entrar`, `/cadastro`; nenhuma rota de recuperação | Projetar serviço/token/rate limit/email e somente então adicionar UI | P2 |

## Sequência recomendada (após autorização)

1. Resolver gates de segurança/backup/config da Phase 2, sem confundir o frontend com liberação comercial.
2. Autorizar separadamente os contratos de tipos que bloqueiam o build; validar localmente sem credenciais ou banco.
3. Leitura pura de settings e testes de efeitos colaterais.
4. Consistência de estoque/SEO.
5. Recuperação de conta, se aprovada, com homologação do provedor de email.

## Evidência do gate de build

O fallback Webpack de QA da fonte final compilou em 48s (20:40 UTC), mas a validação gerada do Next falhou em:

- `src/app/admin/(protected)/banners/page.tsx`: `BannersPageProps | undefined` não satisfaz `PageProps`.
- `src/app/admin/(protected)/categories/page.tsx`: `CategoriesPageProps | undefined` não satisfaz `PageProps`.
- `src/app/admin/(protected)/readiness/page.tsx`: `AdminReadinessPageProps | undefined` não satisfaz `PageProps`.
- `src/app/api/health/route.ts`: primeiro argumento de `GET` (`Request | undefined`) não satisfaz `Request | NextRequest`.

As quatro assinaturas de origem são iguais à base reconciliada; não foi executado um build histórico da base. Não se afirma uma falha histórica já medida. Nenhum destes arquivos foi alterado no ciclo visual, e nenhum contrato gerado foi excluído para mascarar o gate. A correção é externa ao escopo frontend autorizado, não uma autorização implícita para redesenhar Admin ou modificar health/auth.

Não adicionar ordenação, wishlist, newsletter, avaliações, tracking ou novos métodos de pagamento sem contrato real e escopo aprovado.
