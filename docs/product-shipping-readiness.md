# Prontidão de peso e dimensões

Os campos persistidos em `Product` são inteiros opcionais: `weightGrams` em gramas e
`lengthCm`, `widthCm`, `heightCm` em centímetros. `ProductVariant` não possui override
de peso ou dimensão; produtos com múltiplas variações recebem um warning de revisão,
pois tamanhos podem representar embalagens diferentes.

Limites operacionais já adotados pela validação do projeto:

- peso: 1 a 100.000 g;
- cada dimensão: 1 a 1.000 cm;
- somente inteiros, evitando unidade ambígua no schema atual.

Não existe hoje um campo `shippingRequired`/produto digital no banco. Portanto, todos
os produtos são tratados como físicos. O domínio já aceita `shippingRequired=false`
para uma futura modelagem explícita, mas nenhuma categoria é inferida como digital.

Use a auditoria somente leitura:

```bash
npm run shipping:audit-products
npm run shipping:audit-products -- --format=json
npm run shipping:audit-products -- --page=2 --limit=50
```

Produtos incompletos não tornam o comando um erro operacional. O exit code só muda
para argumentos inválidos, falha de banco ou outra falha de execução.

O modo manual/fixo continua podendo montar pacote com fallback de 1.000 g e
10x35x35 cm, sempre com warning. Providers automáticos, incluindo Melhor Envio, são
bloqueados antes da chamada externa quando qualquer item depender desse fallback.
