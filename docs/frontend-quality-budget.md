# Orçamento de qualidade do storefront

Atualizado em 12/07/2026. Este orçamento usa auditoria local de produção, com `CHECKOUT_ENABLED=false`, domínio de metadata `https://raredept.com.br` e tráfego HTTPS externo bloqueado. Os relatórios brutos ficam em `output/lighthouse/` e não são versionados.

## Baseline medido

O baseline inicial foi coletado com Lighthouse 13.4.0 antes das otimizações. Home e catálogo transferiam cerca de 13,9 MB, principalmente cinco PNGs originais de 2,5 a 2,86 MB. O produto transferia cerca de 3,0 MB. LCP mobile inicial: Home 3.430 ms, catálogo 48.683 ms e produto 15.606 ms.

O baseline melhorado e reproduzível usa Lighthouse 12.6.1, fixado em `devDependencies`:

| Métrica | Baseline melhorado (pior rota/perfil) | Limite | Justificativa |
| --- | ---: | ---: | --- |
| Performance mobile pública | 88 | >= 80 | Meta inicial do ciclo, com margem para variação local. |
| Performance desktop pública | 99 | >= 90 | Meta inicial do ciclo. |
| Accessibility | 96 | >= 95 | Complementado por Axe sem violações. |
| Best Practices | 100 | >= 95 | Meta inicial do ciclo. |
| SEO indexável | 100 | >= 95 | Login é excluído do score por `noindex` intencional. |
| LCP mobile | 3.911 ms | <= 4.500 ms | Aproximadamente 15% de margem sobre o baseline melhorado. |
| LCP desktop | 911 ms | <= 2.500 ms | Mantém folga para máquina/CI sem aceitar regressão severa. |
| CLS | 0 | <= 0,10 | Limite de Core Web Vitals; o baseline atual não desloca layout. |
| TBT | 17 ms | <= 150 ms | Margem para variação, ainda abaixo do limiar de 200 ms. |
| JavaScript transferido | 184.816 B | <= 220.000 B | Cerca de 19% de margem. |
| CSS transferido | 15.750 B | <= 20.000 B | Cerca de 27% de margem. |
| Imagens transferidas | 80.877 B | <= 100.000 B | Cerca de 24% de margem; não inclui zoom acionado pelo usuário. |
| Fontes transferidas | 29.801 B | <= 36.000 B | Cerca de 21% de margem; Geist Mono fica restrita ao Admin. |
| Transferência total | 505.190 B | <= 600.000 B | Cerca de 19% de margem. |
| Requests | 55 | <= 65 | Cerca de 18% de margem. |

## Como medir

1. Garanta PostgreSQL local disponível e banco atualizado.
2. Não inicie serviços externos nem habilite checkout.
3. Execute `npm run lighthouse`.
4. Confira `output/lighthouse/summary.json` e os oito relatórios JSON.

O runner faz build standalone, inicia um servidor local isolado, força checkout/e-mail desabilitados, bloqueia recursos HTTPS externos e audita Home, catálogo, produto e login em mobile/desktop. As páginas públicas indexáveis precisam cumprir SEO; login precisa permanecer `noindex`, validado por testes de metadata e Playwright.

## Tratamento de regressões

- Repetir uma vez para excluir variação local, sem mudar throttling ou ocultar conteúdo.
- Identificar rota e recurso no relatório `network-requests` e no elemento LCP.
- Imagens: verificar `sizes`, variante existente, otimização do Next e prioridade apenas do candidato LCP.
- JavaScript: revisar novos Client Components, providers, imports e listeners globais.
- CSS/fontes: verificar novos pesos, animações, filtros, sombras e regras globais.
- LCP/TBT: separar TTFB, transferência, decode e render delay antes de alterar UI.
- Não elevar o limite para fazer o gate passar. Uma mudança de orçamento exige nova medição, justificativa e revisão.

## Warnings conhecidos

Em `next dev`, o Next pode emitir o aviso de LCP para outro card do grid responsivo, mesmo com o primeiro candidato da rota em `loading="eager"` e `fetchPriority="high"`. Esse aviso específico é permitido apenas no teste de console de desenvolvimento. A auditoria de produção não o emite e confirma os LCPs acima. Tornar todos os cards eager foi rejeitado porque degradaria prioridade de rede no mobile.
