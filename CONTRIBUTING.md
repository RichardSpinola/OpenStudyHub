# Contribuindo com o OpenStudyHub

Obrigado pelo interesse em contribuir.

## Antes de abrir um PR

1. Não inclua dados reais de faculdade, emails privados, tokens, IDs de Drive/Classroom, bancos SQLite ou arquivos `.env`.
2. Mantenha Google e outras integrações opcionais.
3. Não amplie OAuth scopes sem justificar a necessidade e revisar segurança.
4. Preserve a separação entre Notes privadas, recursos compartilhados e autorização acadêmica.
5. Evite dependências/abstrações grandes sem necessidade concreta.

## Ambiente

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

## Checks

Antes do PR:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Se alterar `src/lib/db/schema.ts`, gere e revise uma migration:

```bash
pnpm db:generate
```

Nunca reescreva migrations já publicadas.

## Commits e escopo

Prefira mudanças pequenas e focadas. Explique comportamento novo, riscos, migrations e testes relevantes no PR.

## IA

Contribuições podem usar ferramentas de IA. O autor da contribuição continua responsável por revisar, testar e compreender o código enviado.

## Segurança

Não abra uma issue pública contendo segredo, token ou dado pessoal. Consulte `SECURITY.md`.

## Licença

A licença do projeto deve estar definida antes da primeira release pública. Ao contribuir depois disso, a contribuição será aceita sob a licença indicada no repositório.
