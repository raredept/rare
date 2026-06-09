# Deploy com migrations — RARE

Este guia cobre releases que incluem migrations Prisma. A versão com `OperationalEvidence` adiciona uma tabela aditiva para evidências manuais do Admin readiness.

## Migration desta versão

- Nome: `20260606182000_operational_evidence`
- Tipo: aditiva
- Objeto criado: tabela `OperationalEvidence`
- Não remove tabela.
- Não remove coluna.
- Não altera coluna existente.
- Não adiciona campo obrigatório em tabela existente.
- Não grava secrets nem exige dados sensíveis.

## Ordem recomendada

1. Confirmar que o backup ou snapshot do banco do ambiente existe.
2. Conferir que `DATABASE_URL` aponta para o banco correto do ambiente.
3. Rodar `npx prisma migrate status`.
4. Em Railway, confirmar que o servico web usa `preDeployCommand` com `npx prisma migrate deploy`.
5. Fazer deploy do código na Railway, caso o deploy ainda não tenha ocorrido.
6. Abrir `/admin/readiness` com sessão Admin.
7. Rodar `npm run smoke -- https://raredept.com.br` depois do deploy oficial.

## Se o código subir antes da migration

`/admin/readiness` deve continuar carregando. A seção de evidências mostra o aviso:

```text
Tabela de evidências ainda não aplicada neste ambiente. Aplique a migration OperationalEvidence antes de registrar evidências.
```

Enquanto a tabela estiver ausente:

- evidências não podem ser salvas;
- a venda aberta permanece bloqueada;
- staging não é bloqueado apenas por esse motivo;
- o erro técnico de banco não é exibido ao usuário;
- erros inesperados continuam sendo tratados pelo runtime da aplicação.

## Comandos seguros

Use em produção apenas depois de confirmar o ambiente:

```powershell
npx prisma migrate status
npx prisma migrate deploy
```

Na Railway, o `buildCommand` deve continuar sendo apenas `npm run build`. Migrations nao devem rodar dentro do build; devem rodar no pre-deploy para que uma falha de migration impeça o novo deploy de servir trafego.

Não use em produção:

```powershell
npx prisma migrate dev
npx prisma db push
```

Também não use shadow database de produção para desenvolvimento de migrations.

## Validação pós-deploy

```powershell
npx prisma migrate status
npm run smoke -- https://raredept.com.br
```

Depois, abrir `/admin/readiness` e confirmar que a seção `Evidências operacionais` aceita registros manuais sanitizados, sem secrets, tokens, URLs assinadas, CPF, e-mail real, cartão ou payloads Stripe/webhook.
