# Ajuste visual da home — 19/09/2026

Escopo solicitado: mover a faixa de marcas para imediatamente depois do cabeçalho/menu de categorias, antes do banner, ocupando a largura inteira; remover os controles de pausa do banner e da faixa, incluindo o divisor e o espaço reservado. Nomes reais, consulta do catálogo, setas, indicadores e demais funcionalidades permanecem. Não há alteração de banco, variáveis, dependências ou configuração comercial.

Antes da edição, Git local/remoto, produção e staging estavam no commit `98fcfa83f49f459bf1808187643a51170b07cd18`, sem alterações locais. Artefato publicado: `2390fedf0c4079c63093940a125801ddb76da8123de667d5accd515725f0ba03`. Checkout/frete falsos e e-mail `intentionally_disabled` nos dois ambientes.

A faixa usa dois grupos de largura idêntica, recortados dentro da própria região, com animação linear contínua. A cópia fica fora da árvore de acessibilidade. Com movimento reduzido, há uma lista única e estática, em uma linha, com rolagem manual por teclado/toque se necessária; o banner não avança automaticamente. Não foi adicionado controle visual substituto. O controle preexistente da seção de produtos em destaque permanece.

## Limitação de acessibilidade

A aprovação anterior de controles de pausa junto ao banner e à faixa deixa de valer. O [WCAG 2.2.2, Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) exige mecanismo para pausar/parar/ocultar movimento automático prolongado. A preferência do sistema continua respeitada, e o controle global já existente em destaques pode pausar a página quando essa seção oferece múltiplos produtos. Como sua presença depende do catálogo e ele não fica junto à faixa/banner, este ajuste não declara conformidade universal com esse critério. A remoção foi explicitamente solicitada pelo usuário, com registro desta limitação.

## Validação pertinente

- 17 testes existentes de home, marcas, destaques e banner aprovados; expectativas dos dois controles removidos atualizadas.
- ESLint e TypeScript aprovados. Release guard: 6 OK, 0 FAIL; aviso histórico de cron Vercel mantido, fora deste ajuste.
- Playwright local: larguras 320, 390, 1440 e 1920 px; desktop/celular com movimento normal e reduzido. Posição, largura, uma linha, recorte, ausência dos controles, continuidade e emenda do loop, setas/indicadores e autoplay normal/reduzido verificados. Desvio na emenda inferior a 1 px.
- Evidências e capturas deste ciclo: `output/playwright/home-brands-20260919/`. O recibo público final deve comprovar o SHA e o digest do artefato, health e flags comerciais após a promoção por staging.
- Homologações comerciais anteriores não foram repetidas. Referência histórica das nove funcionalidades: `FINAL_RELEASE_STATUS.md`.
