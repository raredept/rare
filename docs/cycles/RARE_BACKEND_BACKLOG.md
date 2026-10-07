# RARE — Backend Backlog (não implementado)

Release e backend permanecem pausados. Estes itens são limitações observadas no código, não autorização para implementação.

| Limitação observada | Capacidade necessária | Evidência / consumidor | Sugestão para ciclo futuro | Prioridade |
| --- | --- | --- | --- | --- |
| Leitura de settings faz upsert | Navegação/QA de leitura sem escrita incidental | `src/lib/settings.ts` → StoreLayout/home/institucionais | Separar inicialização explícita da leitura com fallback validado; testes garantindo read-only | P1 |
| JSON-LD do PDP calcula estoque sem filtrar variant.active | Semântica de disponibilidade consistente com cards/PDP | `src/app/(store)/produto/[slug]/page.tsx` | Unificar disponibilidade em helper/testes; manter Offer omitida enquanto checkout pausado | P2 |
| Não há fluxo de recuperação de senha | Recuperação segura com token expirável e entrega homologada | `/entrar`, `/cadastro`; nenhuma rota de recuperação | Projetar serviço/token/rate limit/email e somente então adicionar UI | P2 |

## Sequência recomendada (após autorização)

1. Resolver gates de segurança/backup/config da Phase 2, sem confundir o frontend com liberação comercial.
2. Leitura pura de settings e testes de efeitos colaterais.
3. Consistência de estoque/SEO.
4. Recuperação de conta, se aprovada, com homologação do provedor de email.

Não adicionar ordenação, wishlist, newsletter, avaliações, tracking ou novos métodos de pagamento sem contrato real e escopo aprovado.
