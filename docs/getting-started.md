# Primeiros passos

## Desenvolvimento local

Requisitos:

- Node.js 24.x
- pnpm 10.x

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

Abra `http://localhost:3000`.

Em um banco vazio, `/setup` cria o primeiro administrador. Não reutilize senha institucional.

## Setup inicial recomendado

1. Crie o primeiro ADMIN.
2. Cadastre o Program.
3. Cadastre Cohort/Turma apenas se ela realmente separar grupos acadêmicos.
4. Defina o período atual.
5. Crie Subject Offerings.
6. Matricule usuários nas Offerings corretas.
7. Configure Google somente se quiser Classroom/Drive/Docs.
8. Configure Groups e chats conforme a necessidade.

Uma Subject é a definição da disciplina. Uma Subject Offering representa a ocorrência concreta para programa/período/turma/professor/Classroom. Não junte duas turmas diferentes apenas porque o nome da disciplina coincide.

## Checks de desenvolvimento

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Dados locais

Por padrão:

- banco: `./data/openstudyhub.db`
- assets privados: `./data/private-assets`

`data/`, `.env`, bancos, tokens e uploads não devem ser versionados.
